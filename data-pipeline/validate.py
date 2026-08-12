"""Validate pipeline output JSON files."""

from __future__ import annotations

import json
import sys
from pathlib import Path

from fetch_awards import HONOR_FIELDS

ROOT = Path(__file__).resolve().parent.parent
OUTPUT_DIR = ROOT / "data" / "nba"


def main() -> None:
    bios_path = OUTPUT_DIR / "bios.json"
    seasons_path = OUTPUT_DIR / "seasons.json"
    metadata_path = OUTPUT_DIR / "metadata.json"

    for path in (bios_path, seasons_path, metadata_path):
        if not path.exists():
            print(f"Missing: {path}")
            sys.exit(1)

    bios = json.loads(bios_path.read_text(encoding="utf-8"))
    seasons = json.loads(seasons_path.read_text(encoding="utf-8"))
    metadata = json.loads(metadata_path.read_text(encoding="utf-8"))

    assert isinstance(bios, dict) and bios, "bios.json must be a non-empty object"
    assert isinstance(seasons, list) and seasons, "seasons.json must be a non-empty array"

    sample_bio = next(iter(bios.values()))
    for key in ("id", "name", "college", "draftPick", "seasonsPlayed", "everAllStar"):
        assert key in sample_bio, f"bio missing key: {key}"

    sample_season = seasons[0]
    for key in ("playerId", "season", "ppg", "rpg", "apg", "blk", "honors"):
        assert key in sample_season, f"season row missing key: {key}"

    for honor in HONOR_FIELDS:
        assert honor in sample_season["honors"], f"honors missing: {honor}"

    orphan_seasons = [s for s in seasons if s["playerId"] not in bios]
    if orphan_seasons:
        print(f"Warning: {len(orphan_seasons)} season rows reference unknown player IDs")

    print("Validation passed.")
    print(f"  Players:     {metadata.get('playerCount', len(bios))}")
    print(f"  Season rows: {metadata.get('seasonRowCount', len(seasons))}")


if __name__ == "__main__":
    main()
