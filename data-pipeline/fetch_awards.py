"""Fetch player awards and map them to season-level honors."""

from __future__ import annotations

import re
from typing import Any

import pandas as pd
from nba_api.stats.endpoints import playerawards
from tqdm import tqdm

from config import CACHE_DIR
from utils import load_json_cache, retry_api_call, save_json_cache


HONOR_FIELDS = (
    "mvp",
    "allStar",
    "allNba",
    "allDefensive",
    "finalsMvp",
    "dpoy",
    "sixthMan",
    "mostImproved",
    "champion",
)


def empty_honors() -> dict[str, bool]:
    return {field: False for field in HONOR_FIELDS}


def parse_award_description(description: str) -> str | None:
    """Map NBA API award description to a normalized honor key."""
    text = description.strip()
    lower = text.lower()

    if lower == "nba finals most valuable player":
        return "finalsMvp"
    if lower == "nba most valuable player":
        return "mvp"
    if lower == "nba defensive player of the year":
        return "dpoy"
    if lower == "nba sixth man of the year":
        return "sixthMan"
    if lower == "nba most improved player":
        return "mostImproved"
    if lower.startswith("all-nba"):
        return "allNba"
    if lower.startswith("nba all-defensive"):
        return "allDefensive"
    if "nba all-star" in lower or lower == "all-star selection":
        return "allStar"
    if lower == "nba champion":
        return "champion"

    # Fallback patterns for older/alternate wording.
    if re.search(r"finals.*most valuable", lower):
        return "finalsMvp"
    if re.search(r"defensive player of the year", lower):
        return "dpoy"
    if re.search(r"sixth man of the year", lower):
        return "sixthMan"
    if re.search(r"most improved player", lower):
        return "mostImproved"
    if re.search(r"^nba most valuable player", lower):
        return "mvp"
    if re.search(r"^all-nba", lower):
        return "allNba"
    if re.search(r"^nba all-defensive", lower):
        return "allDefensive"
    if "all-star" in lower:
        return "allStar"
    if lower.endswith("nba champion") or lower == "champion":
        return "champion"

    return None


def fetch_player_awards(player_id: str, refresh: bool = False) -> list[dict[str, Any]]:
    cache_path = CACHE_DIR / "awards" / f"{player_id}.json"

    if not refresh:
        cached = load_json_cache(cache_path)
        if cached is not None:
            return cached

    response = retry_api_call(lambda: playerawards.PlayerAwards(player_id=player_id))
    frame = response.get_data_frames()[0]
    records = frame.to_dict(orient="records")
    save_json_cache(cache_path, records)
    return records


def fetch_awards_for_players(
    player_ids: list[str],
    refresh: bool = False,
) -> dict[str, dict[str, dict[str, bool]]]:
    """
    Return mapping:
      playerId -> seasonLabel -> honors dict

    Example: awards["2544"]["2012-13"]["mvp"] == True
    """
    honors_by_player: dict[str, dict[str, dict[str, bool]]] = {}

    for player_id in tqdm(player_ids, desc="Player awards"):
        try:
            records = fetch_player_awards(player_id, refresh=refresh)
        except Exception:
            # Some historical IDs error out; skip gracefully.
            continue

        player_honors: dict[str, dict[str, bool]] = {}
        for row in records:
            honor = parse_award_description(str(row.get("DESCRIPTION") or ""))
            season = str(row.get("SEASON") or "").strip()
            if not honor or not season:
                continue

            season_honors = player_honors.setdefault(season, empty_honors())
            season_honors[honor] = True

        if player_honors:
            honors_by_player[player_id] = player_honors

    return honors_by_player


def awards_to_dataframe(
    honors_by_player: dict[str, dict[str, dict[str, bool]]],
) -> pd.DataFrame:
    """Flatten nested honors mapping to a dataframe for debugging/inspection."""
    rows: list[dict[str, Any]] = []
    for player_id, seasons in honors_by_player.items():
        for season, honors in seasons.items():
            row = {"playerId": player_id, "season": season, **honors}
            rows.append(row)
    return pd.DataFrame(rows)
