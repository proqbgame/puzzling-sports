#!/usr/bin/env python3
"""
Build NBA player data for Puzzling Sports.

Usage (from the data-pipeline folder):
  python build.py
  python build.py --sample          # quick test: 3 recent seasons (skips historical)
  python build.py --refresh-all     # ignore disk cache
  python build.py --skip-awards     # season stats only (faster)
  python build.py --skip-historical # modern stats only (1996+)
  python build.py --first-year 1960 # historical data back to 1960-61

Requirements:
  pip install -r requirements.txt

Output:
  ../data/nba/bios.json
  ../data/nba/seasons.json
  ../data/nba/metadata.json
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

# Allow imports from this folder when run as a script.
sys.path.insert(0, str(Path(__file__).resolve().parent))

from config import (
    CACHE_DIR,
    FIRST_SEASON_YEAR,
    LAST_SEASON_YEAR,
    MODERN_STATS_START_YEAR,
    OUTPUT_DIR,
)
from fetch_awards import fetch_awards_for_players
from fetch_career import fetch_historical_career_stats
from fetch_draft import draft_records_by_player_id, fetch_draft_history
from fetch_player_info import fetch_player_info_for_ids
from fetch_seasons import fetch_all_season_stats
from merge import build_bios, build_metadata, build_seasons, merge_season_rows
from utils import current_season_start_year, write_json


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Build NBA data for Puzzling Sports")
    parser.add_argument(
        "--sample",
        action="store_true",
        help="Fetch only the 3 most recent seasons (skips historical)",
    )
    parser.add_argument(
        "--refresh-all",
        action="store_true",
        help="Ignore cached API responses and re-fetch everything",
    )
    parser.add_argument(
        "--skip-awards",
        action="store_true",
        help="Skip per-player awards (much faster; honors will be empty)",
    )
    parser.add_argument(
        "--skip-historical",
        action="store_true",
        help="Skip pre-1996 career stats (modern 1996+ only)",
    )
    parser.add_argument(
        "--skip-player-info",
        action="store_true",
        help="Skip CommonPlayerInfo lookups (college may be missing for undrafted players)",
    )
    parser.add_argument(
        "--first-year",
        type=int,
        default=FIRST_SEASON_YEAR,
        help=f"First season start year (default: {FIRST_SEASON_YEAR})",
    )
    parser.add_argument(
        "--last-year",
        type=int,
        default=LAST_SEASON_YEAR,
        help="Last season start year (default: current NBA season)",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    refresh = args.refresh_all

    last_year = args.last_year or current_season_start_year()
    first_year = args.first_year

    if args.sample:
        first_year = max(first_year, last_year - 2)

    skip_historical = args.skip_historical or args.sample

    print("Puzzling Sports — NBA data pipeline", flush=True)
    print(f"Season range: {first_year} -> {last_year}")
    if skip_historical:
        print("Historical (pre-1996): skipped")
    else:
        print(f"Historical via PlayerCareerStats: {first_year} -> {MODERN_STATS_START_YEAR - 1}")
    print(f"Modern via LeagueDashPlayerStats: {max(first_year, MODERN_STATS_START_YEAR)} -> {last_year}")
    print(f"Cache: {CACHE_DIR}")
    print(f"Output: {OUTPUT_DIR}")
    print()

    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    print("1/6 Fetching draft history...")
    draft_frame = fetch_draft_history(refresh=refresh)
    draft_by_id = draft_records_by_player_id(draft_frame)
    print(f"    Draft records: {len(draft_by_id)}")

    print("2/6 Fetching modern per-season stats (1996+)...")
    modern_rows = fetch_all_season_stats(first_year, last_year, refresh=refresh)
    print(f"    Modern season rows: {len(modern_rows)}")

    historical_rows: list = []
    if skip_historical:
        print("3/6 Skipping historical career stats")
    else:
        print("3/6 Fetching historical career stats (pre-1996, cached per player)...")
        historical_rows = fetch_historical_career_stats(
            first_year=first_year,
            last_historical_year=MODERN_STATS_START_YEAR - 1,
            refresh=refresh,
        )
        print(f"    Historical season rows: {len(historical_rows)}")

    season_rows = merge_season_rows(historical_rows, modern_rows)
    player_ids = sorted({row["playerId"] for row in season_rows})
    print(f"    Combined season rows: {len(season_rows)}")
    print(f"    Unique players: {len(player_ids)}")

    honors_by_player: dict = {}
    if args.skip_awards:
        print("4/6 Skipping awards (--skip-awards)")
    else:
        print("4/6 Fetching player awards (cached; first run takes a while)...")
        honors_by_player = fetch_awards_for_players(player_ids, refresh=refresh)
        print(f"    Players with awards: {len(honors_by_player)}")

    player_info_by_id: dict = {}
    if args.skip_player_info:
        print("5/6 Skipping player info (--skip-player-info)")
    else:
        missing_college_ids = [
            pid
            for pid in player_ids
            if not (draft_by_id.get(pid, {}).get("college"))
        ]
        print(f"5/6 Fetching college/bio for {len(missing_college_ids)} players...")
        player_info_by_id = fetch_player_info_for_ids(missing_college_ids, refresh=refresh)

    print("6/6 Merging and writing JSON...")
    bios = build_bios(season_rows, draft_by_id, player_info_by_id, honors_by_player)
    seasons = build_seasons(season_rows, honors_by_player)
    metadata = build_metadata(bios, seasons, first_year, last_year)

    write_json(OUTPUT_DIR / "bios.json", bios)
    write_json(OUTPUT_DIR / "seasons.json", seasons)
    write_json(OUTPUT_DIR / "metadata.json", metadata)

    print()
    print("Done.")
    print(f"  Players:      {metadata['playerCount']}")
    print(f"  Season rows:  {metadata['seasonRowCount']}")
    print(f"  Seasons:      {metadata['seasonCount']} ({metadata['seasons'][0]} .. {metadata['seasons'][-1]})")
    if metadata.get("historicalSeasonCount"):
        print(f"  Historical:   {metadata['historicalSeasonCount']} seasons (through 1995-96)")
        print(f"  Modern:       {metadata['modernSeasonCount']} seasons (1996-97+)")
    print(f"  Wrote:        {OUTPUT_DIR / 'bios.json'}")
    print(f"                {OUTPUT_DIR / 'seasons.json'}")
    print(f"                {OUTPUT_DIR / 'metadata.json'}")


if __name__ == "__main__":
    main()
