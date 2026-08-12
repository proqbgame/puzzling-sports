"""Fetch pre-modern season stats via PlayerCareerStats (per player)."""

from __future__ import annotations

import re
from typing import Any

import pandas as pd
from nba_api.stats.endpoints import playercareerstats
from tqdm import tqdm

from config import CACHE_DIR, MIN_GAMES_PER_SEASON, MODERN_STATS_START_YEAR
from fetch_players_index import historical_player_ids, player_names_by_id
from utils import (
    load_json_cache,
    retry_api_call,
    save_json_cache,
    season_label,
    season_year_from_label,
)


def fetch_historical_career_stats(
    first_year: int,
    last_historical_year: int | None = None,
    refresh: bool = False,
) -> list[dict[str, Any]]:
    """
    Fetch season stat rows for years before the modern bulk-stats era.

    Uses one API call per player (cached). Covers roughly 1946-47 through 1995-96.
    """
    if last_historical_year is None:
        last_historical_year = MODERN_STATS_START_YEAR - 1

    if first_year > last_historical_year:
        return []

    player_ids = historical_player_ids(first_year, last_historical_year, refresh=refresh)
    names = player_names_by_id(refresh=refresh)

    rows: list[dict[str, Any]] = []
    for player_id in tqdm(player_ids, desc="Historical career stats"):
        player_rows = _fetch_player_career_seasons(
            player_id=player_id,
            player_name=names.get(player_id, ""),
            first_year=first_year,
            last_historical_year=last_historical_year,
            refresh=refresh,
        )
        rows.extend(player_rows)

    return rows


def _fetch_player_career_seasons(
    player_id: str,
    player_name: str,
    first_year: int,
    last_historical_year: int,
    refresh: bool,
) -> list[dict[str, Any]]:
    cache_path = CACHE_DIR / "career" / f"{player_id}.json"

    if not refresh:
        cached = load_json_cache(cache_path)
        if cached is not None:
            return _filter_cached_rows(cached, first_year, last_historical_year)

    try:
        response = retry_api_call(
            lambda: playercareerstats.PlayerCareerStats(
                player_id=player_id,
                per_mode36="PerGame",
            )
        )
        frame = response.season_totals_regular_season.get_data_frame()
    except Exception:
        save_json_cache(cache_path, [])
        return []

    season_rows = _normalize_career_frame(frame, player_id, player_name)
    save_json_cache(cache_path, season_rows)
    return _filter_cached_rows(season_rows, first_year, last_historical_year)


def _filter_cached_rows(
    rows: list[dict[str, Any]],
    first_year: int,
    last_historical_year: int,
) -> list[dict[str, Any]]:
    filtered: list[dict[str, Any]] = []
    for row in rows:
        year = season_year_from_label(row["season"])
        if first_year <= year <= last_historical_year:
            filtered.append(row)
    return filtered


def _normalize_career_frame(
    frame: pd.DataFrame,
    player_id: str,
    player_name: str,
) -> list[dict[str, Any]]:
    if frame.empty:
        return []

    working = frame.copy()
    working["PLAYER_ID"] = working["PLAYER_ID"].astype(int).astype(str)
    working["season"] = working["SEASON_ID"].apply(normalize_season_id)
    working = working[working["season"].notna()]

    season_rows: list[dict[str, Any]] = []

    for season, group in working.groupby("season"):
        pick = _pick_career_season_row(group)
        if pick is None:
            continue

        games = int(pick["GP"])
        if games < MIN_GAMES_PER_SEASON:
            continue

        name = player_name or str(player_id)
        season_rows.append(
            {
                "playerId": player_id,
                "playerName": name,
                "season": str(season),
                "team": str(pick["TEAM_ABBREVIATION"]).strip(),
                "games": games,
                "ppg": _round_stat(pick["PTS"]),
                "rpg": _round_stat(pick["REB"]),
                "apg": _round_stat(pick["AST"]),
                "blk": _round_stat(pick.get("BLK", 0)),
            }
        )

    return season_rows


def _pick_career_season_row(group: pd.DataFrame) -> pd.Series | None:
    if len(group) == 1:
        return group.iloc[0]

    tot = group[group["TEAM_ABBREVIATION"] == "TOT"]
    if not tot.empty:
        return tot.iloc[0]

    return group.sort_values("GP", ascending=False).iloc[0]


def normalize_season_id(season_id: Any) -> str | None:
    """
    Convert NBA SEASON_ID to 'YYYY-YY' label.

    Examples:
      '21966'   -> '1965-66'
      '1965-66' -> '1965-66'
    """
    text = str(season_id).strip()
    if re.match(r"^\d{4}-\d{2}$", text):
        return text

    if re.match(r"^2\d{4}$", text):
        end_year = int(text[1:])
        start_year = end_year - 1
        return season_label(start_year)

    return None


def _round_stat(value: Any) -> float:
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return 0.0
    return round(float(value), 1)
