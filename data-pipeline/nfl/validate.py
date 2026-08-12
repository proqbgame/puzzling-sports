"""Validate NFL pipeline output JSON files (spike or full build)."""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
OUTPUT_DIR = ROOT / "data" / "nfl"
SPIKE_DIR = OUTPUT_DIR / "_spike"

BIO_KEYS = (
    "id",
    "name",
    "espnId",
    "college",
    "draftPick",
    "draftRound",
    "draftYear",
    "undrafted",
    "seasonsPlayed",
    "everProBowl",
    "everMvp",
    "everAllPro",
    "everSbMvp",
    "everChampion",
)

SEASON_KEYS = (
    "playerId",
    "season",
    "team",
    "position",
    "games",
    "passYds",
    "passTd",
    "interceptions",
    "completions",
    "attempts",
    "rushYds",
    "rushTd",
    "receptions",
    "targets",
    "recYds",
    "recTd",
    "honors",
)

RATE_KEYS = ("passYpg", "rushYpg", "completionPct", "recYpg")

HONOR_KEYS = ("mvp", "proBowl", "allPro", "sbMvp", "champion")
ALLOWED_POSITIONS = {"QB", "WR", "RB"}


def _validate_pair(
    bios_path: Path,
    seasons_path: Path,
    label: str,
    *,
    metadata_path: Path | None = None,
    require_rate_stats: bool = False,
    require_multi_position: bool = False,
) -> None:
    if not bios_path.exists():
        print(f"Missing: {bios_path}")
        sys.exit(1)
    if not seasons_path.exists():
        print(f"Missing: {seasons_path}")
        sys.exit(1)

    bios = json.loads(bios_path.read_text(encoding="utf-8"))
    seasons = json.loads(seasons_path.read_text(encoding="utf-8"))

    assert isinstance(bios, dict) and bios, f"{label} bios.json must be a non-empty object"
    assert isinstance(seasons, list) and seasons, f"{label} seasons.json must be a non-empty array"

    sample_bio = next(iter(bios.values()))
    for key in BIO_KEYS:
        assert key in sample_bio, f"{label} bio missing key: {key}"

    sample_season = seasons[0]
    for key in SEASON_KEYS:
        assert key in sample_season, f"{label} season row missing key: {key}"

    if require_rate_stats:
        for key in RATE_KEYS:
            assert key in sample_season, f"{label} season row missing rate key: {key}"

    for honor in HONOR_KEYS:
        assert honor in sample_season["honors"], f"{label} honors missing: {honor}"

    orphan_seasons = [s for s in seasons if s["playerId"] not in bios]
    assert not orphan_seasons, (
        f"{label}: {len(orphan_seasons)} season rows reference unknown player IDs"
    )

    bio_ids = set(bios.keys())
    season_ids = {s["playerId"] for s in seasons}
    bios_without_seasons = bio_ids - season_ids
    assert not bios_without_seasons, (
        f"{label}: {len(bios_without_seasons)} bios have no season rows"
    )

    # Bios map keys must equal bio.id and match season playerIds.
    for pid, bio in bios.items():
        assert bio.get("id") == pid, f"{label}: bio key {pid!r} != bio.id {bio.get('id')!r}"

    # One row per player-season
    seen: set[tuple[str, str]] = set()
    for row in seasons:
        key = (row["playerId"], str(row["season"]))
        assert key not in seen, f"{label}: duplicate player-season {key}"
        seen.add(key)
        assert isinstance(row["games"], int) and row["games"] >= 1, (
            f"{label}: invalid games for {key}"
        )
        assert isinstance(row["team"], str) and row["team"], f"{label}: empty team for {key}"
        position = row.get("position")
        assert position in ALLOWED_POSITIONS, (
            f"{label}: invalid position {position!r} for {key}"
        )

    qb_rows = [r for r in seasons if r.get("position") == "QB"]
    wr_rows = [r for r in seasons if r.get("position") == "WR"]
    rb_rows = [r for r in seasons if r.get("position") == "RB"]
    if require_multi_position:
        assert qb_rows, f"{label}: expected QB season rows"
        assert wr_rows, f"{label}: expected WR season rows"
        assert rb_rows, f"{label}: expected RB season rows"

    # Spot-check known modern seasons when present in full builds.
    if require_multi_position:
        jj = next(
            (
                r
                for r in wr_rows
                if r["season"] == "2022"
                and "Jefferson" in bios.get(r["playerId"], {}).get("name", "")
            ),
            None,
        )
        if jj:
            assert jj.get("recYds", 0) >= 1000, (
                f"{label}: Justin Jefferson 2022 recYds unexpectedly low ({jj.get('recYds')})"
            )
            assert jj.get("receptions", 0) >= 100, (
                f"{label}: Justin Jefferson 2022 receptions unexpectedly low"
            )

        mahomes = next(
            (
                r
                for r in qb_rows
                if r["season"] == "2023"
                and "Mahomes" in bios.get(r["playerId"], {}).get("name", "")
            ),
            None,
        )
        if mahomes:
            assert mahomes.get("passYds", 0) >= 4000, (
                f"{label}: Mahomes 2023 passYds unexpectedly low"
            )

    if metadata_path is not None:
        assert metadata_path.exists(), f"Missing: {metadata_path}"
        metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
        assert metadata.get("sport") == "nfl", f"{label} metadata.sport must be nfl"
        assert metadata.get("playerCount") == len(bios), (
            f"{label} metadata.playerCount mismatch"
        )
        assert metadata.get("seasonRowCount") == len(seasons), (
            f"{label} metadata.seasonRowCount mismatch"
        )
        notes = metadata.get("statsNotes") or {}
        assert "multiTeamSeasons" in notes, f"{label} metadata missing multiTeamSeasons note"
        assert "positionScope" in notes, f"{label} metadata missing positionScope note"

    # Spot-check season labels look like NFL years ("2023"), not NBA ("2023-24").
    for row in seasons[:50]:
        assert "-" not in str(row["season"]), (
            f"{label}: unexpected NBA-style season label {row['season']!r}"
        )

    print(f"Validation passed ({label}).")
    print(f"  Players:     {len(bios)}")
    print(f"  Season rows: {len(seasons)}")
    print(f"  QB rows:     {len(qb_rows)} ({len({r['playerId'] for r in qb_rows})} players)")
    print(f"  WR rows:     {len(wr_rows)} ({len({r['playerId'] for r in wr_rows})} players)")
    print(f"  RB rows:     {len(rb_rows)} ({len({r['playerId'] for r in rb_rows})} players)")
    years = sorted({int(s["season"]) for s in seasons})
    if years:
        print(f"  Year range:  {years[0]}–{years[-1]}")


def main() -> None:
    spike_bios = SPIKE_DIR / "bios.json"
    spike_seasons = SPIKE_DIR / "seasons.json"
    full_bios = OUTPUT_DIR / "bios.json"
    full_seasons = OUTPUT_DIR / "seasons.json"
    full_metadata = OUTPUT_DIR / "metadata.json"

    checked = False
    if spike_bios.exists() and spike_seasons.exists():
        _validate_pair(spike_bios, spike_seasons, "spike")
        checked = True

    if full_bios.exists() and full_seasons.exists():
        _validate_pair(
            full_bios,
            full_seasons,
            "full",
            metadata_path=full_metadata,
            require_rate_stats=True,
            require_multi_position=True,
        )
        checked = True

    if not checked:
        print("No NFL output found yet.")
        print(f"  Expected spike: {spike_bios}")
        print(f"  Or full build:  {full_bios}")
        print("Run: python build.py --skip-historical")
        print("  (add --skip-awards to leave honors empty)")
        sys.exit(1)


if __name__ == "__main__":
    main()
