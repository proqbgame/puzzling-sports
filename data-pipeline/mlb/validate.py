"""Validate MLB pipeline output JSON files."""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
OUTPUT_DIR = ROOT / "data" / "mlb"

BIO_KEYS = (
    "id",
    "name",
    "mlbamId",
    "espnId",
    "college",
    "draftPick",
    "draftRound",
    "draftYear",
    "undrafted",
    "seasonsPlayed",
    "everMvp",
    "everAllStar",
    "everCyYoung",
    "everSilverSlugger",
    "everGoldGlove",
    "everWsMvp",
    "everChampion",
)

SEASON_KEYS = (
    "playerId",
    "season",
    "team",
    "position",
    "games",
    "ab",
    "hits",
    "hr",
    "rbi",
    "sb",
    "avg",
    "so",
    "w",
    "ip",
    "era",
    "honors",
)

HONOR_KEYS = (
    "mvp",
    "allStar",
    "cyYoung",
    "silverSlugger",
    "goldGlove",
    "wsMvp",
    "champion",
)
ALLOWED_POSITIONS = {"P", "H"}


def main() -> None:
    bios_path = OUTPUT_DIR / "bios.json"
    seasons_path = OUTPUT_DIR / "seasons.json"
    metadata_path = OUTPUT_DIR / "metadata.json"
    if not bios_path.exists() or not seasons_path.exists():
        print("No MLB output found yet.")
        print(f"  Expected: {bios_path}")
        print("Run: python build.py")
        sys.exit(1)

    bios = json.loads(bios_path.read_text(encoding="utf-8"))
    seasons = json.loads(seasons_path.read_text(encoding="utf-8"))
    assert isinstance(bios, dict) and bios
    assert isinstance(seasons, list) and seasons

    sample_bio = next(iter(bios.values()))
    for key in BIO_KEYS:
        assert key in sample_bio, f"bio missing key: {key}"

    sample_season = seasons[0]
    for key in SEASON_KEYS:
        assert key in sample_season, f"season missing key: {key}"
    for honor in HONOR_KEYS:
        assert honor in sample_season["honors"], f"honors missing: {honor}"

    orphan = [row for row in seasons if row["playerId"] not in bios]
    assert not orphan, f"{len(orphan)} season rows reference unknown player IDs"

    seen: set[tuple[str, str, str]] = set()
    for row in seasons:
        key = (row["playerId"], str(row["season"]), row["position"])
        assert key not in seen, f"duplicate player-season-position {key}"
        seen.add(key)
        assert row.get("position") in ALLOWED_POSITIONS
        assert isinstance(row["games"], int) and row["games"] >= 1
        assert isinstance(row["team"], str) and row["team"]

    hitters = [row for row in seasons if row["position"] == "H"]
    pitchers = [row for row in seasons if row["position"] == "P"]
    assert hitters and pitchers

    trout = next(
        (
            row
            for row in hitters
            if row["season"] == "2019"
            and "Trout" in bios.get(row["playerId"], {}).get("name", "")
        ),
        None,
    )
    if trout:
        assert trout["hr"] >= 40, f"Trout 2019 HR unexpectedly low ({trout['hr']})"

    kershaw = next(
        (
            row
            for row in pitchers
            if row["season"] == "2014"
            and "Kershaw" in bios.get(row["playerId"], {}).get("name", "")
        ),
        None,
    )
    if kershaw:
        assert kershaw["so"] >= 200, f"Kershaw 2014 SO unexpectedly low ({kershaw['so']})"
        assert 0 < kershaw["era"] <= 2.0, f"Kershaw 2014 ERA unexpected ({kershaw['era']})"

    judge = next(
        (
            row
            for row in hitters
            if row["season"] == "2022"
            and "Aaron Judge" in bios.get(row["playerId"], {}).get("name", "")
        ),
        None,
    )
    assert judge is not None, "Aaron Judge 2022 missing — Lahman source is stale"
    assert judge["hr"] >= 60, f"Judge 2022 HR unexpectedly low ({judge['hr']})"

    years = sorted({int(row["season"]) for row in seasons})
    assert years[-1] >= 2025, f"Latest season is {years[-1]}, expected 2025+"

    metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
    assert metadata.get("sport") == "mlb"
    assert metadata.get("playerCount") == len(bios)
    assert metadata.get("seasonRowCount") == len(seasons)

    print("Validation passed (mlb).")
    print(f"  Players:       {len(bios)}")
    print(f"  Season rows:   {len(seasons)}")
    print(f"  Hitter rows:   {len(hitters)}")
    print(f"  Pitcher rows:  {len(pitchers)}")
    print(f"  Year range:    {years[0]}–{years[-1]}")


if __name__ == "__main__":
    main()
