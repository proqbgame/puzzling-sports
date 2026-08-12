#!/usr/bin/env python3
"""
Build NFL player data for Puzzling Sports.

Usage (from the data-pipeline/nfl folder, venv active):
  python build.py --skip-historical                 # modern QB+WR+RB 1999→current + awards
  python build.py --modern                          # same
  python build.py --skip-historical --skip-awards   # stats only, empty honors
  python build.py --sample --skip-awards            # last 3 seasons only
  python build.py --spike                           # ~10 QBs, 2022–2023

Requirements:
  pip install -r requirements.txt

Output:
  ../../data/nfl/bios.json
  ../../data/nfl/seasons.json
  ../../data/nfl/metadata.json
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from config import (
    CACHE_DIR,
    FIRST_SEASON_YEAR,
    LAST_SEASON_YEAR,
    MODERN_STATS_START_YEAR,
    OUTPUT_DIR,
    SPORT,
)
from fetch_awards import fetch_awards_for_seasons, honor_coverage_stats
from fetch_modern import fetch_modern_season_rows
from merge import build_bios_from_rows, build_metadata, build_seasons_from_rows
from utils import current_season_start_year, write_json


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Build NFL data for Puzzling Sports")
    parser.add_argument(
        "--spike",
        action="store_true",
        help="Run spike_sample.py (~10 modern QBs, 2022-2023)",
    )
    parser.add_argument(
        "--sample",
        action="store_true",
        help="Fetch only the 3 most recent seasons",
    )
    parser.add_argument(
        "--modern",
        action="store_true",
        help=f"Modern era only ({MODERN_STATS_START_YEAR}→current); default when historical skipped",
    )
    parser.add_argument(
        "--refresh-all",
        action="store_true",
        help="Ignore cached responses and re-fetch everything",
    )
    parser.add_argument(
        "--skip-awards",
        action="store_true",
        help="Skip awards (honors will be empty)",
    )
    parser.add_argument(
        "--skip-historical",
        action="store_true",
        help=f"Skip pre-{MODERN_STATS_START_YEAR} historical stats",
    )
    parser.add_argument(
        "--first-year",
        type=int,
        default=FIRST_SEASON_YEAR,
        help=f"First season year (default: {FIRST_SEASON_YEAR})",
    )
    parser.add_argument(
        "--last-year",
        type=int,
        default=LAST_SEASON_YEAR,
        help="Last season year (default: current NFL season)",
    )
    return parser.parse_args()


def _spot_check(bios: dict, seasons: list) -> None:
    def _rows_for(name_fragment: str) -> list[dict]:
        return [
            row
            for row in seasons
            if name_fragment in bios.get(row["playerId"], {}).get("name", "")
        ]

    def _honor_years(rows: list[dict], honor: str) -> list[str]:
        return sorted(r["season"] for r in rows if (r.get("honors") or {}).get(honor))

    qb_rows = [r for r in seasons if r.get("position") == "QB"]
    wr_rows = [r for r in seasons if r.get("position") == "WR"]
    rb_rows = [r for r in seasons if r.get("position") == "RB"]
    qb_players = {r["playerId"] for r in qb_rows}
    wr_players = {r["playerId"] for r in wr_rows}
    rb_players = {r["playerId"] for r in rb_rows}
    print()
    print(
        f"Position mix — QB: {len(qb_players)} players / {len(qb_rows)} seasons; "
        f"WR: {len(wr_players)} players / {len(wr_rows)} seasons; "
        f"RB: {len(rb_players)} players / {len(rb_rows)} seasons"
    )

    mahomes_rows = _rows_for("Mahomes")
    mahomes_2023 = next((r for r in mahomes_rows if r["season"] == "2023"), None)
    if mahomes_2023:
        name = bios[mahomes_2023["playerId"]]["name"]
        bio = bios[mahomes_2023["playerId"]]
        print()
        print(f"Spot-check — {name} 2023 ({mahomes_2023.get('position')}):")
        print(f"  team={mahomes_2023['team']}  games={mahomes_2023['games']}")
        print(
            f"  passYds={mahomes_2023['passYds']}  passTd={mahomes_2023['passTd']}"
            f"  INT={mahomes_2023['interceptions']}"
        )
        print(
            f"  cmp/att={mahomes_2023['completions']}/{mahomes_2023['attempts']}"
            f"  rushYds={mahomes_2023['rushYds']}"
        )
        print(f"  honors={mahomes_2023.get('honors')}")
        print(
            f"  career: everMvp={bio.get('everMvp')} everAllPro={bio.get('everAllPro')} "
            f"everChampion={bio.get('everChampion')} everSbMvp={bio.get('everSbMvp')} "
            f"everProBowl={bio.get('everProBowl')}"
        )
        print(f"  MVP seasons: {_honor_years(mahomes_rows, 'mvp')}")
        print(f"  All-Pro seasons: {_honor_years(mahomes_rows, 'allPro')}")
        print(f"  Champion seasons: {_honor_years(mahomes_rows, 'champion')}")
        print(f"  SB MVP seasons: {_honor_years(mahomes_rows, 'sbMvp')}")
    else:
        print()
        print("Note: Mahomes 2023 row not found.")

    brady = next(
        (b for b in bios.values() if b.get("name", "") == "Tom Brady"),
        None,
    )
    if brady is None:
        brady = next(
            (b for b in bios.values() if b.get("name", "").startswith("Tom Brady")),
            None,
        )
    if brady:
        brady_rows = [r for r in seasons if r["playerId"] == brady["id"]]
        print(
            f"Spot-check — {brady['name']}: seasonsPlayed={brady['seasonsPlayed']} id={brady['id']}"
        )
        print(
            f"  everChampion={brady.get('everChampion')} everSbMvp={brady.get('everSbMvp')} "
            f"everMvp={brady.get('everMvp')} everProBowl={brady.get('everProBowl')}"
        )
        print(f"  Champion seasons: {_honor_years(brady_rows, 'champion')}")
        print(f"  SB MVP seasons: {_honor_years(brady_rows, 'sbMvp')}")
    else:
        print("Note: Tom Brady not found in bios.")

    jj_rows = _rows_for("Justin Jefferson")
    jj_2022 = next((r for r in jj_rows if r["season"] == "2022"), None)
    if jj_2022:
        name = bios[jj_2022["playerId"]]["name"]
        bio = bios[jj_2022["playerId"]]
        print()
        print(f"Spot-check — {name} 2022 ({jj_2022.get('position')}):")
        print(f"  team={jj_2022['team']}  games={jj_2022['games']}")
        print(
            f"  rec={jj_2022.get('receptions')}  targets={jj_2022.get('targets')} "
            f"recYds={jj_2022.get('recYds')}  recTd={jj_2022.get('recTd')}"
        )
        print(f"  honors={jj_2022.get('honors')}")
        print(
            f"  career: everAllPro={bio.get('everAllPro')} "
            f"everProBowl={bio.get('everProBowl')} "
            f"everChampion={bio.get('everChampion')}"
        )
        print(f"  All-Pro seasons: {_honor_years(jj_rows, 'allPro')}")
    else:
        print()
        print("Note: Justin Jefferson 2022 row not found.")

    henry_rows = _rows_for("Derrick Henry")
    henry_2020 = next((r for r in henry_rows if r["season"] == "2020"), None)
    if henry_2020:
        name = bios[henry_2020["playerId"]]["name"]
        bio = bios[henry_2020["playerId"]]
        print()
        print(f"Spot-check — {name} 2020 ({henry_2020.get('position')}):")
        print(f"  team={henry_2020['team']}  games={henry_2020['games']}")
        print(
            f"  rushYds={henry_2020.get('rushYds')}  rushTd={henry_2020.get('rushTd')} "
            f"rec={henry_2020.get('receptions')}  recYds={henry_2020.get('recYds')}"
        )
        print(f"  honors={henry_2020.get('honors')}")
        print(
            f"  career: everAllPro={bio.get('everAllPro')} "
            f"everProBowl={bio.get('everProBowl')} "
            f"everChampion={bio.get('everChampion')}"
        )
        print(f"  All-Pro seasons: {_honor_years(henry_rows, 'allPro')}")
    else:
        print()
        print("Note: Derrick Henry 2020 row not found.")

    rice = next(
        (b for b in bios.values() if b.get("name", "") == "Jerry Rice"),
        None,
    )
    if rice:
        rice_rows = [r for r in seasons if r["playerId"] == rice["id"]]
        rice_1999 = next((r for r in rice_rows if r["season"] == "1999"), None)
        print(
            f"Spot-check — {rice['name']}: seasonsPlayed={rice['seasonsPlayed']} "
            f"id={rice['id']} (modern window only)"
        )
        if rice_1999:
            print(
                f"  1999: team={rice_1999['team']} rec={rice_1999.get('receptions')} "
                f"recYds={rice_1999.get('recYds')} honors={rice_1999.get('honors')}"
            )
    else:
        print("Note: Jerry Rice not found in modern WR bios (may be pre-volume filter).")

    counts = honor_coverage_stats(seasons)
    print()
    print("Honor coverage (season rows True):")
    for key, count in counts.items():
        print(f"  {key}: {count}")


def main() -> None:
    args = parse_args()

    if args.spike:
        from spike_sample import main as spike_main

        spike_main()
        return

    last_year = args.last_year or current_season_start_year()
    first_year = args.first_year

    skip_historical = args.skip_historical or args.sample or args.modern
    # Historical fetcher not implemented yet — always modern for this pass.
    if not skip_historical:
        print(
            f"Note: pre-{MODERN_STATS_START_YEAR} historical stats are not implemented yet; "
            f"using modern era from {MODERN_STATS_START_YEAR}."
        )
        skip_historical = True

    if args.sample:
        first_year = max(first_year, last_year - 2)

    if skip_historical or args.modern:
        first_year = max(first_year, MODERN_STATS_START_YEAR)

    print("Puzzling Sports — NFL data pipeline", flush=True)
    print(f"Sport: {SPORT}")
    print(f"Season range: {first_year} -> {last_year}")
    print(f"Modern stats from: {MODERN_STATS_START_YEAR}")
    if args.skip_awards:
        print("Awards: skipped (honors empty)")
    else:
        print("Awards: enabled (seed + Super Bowl roster join)")
    if skip_historical:
        print(f"Historical (pre-{MODERN_STATS_START_YEAR}): skipped")
    print(f"Cache: {CACHE_DIR}")
    print(f"Output: {OUTPUT_DIR}")
    print()

    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    refresh = bool(args.refresh_all)
    if refresh:
        print("(Note: --refresh-all re-fetches awards cache; nflreadpy uses its own cache.)")
        print()

    print("1/5 Fetching modern QB + WR + RB season stats...")
    raw_rows, player_info = fetch_modern_season_rows(
        first_year,
        last_year,
        skip_awards=args.skip_awards,
    )
    print(f"    Raw season rows: {len(raw_rows)}")

    honors_by_player: dict = {}
    awards_loaded = False
    if args.skip_awards:
        print("2/5 Skipping awards (--skip-awards)")
    else:
        print("2/5 Fetching / merging awards...")
        honors_by_player = fetch_awards_for_seasons(
            first_year,
            last_year,
            refresh=refresh,
        )
        awards_loaded = True
        print(f"    Players with honors: {len(honors_by_player)}")

    print("3/5 Building seasons.json...")
    seasons = build_seasons_from_rows(raw_rows, honors_by_player)
    print(f"    Season rows: {len(seasons)}")

    print("4/5 Building bios.json...")
    bios = build_bios_from_rows(raw_rows, player_info, honors_by_player)
    print(f"    Players: {len(bios)}")

    print("5/5 Writing JSON + metadata...")
    metadata = build_metadata(
        bios,
        seasons,
        first_year,
        last_year,
        awards_loaded=awards_loaded,
    )

    write_json(OUTPUT_DIR / "bios.json", bios)
    write_json(OUTPUT_DIR / "seasons.json", seasons)
    write_json(OUTPUT_DIR / "metadata.json", metadata)

    print()
    print("Done.")
    print(f"  Players:     {len(bios)}")
    print(f"  Season rows: {len(seasons)}")
    print(f"  Years:       {first_year}–{last_year}")
    print(f"  Wrote:       {OUTPUT_DIR / 'bios.json'}")
    print(f"               {OUTPUT_DIR / 'seasons.json'}")
    print(f"               {OUTPUT_DIR / 'metadata.json'}")

    _spot_check(bios, seasons)


if __name__ == "__main__":
    main()
