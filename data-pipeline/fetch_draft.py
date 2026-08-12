"""Fetch draft history (pick, round, college) from stats.nba.com."""

from __future__ import annotations

from typing import Any

import pandas as pd
from nba_api.stats.endpoints import drafthistory

from config import CACHE_DIR
from utils import load_json_cache, retry_api_call, save_json_cache


def fetch_draft_history(refresh: bool = False) -> pd.DataFrame:
    cache_path = CACHE_DIR / "draft_history.json"

    if not refresh:
        cached = load_json_cache(cache_path)
        if cached is not None:
            return pd.DataFrame(cached)

    response = retry_api_call(lambda: drafthistory.DraftHistory())
    frame = response.get_data_frames()[0]
    records = frame.to_dict(orient="records")
    save_json_cache(cache_path, records)
    return frame


def draft_records_by_player_id(frame: pd.DataFrame) -> dict[str, dict[str, Any]]:
    """Map PERSON_ID -> draft info. Uses earliest draft row if duplicates exist."""
    by_id: dict[str, dict[str, Any]] = {}

    for row in frame.to_dict(orient="records"):
        player_id = str(int(row["PERSON_ID"]))
        if player_id in by_id:
            continue

        organization = row.get("ORGANIZATION")
        college = None
        if organization and str(organization).strip() not in ("", "None"):
            org_type = str(row.get("ORGANIZATION_TYPE") or "")
            if "College" in org_type or "University" in org_type:
                college = str(organization).strip()

        overall_pick = row.get("OVERALL_PICK")
        round_num = row.get("ROUND_NUMBER")

        by_id[player_id] = {
            "draftYear": int(row["SEASON"]) if pd.notna(row.get("SEASON")) else None,
            "draftRound": int(round_num) if pd.notna(round_num) else None,
            "draftPick": int(overall_pick) if pd.notna(overall_pick) else None,
            "draftTeam": row.get("TEAM_ABBREVIATION"),
            "college": college,
            "name": str(row.get("PLAYER_NAME") or "").strip(),
        }

    return by_id
