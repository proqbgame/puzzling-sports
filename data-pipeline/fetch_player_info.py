"""Fetch supplemental player bio fields (mainly college) from stats.nba.com."""

from __future__ import annotations

from typing import Any

from nba_api.stats.endpoints import commonplayerinfo
from tqdm import tqdm

from config import CACHE_DIR
from utils import load_json_cache, retry_api_call, save_json_cache


def fetch_common_player_info(player_id: str, refresh: bool = False) -> dict[str, Any]:
    cache_path = CACHE_DIR / "player_info" / f"{player_id}.json"

    if not refresh:
        cached = load_json_cache(cache_path)
        if cached is not None:
            return cached

    response = retry_api_call(lambda: commonplayerinfo.CommonPlayerInfo(player_id=player_id))
    frame = response.get_data_frames()[0]
    if frame.empty:
        info: dict[str, Any] = {}
    else:
        row = frame.iloc[0]
        college = row.get("SCHOOL")
        college_clean = None
        if college and str(college).strip() not in ("", "None"):
            college_clean = str(college).strip()

        info = {
            "name": str(row.get("DISPLAY_FIRST_LAST") or "").strip(),
            "college": college_clean,
            "fromYear": int(row["FROM_YEAR"]) if row.get("FROM_YEAR") else None,
            "toYear": int(row["TO_YEAR"]) if row.get("TO_YEAR") else None,
        }

    save_json_cache(cache_path, info)
    return info


def fetch_player_info_for_ids(
    player_ids: list[str],
    refresh: bool = False,
) -> dict[str, dict[str, Any]]:
    info_by_id: dict[str, dict[str, Any]] = {}

    for player_id in tqdm(player_ids, desc="Player bios"):
        try:
            info_by_id[player_id] = fetch_common_player_info(player_id, refresh=refresh)
        except Exception:
            info_by_id[player_id] = {}

    return info_by_id
