#!/usr/bin/env python3
"""
Patch existing bios.json and seasons.json with sixthMan / mostImproved honors.

Reads cached per-player award files (no API calls) and updates output JSON.
Run from data-pipeline/:  python patch_sixth_man_mip.py
"""

from __future__ import annotations

import json
import sys
from collections import defaultdict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from config import CACHE_DIR, OUTPUT_DIR
from fetch_awards import empty_honors, parse_award_description
from utils import write_json


def honors_from_cache() -> dict[str, dict[str, dict[str, bool]]]:
    """playerId -> season -> { sixthMan, mostImproved } (only new honors)."""
    awards_dir = CACHE_DIR / "awards"
    result: dict[str, dict[str, dict[str, bool]]] = {}

    for cache_file in awards_dir.glob("*.json"):
        player_id = cache_file.stem
        records = json.loads(cache_file.read_text(encoding="utf-8"))

        player_honors: dict[str, dict[str, bool]] = {}
        for row in records:
            honor = parse_award_description(str(row.get("DESCRIPTION") or ""))
            if honor not in ("sixthMan", "mostImproved"):
                continue

            season = str(row.get("SEASON") or "").strip()
            if not season:
                continue

            season_honors = player_honors.setdefault(season, empty_honors())
            season_honors[honor] = True

        if player_honors:
            result[player_id] = player_honors

    return result


def main() -> None:
    bios_path = OUTPUT_DIR / "bios.json"
    seasons_path = OUTPUT_DIR / "seasons.json"

    honors_by_player = honors_from_cache()
    print(f"Players with 6MOY/MIP in cache: {len(honors_by_player)}")

    bios = json.loads(bios_path.read_text(encoding="utf-8"))
    seasons = json.loads(seasons_path.read_text(encoding="utf-8"))

    ever_flags: dict[str, dict[str, bool]] = defaultdict(
        lambda: {"everSixthMan": False, "everMostImproved": False},
    )
    for player_id, season_map in honors_by_player.items():
        for season_honors in season_map.values():
            if season_honors.get("sixthMan"):
                ever_flags[player_id]["everSixthMan"] = True
            if season_honors.get("mostImproved"):
                ever_flags[player_id]["everMostImproved"] = True

    sixth_man_seasons = 0
    mip_seasons = 0

    for row in seasons:
        honors = row.setdefault("honors", empty_honors())
        honors.setdefault("sixthMan", False)
        honors.setdefault("mostImproved", False)

        player_id = row["playerId"]
        season = row["season"]
        patch = honors_by_player.get(player_id, {}).get(season)
        if patch:
            if patch.get("sixthMan"):
                honors["sixthMan"] = True
                sixth_man_seasons += 1
            if patch.get("mostImproved"):
                honors["mostImproved"] = True
                mip_seasons += 1

    sixth_man_bios = 0
    mip_bios = 0

    for player_id, bio in bios.items():
        bio.setdefault("everSixthMan", False)
        bio.setdefault("everMostImproved", False)

        flags = ever_flags.get(player_id)
        if flags:
            if flags["everSixthMan"]:
                bio["everSixthMan"] = True
                sixth_man_bios += 1
            if flags["everMostImproved"]:
                bio["everMostImproved"] = True
                mip_bios += 1

    write_json(bios_path, bios)
    write_json(seasons_path, seasons)

    print(f"Patched season rows — 6MOY: {sixth_man_seasons}, MIP: {mip_seasons}")
    print(f"Patched bios — everSixthMan: {sixth_man_bios}, everMostImproved: {mip_bios}")
    print(f"Wrote {bios_path}")
    print(f"Wrote {seasons_path}")


if __name__ == "__main__":
    main()
