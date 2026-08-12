#!/usr/bin/env python3
"""
Small NFL data spike: ~10 modern QBs for 2022–2023.

Usage (from data-pipeline/nfl with venv active):
  pip install -r requirements.txt
  python spike_sample.py

Writes:
  ../../data/nfl/_spike/bios.json
  ../../data/nfl/_spike/seasons.json
"""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import nflreadpy as nfl
import pandas as pd

from config import SPIKE_OUTPUT_DIR
from fetch_modern import player_info_map
from merge import build_bios_from_rows, build_seasons_from_rows
from utils import write_json

SPIKE_SEASONS = [2022, 2023]

# Household-name modern QBs for a quick smoke test.
SPIKE_QB_NAME_FRAGMENTS = [
    "Mahomes",
    "Allen",
    "Burrow",
    "Hurts",
    "Jackson",
    "Herbert",
    "Murray",
    "Prescott",
    "Stafford",
    "Goff",
]


def _to_pandas(frame) -> pd.DataFrame:
    if isinstance(frame, pd.DataFrame):
        return frame
    return frame.to_pandas()


def _first_present(df: pd.DataFrame, candidates: list[str]) -> str | None:
    for col in candidates:
        if col in df.columns:
            return col
    return None


def _pick_spike_player_ids(stats: pd.DataFrame, id_col: str, name_col: str) -> list[str]:
    """Match ~10 well-known QBs by last-name fragment; fall back to top passers."""
    names = stats[name_col].fillna("").astype(str)
    matched_ids: list[str] = []
    used: set[str] = set()

    for fragment in SPIKE_QB_NAME_FRAGMENTS:
        hits = stats.loc[names.str.contains(fragment, case=False, regex=False)]
        if hits.empty:
            continue
        # Prefer the highest-attempt row for this name fragment.
        attempt_col = _first_present(hits, ["attempts", "passing_attempts"])
        ordered = hits.sort_values(attempt_col, ascending=False) if attempt_col else hits
        for player_id in ordered[id_col].astype(str):
            if player_id not in used:
                matched_ids.append(player_id)
                used.add(player_id)
                break
        if len(matched_ids) >= 10:
            break

    if len(matched_ids) < 8:
        attempt_col = _first_present(stats, ["attempts", "passing_attempts"])
        fallback = stats.sort_values(attempt_col, ascending=False) if attempt_col else stats
        for player_id in fallback[id_col].astype(str):
            if player_id not in used:
                matched_ids.append(player_id)
                used.add(player_id)
            if len(matched_ids) >= 10:
                break

    return matched_ids[:10]


