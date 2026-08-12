"""Enrich data/nfl/bios.json with espnId from nflverse players.

Preferred long-term path: rebuild via build.py (espnId is now part of bios).
This script patches existing bios without a full stats rebuild.

Usage (from data-pipeline/nfl with venv active):
  python scripts/enrich_espn_ids.py
Then from repo root: npm run sync:data
"""
from __future__ import annotations

import json
from pathlib import Path

import nflreadpy as nfl

REPO_ROOT = Path(__file__).resolve().parents[3]
BIOS_PATH = REPO_ROOT / "data" / "nfl" / "bios.json"


def _normalize_espn(espn) -> str | None:
    if espn is None:
        return None
    if isinstance(espn, float):
        if str(espn) == "nan":
            return None
        return str(int(espn))
    s = str(espn).strip()
    if not s or s.lower() == "nan":
        return None
    if s.endswith(".0"):
        try:
            return str(int(float(s)))
        except ValueError:
            return s
    return s


def main() -> None:
    with BIOS_PATH.open(encoding="utf-8") as f:
        bios = json.load(f)

    players = nfl.load_players()
    df = players.to_pandas() if hasattr(players, "to_pandas") else players

    gsis_to_espn: dict[str, str | None] = {}
    for _, row in df.iterrows():
        gsis = row.get("gsis_id")
        if gsis is None:
            continue
        gsis = str(gsis).strip()
        if not gsis or gsis.lower() == "nan":
            continue
        gsis_to_espn[gsis] = _normalize_espn(row.get("espn_id"))

    with_id = 0
    without_id = 0
    for gsis_id, bio in bios.items():
        espn_id = gsis_to_espn.get(gsis_id)
        bio["espnId"] = espn_id
        if espn_id:
            with_id += 1
        else:
            without_id += 1

    with BIOS_PATH.open("w", encoding="utf-8", newline="\n") as f:
        json.dump(bios, f, indent=2, ensure_ascii=False)
        f.write("\n")

    total = len(bios)
    print(f"total players: {total}")
    print(f"with espnId: {with_id}")
    print(f"without espnId: {without_id}")

    stars = ["Patrick Mahomes", "Justin Jefferson", "Derrick Henry"]
    by_name = {}
    for gid, b in bios.items():
        by_name.setdefault(b.get("name"), []).append((gid, b))

    for name in stars:
        matches = by_name.get(name) or []
        if not matches:
            print(f"{name}: NOT FOUND in bios")
            continue
        gid, b = matches[0]
        espn = b.get("espnId")
        url = f"https://a.espncdn.com/i/headshots/nfl/players/full/{espn}.png" if espn else None
        print(f"{name}: gsis={gid} espnId={espn} url={url}")


if __name__ == "__main__":
    main()
