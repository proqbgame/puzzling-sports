"""Fetch per-season player stats (PPG, RPG, APG, BLK) from stats.nba.com."""

from __future__ import annotations

from typing import Any

import pandas as pd
from nba_api.stats.endpoints import leaguedashplayerstats
from tqdm import tqdm

from config import CACHE_DIR, MIN_GAMES_PER_SEASON
from utils import (
    iter_season_years,
    load_json_cache,
    retry_api_call,
    save_json_cache,
    season_label,
)


def _fetch_season_frame(season: str) -> pd.DataFrame:
    response = retry_api_call(
        lambda: leaguedashplayerstats.LeagueDashPlayerStats(
            season=season,
            season_type_all_star="Regular Season",
            per_mode_detailed="PerGame",
        )
    )
    return response.get_data_frames()[0]


def fetch_all_season_stats(
    first_year: int,
    last_year: int,
    refresh: bool = False,
) -> list[dict[str, Any]]:
    """Return flattened season stat rows via LeagueDashPlayerStats (1996+ era)."""
    from config import MODERN_STATS_START_YEAR

    dash_first = max(first_year, MODERN_STATS_START_YEAR)
    if dash_first > last_year:
        return []

    rows: list[dict[str, Any]] = []
    years = iter_season_years(dash_first, last_year)

    for year in tqdm(years, desc="Season stats"):
        season = season_label(year)
        cache_path = CACHE_DIR / "seasons" / f"{season}.json"

        if not refresh:
            cached = load_json_cache(cache_path)
            if cached is not None:
                rows.extend(cached)
                continue

        frame = _fetch_season_frame(season)
        season_rows = _normalize_season_frame(frame, season)
        save_json_cache(cache_path, season_rows)
        rows.extend(season_rows)

    return rows


def _normalize_season_frame(frame: pd.DataFrame, season: str) -> list[dict[str, Any]]:
    """Prefer TOT rows for traded players; otherwise keep team row with most games."""
    if frame.empty:
        return []

    working = frame.copy()
    working["PLAYER_ID"] = working["PLAYER_ID"].astype(int).astype(str)

    season_rows: list[dict[str, Any]] = []

    for player_id, group in working.groupby("PLAYER_ID"):
        pick = _pick_player_season_row(group)
        if pick is None:
            continue

        games = int(pick["GP"])
        if games < MIN_GAMES_PER_SEASON:
            continue

        season_rows.append(
            {
                "playerId": player_id,
                "playerName": str(pick["PLAYER_NAME"]).strip(),
                "season": season,
                "team": str(pick["TEAM_ABBREVIATION"]).strip(),
                "games": games,
                "ppg": _round_stat(pick["PTS"]),
                "rpg": _round_stat(pick["REB"]),
                "apg": _round_stat(pick["AST"]),
                "blk": _round_stat(pick["BLK"]),
            }
        )

    return season_rows


def _pick_player_season_row(group: pd.DataFrame) -> pd.Series | None:
    if len(group) == 1:
        return group.iloc[0]

    tot = group[group["TEAM_ABBREVIATION"] == "TOT"]
    if not tot.empty:
        return tot.iloc[0]

    # No season total — use the row with the most games played.
    return group.sort_values("GP", ascending=False).iloc[0]


def _round_stat(value: Any) -> float:
    return round(float(value), 1)