def main() -> None:
    print("Puzzling Sports — NFL spike sample", flush=True)
    print(f"Seasons: {SPIKE_SEASONS}")
    print()

    print("1/4 Loading player stats (reg season)...")
    stats = _to_pandas(nfl.load_player_stats(SPIKE_SEASONS, summary_level="reg"))
    print(f"    Stat rows: {len(stats)}")

    print("2/4 Loading rosters + filtering QBs...")
    rosters = _to_pandas(nfl.load_rosters(SPIKE_SEASONS))
    position_col = _first_present(rosters, ["position", "pos"])
    if not position_col:
        raise RuntimeError("rosters missing position column")
    qb_rosters = rosters[rosters[position_col].astype(str).str.upper() == "QB"].copy()
    roster_id_col = _first_present(qb_rosters, ["gsis_id", "player_id", "gsisId"])
    if not roster_id_col:
        raise RuntimeError("rosters missing gsis/player id column")
    qb_ids = set(qb_rosters[roster_id_col].dropna().astype(str))
    print(f"    Unique roster QBs: {len(qb_ids)}")

    stats_id_col = _first_present(stats, ["player_id", "gsis_id", "gsisId"])
    if not stats_id_col:
        raise RuntimeError("player stats missing player_id column")
    stats["player_id_str"] = stats[stats_id_col].astype(str)
    qb_stats = stats[stats["player_id_str"].isin(qb_ids)].copy()

    # Also keep players with meaningful passing volume even if position is odd.
    attempt_col = _first_present(stats, ["attempts", "passing_attempts"])
    if attempt_col:
        passers = stats[stats[attempt_col].fillna(0) >= 50].copy()
        qb_stats = pd.concat([qb_stats, passers], ignore_index=True).drop_duplicates(
            subset=["player_id_str", "season"] if "season" in qb_stats.columns else ["player_id_str"]
        )

    name_col = _first_present(
        qb_stats,
        ["player_display_name", "player_name", "display_name", "full_name"],
    )
    if not name_col:
        raise RuntimeError("player stats missing name column")

    spike_ids = _pick_spike_player_ids(qb_stats, "player_id_str", name_col)
    spike_stats = qb_stats[qb_stats["player_id_str"].isin(spike_ids)].copy()
    print(f"    Spike QBs: {len(spike_ids)}")

    print("3/4 Loading players for college / draft...")
    players = _to_pandas(nfl.load_players())
    player_info = player_info_map(players)
    print(f"    Player bios available: {len(player_info)}")

    team_col = _first_present(spike_stats, ["recent_team", "team", "team_abbr"])
    games_col = _first_present(spike_stats, ["games", "gp"])
    season_col = _first_present(spike_stats, ["season"])
    if not season_col or not team_col or not games_col:
        raise RuntimeError("player stats missing season/team/games columns")

    pass_yds_col = _first_present(spike_stats, ["passing_yards", "pass_yards", "passYds"])
    pass_td_col = _first_present(spike_stats, ["passing_tds", "pass_tds", "passTd"])
    int_col = _first_present(spike_stats, ["interceptions", "passing_interceptions", "ints"])
    cmp_col = _first_present(spike_stats, ["completions", "passing_completions"])
    att_col = _first_present(spike_stats, ["attempts", "passing_attempts"])
    rush_yds_col = _first_present(spike_stats, ["rushing_yards", "rush_yards", "rushYds"])
    rush_td_col = _first_present(spike_stats, ["rushing_tds", "rush_tds", "rushTd"])

    raw_rows: list[dict] = []
    for _, row in spike_stats.iterrows():
        raw_rows.append(
            {
                "playerId": str(row["player_id_str"]),
                "playerName": row.get(name_col),
                "season": int(row[season_col]),
                "team": row.get(team_col),
                "position": "QB",
                "games": row.get(games_col),
                "passYds": row.get(pass_yds_col) if pass_yds_col else 0,
                "passTd": row.get(pass_td_col) if pass_td_col else 0,
                "interceptions": row.get(int_col) if int_col else 0,
                "completions": row.get(cmp_col) if cmp_col else 0,
                "attempts": row.get(att_col) if att_col else 0,
                "rushYds": row.get(rush_yds_col) if rush_yds_col else 0,
                "rushTd": row.get(rush_td_col) if rush_td_col else 0,
                "receptions": 0,
                "targets": 0,
                "recYds": 0,
                "recTd": 0,
            }
        )

    print("4/4 Writing spike JSON...")
    seasons = build_seasons_from_rows(raw_rows)
    bios = build_bios_from_rows(raw_rows, player_info)

    write_json(SPIKE_OUTPUT_DIR / "bios.json", bios)
    write_json(SPIKE_OUTPUT_DIR / "seasons.json", seasons)

    # Success summary — include Mahomes 2023 when present.
    print()
    print("Spike complete.")
    print(f"  Players:     {len(bios)}")
    print(f"  Season rows: {len(seasons)}")
    print(f"  Names:       {', '.join(sorted(b['name'] for b in bios.values()))}")
    print(f"  Wrote:       {SPIKE_OUTPUT_DIR / 'bios.json'}")
    print(f"               {SPIKE_OUTPUT_DIR / 'seasons.json'}")

    mahomes_2023 = next(
        (
            row
            for row in seasons
            if row["season"] == "2023"
            and bios.get(row["playerId"], {}).get("name", "").find("Mahomes") >= 0
        ),
        None,
    )
    if mahomes_2023:
        name = bios[mahomes_2023["playerId"]]["name"]
        print()
        print(f"Sample — {name} 2023:")
        print(f"  team={mahomes_2023['team']}  games={mahomes_2023['games']}")
        print(
            f"  passYds={mahomes_2023['passYds']}  passTd={mahomes_2023['passTd']}"
            f"  INT={mahomes_2023['interceptions']}"
        )
        print(
            f"  cmp/att={mahomes_2023['completions']}/{mahomes_2023['attempts']}"
            f"  rushYds={mahomes_2023['rushYds']}"
        )
    else:
        print()
        print("Note: Mahomes 2023 row not found — check name matching / data load.")


if __name__ == "__main__":
    main()
