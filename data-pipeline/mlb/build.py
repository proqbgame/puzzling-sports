#!/usr/bin/env python3
"""
Build MLB player data for Puzzling Sports (hitters + pitchers).

Usage (from data-pipeline/mlb, venv active):
  python build.py
  python build.py --first-year 1995 --last-year 2024

Output:
  ../../data/mlb/bios.json
  ../../data/mlb/seasons.json
  ../../data/mlb/metadata.json
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from config import FIRST_SEASON_YEAR, LAST_SEASON_YEAR, OUTPUT_DIR, SPORT
from fetch_lahman import fetch_mlb_season_rows
from lahman_local import clear_cache
from merge import build_bios_from_rows, build_metadata, build_seasons_from_rows
from utils import current_season_year, write_json


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Build MLB data for Puzzling Sports")
    parser.add_argument("--first-year", type=int, default=FIRST_SEASON_YEAR)
    parser.add_argument("--last-year", type=int, default=LAST_SEASON_YEAR)
    parser.add_argument(
        "--refresh",
        action="store_true",
        help="Clear cached Lahman CSVs and re-download",
    )
    return parser.parse_args()


def _spot_check(bios: dict, seasons: list) -> None:
    def rows_for(name_fragment: str) -> list[dict]:
        return [
            row
            for row in seasons
            if name_fragment in bios.get(row["playerId"], {}).get("name", "")
        ]

    hitters = [row for row in seasons if row["position"] == "H"]
    pitchers = [row for row in seasons if row["position"] == "P"]
    print()
    print(
        f"Position mix — H: {len({r['playerId'] for r in hitters})} players / {len(hitters)} seasons; "
        f"P: {len({r['playerId'] for r in pitchers})} players / {len(pitchers)} seasons"
    )

    trout = next((row for row in rows_for("Mike Trout") if row["season"] == "2019"), None)
    if trout:
        bio = bios[trout["playerId"]]
        print()
        print(f"Spot-check — {bio['name']} 2019 ({trout['position']}):")
        print(f"  HR={trout['hr']} RBI={trout['rbi']} AVG={trout['avg']} SB={trout['sb']}")
        print(f"  honors={trout['honors']}")
        print(f"  college={bio.get('college')} mlbamId={bio.get('mlbamId')}")
    else:
        print("Note: Mike Trout 2019 not found.")

    kershaw = next(
        (row for row in rows_for("Clayton Kershaw") if row["season"] == "2014"),
        None,
    )
    if kershaw:
        bio = bios[kershaw["playerId"]]
        print()
        print(f"Spot-check — {bio['name']} 2014 ({kershaw['position']}):")
        print(f"  SO={kershaw['so']} W={kershaw['w']} IP={kershaw['ip']} ERA={kershaw['era']}")
        print(f"  honors={kershaw['honors']}")
    else:
        print("Note: Clayton Kershaw 2014 not found.")

    judge = next(
        (row for row in rows_for("Aaron Judge") if row["season"] == "2022"),
        None,
    )
    if judge:
        bio = bios[judge["playerId"]]
        print()
        print(f"Spot-check — {bio['name']} 2022 ({judge['position']}):")
        print(f"  HR={judge['hr']} RBI={judge['rbi']} AVG={judge['avg']} SB={judge['sb']}")
        print(f"  honors={judge['honors']}")
    else:
        print("Note: Aaron Judge 2022 not found.")

    ohtani_rows = [
        row
        for row in rows_for("Shohei Ohtani")
        if row["season"] in {"2023", "2024"}
    ]
    if ohtani_rows:
        print()
        print("Spot-check — Shohei Ohtani recent seasons:")
        for row in ohtani_rows:
            if row["position"] == "H":
                print(
                    f"  {row['season']} H: HR={row['hr']} RBI={row['rbi']} "
                    f"AVG={row['avg']} honors={row['honors']}"
                )
            else:
                print(
                    f"  {row['season']} P: SO={row['so']} W={row['w']} "
                    f"IP={row['ip']} ERA={row['era']} honors={row['honors']}"
                )
    else:
        print("Note: Shohei Ohtani 2023/2024 not found.")


def main() -> None:
    args = parse_args()
    last_year = args.last_year or current_season_year()
    first_year = args.first_year

    print("Puzzling Sports — MLB data pipeline", flush=True)
    print(f"Sport: {SPORT}")
    print(f"Season range: {first_year} -> {last_year}")
    print(f"Output: {OUTPUT_DIR}")
    print()

    if args.refresh:
        print("Clearing cached Lahman CSVs...")
        clear_cache()

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    print("1/4 Fetching Lahman batting + pitching + awards...")
    raw_rows, player_info = fetch_mlb_season_rows(first_year, last_year)
    print(f"    Raw season rows: {len(raw_rows)}")

    print("2/4 Building seasons.json...")
    seasons = build_seasons_from_rows(raw_rows)
    print(f"    Season rows: {len(seasons)}")

    print("3/4 Building bios.json...")
    bios = build_bios_from_rows(raw_rows, player_info)
    print(f"    Players: {len(bios)}")

    print("4/4 Writing JSON + metadata...")
    metadata = build_metadata(bios, seasons, first_year, last_year)
    write_json(OUTPUT_DIR / "bios.json", bios)
    write_json(OUTPUT_DIR / "seasons.json", seasons)
    write_json(OUTPUT_DIR / "metadata.json", metadata)

    print()
    print("Done.")
    print(f"  Players:     {len(bios)}")
    print(f"  Season rows: {len(seasons)}")
    print(f"  Years:       {metadata['firstSeasonYear']}–{metadata['lastSeasonYear']}")
    _spot_check(bios, seasons)


if __name__ == "__main__":
    main()
