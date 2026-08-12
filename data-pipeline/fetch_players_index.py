"""Fetch the list of all NBA players (with career spans) from stats.nba.com."""

from __future__ import annotations

from typing import Any

import pandas as pd
from nba_api.stats.endpoints import commonallplayers

from config import CACHE_DIR
from utils import current_season_start_year, format_player_name, load_json_cache, retry_api_call, save_json_cache, season_label


def fetch_all_players_index(refresh: bool = False) -> list[dict[str, Any]]:
    """Return all-time player index rows from CommonAllPlayers."""
    cache_path = CACHE_DIR / "players_index.json"

    if not refresh:
        cached = load_json_cache(cache_path)
        if cached is not None:
            return cached

    season = season_label(current_season_start_year())
    response = retry_api_call(
        lambda: commonallplayers.CommonAllPlayers(
            is_only_current_season=0,
            season=season,
            league_id="00",
        )
    )
    frame = response.get_data_frames()[0]
    records = frame.to_dict(orient="records")
    save_json_cache(cache_path, records)
    return records


def historical_player_ids(
    first_year: int,
    last_historical_year: int,
    refresh: bool = False,
) -> list[str]:
    """
    Players who played at least one season in [first_year, last_historical_year].

    Used to limit PlayerCareerStats calls to relevant players only.
    """
    index = fetch_all_players_index(refresh=refresh)
    ids: list[str] = []

    for row in index:
        player_id = str(int(row["PERSON_ID"]))
        from_year = _parse_year(row.get("FROM_YEAR"))
        to_year = _parse_year(row.get("TO_YEAR"))

        if from_year is None or to_year is None:
            continue

        if from_year <= last_historical_year and to_year >= first_year:
            ids.append(player_id)

    return sorted(set(ids))


def player_names_by_id(refresh: bool = False) -> dict[str, str]:
    """Map playerId -> display name from the all-time index."""
    index = fetch_all_players_index(refresh=refresh)
    names: dict[str, str] = {}

    for row in index:
        player_id = str(int(row["PERSON_ID"]))
        raw_name = str(
            row.get("DISPLAY_FIRST_LAST")
            or row.get("DISPLAY_LAST_COMMA_FIRST")
            or row.get("PLAYER_SLUG")
            or ""
        ).strip()
        name = format_player_name(raw_name)
        if name:
            names[player_id] = name

    return names


def _parse_year(value: Any) -> int | None:
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        return None
