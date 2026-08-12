"""
Clean proBowlWr seed: drop team names / noise; keep names that resolve to WR players.
Also fill missing 2013–2015 seasons with curated lists.
"""

from __future__ import annotations

import json
from pathlib import Path

import nflreadpy as nfl
import pandas as pd

from config import PIPELINE_DIR
from fetch_awards import NAME_ALIASES, _canonical_award_name, _player_name_index

SEED_PATH = PIPELINE_DIR / "awards_seed.json"

# Curated Pro Bowl WR selections for draft-format years where Wikipedia table
# parsing failed (NFL season year -> names).
MANUAL_SEASONS: dict[str, list[str]] = {
    # 2014 Pro Bowl (2013 season) — initial + drafted WRs
    "2013": [
        "A.J. Green",
        "Andre Johnson",
        "Josh Gordon",
        "Antonio Brown",
        "Demaryius Thomas",
        "Calvin Johnson",
        "Brandon Marshall",
        "Dez Bryant",
        "Alshon Jeffery",
        "Larry Fitzgerald",
        "DeSean Jackson",
    ],
    # 2015 Pro Bowl (2014 season)
    "2014": [
        "Antonio Brown",
        "A.J. Green",
        "T.Y. Hilton",
        "Jordy Nelson",
        "Odell Beckham Jr.",
        "Golden Tate",
        "Randall Cobb",
        "Emmanuel Sanders",
        "Julio Jones",
        "Dez Bryant",
        "Calvin Johnson",
        "Demaryius Thomas",
        "Jeremy Maclin",
    ],
    # 2016 Pro Bowl (2015 season)
    "2015": [
        "Odell Beckham Jr.",
        "Antonio Brown",
        "Amari Cooper",
        "A.J. Green",
        "T.Y. Hilton",
        "DeAndre Hopkins",
        "Julio Jones",
        "Allen Robinson",
        "Jarvis Landry",
        "Brandon Marshall",
        "Larry Fitzgerald",
        "Calvin Johnson",
    ],
}

# Common franchise tokens scraped from Wikipedia roster tables.
TEAM_TOKENS = {
    "indianapolis",
    "jacksonville",
    "n.y. jets",
    "ny jets",
    "new york jets",
    "oakland",
    "new england",
    "minnesota",
    "st. louis",
    "st louis",
    "carolina",
    "buffalo",
    "denver",
    "tennessee",
    "san diego",
    "kansas city",
    "miami",
    "baltimore",
    "pittsburgh",
    "cincinnati",
    "cleveland",
    "houston",
    "dallas",
    "philadelphia",
    "washington",
    "ny giants",
    "n.y. giants",
    "new york giants",
    "chicago",
    "detroit",
    "green bay",
    "atlanta",
    "new orleans",
    "tampa bay",
    "arizona",
    "san francisco",
    "seattle",
    "la rams",
    "los angeles rams",
    "la chargers",
    "los angeles chargers",
    "las vegas",
    "arizona cardinals",
}


def _to_pandas(frame) -> pd.DataFrame:
    if isinstance(frame, pd.DataFrame):
        return frame
    return frame.to_pandas()


def _looks_like_team(name: str) -> bool:
    low = name.strip().lower()
    if low in TEAM_TOKENS:
        return True
    # Single-token city-ish entries often are teams in older tables
    if " " not in low and low in {
        "indianapolis",
        "jacksonville",
        "oakland",
        "minnesota",
        "carolina",
        "buffalo",
        "denver",
        "tennessee",
        "miami",
        "baltimore",
        "pittsburgh",
        "cincinnati",
        "cleveland",
        "houston",
        "dallas",
        "philadelphia",
        "washington",
        "chicago",
        "detroit",
        "atlanta",
        "arizona",
        "seattle",
    }:
        return True
    return False


def _resolve_wr(name: str, index: dict[str, list[dict[str, str]]]) -> str | None:
    canon = _canonical_award_name(name)
    key = canon.lower()
    hits = index.get(key) or []
    wr_hits = [h for h in hits if (h.get("position") or "").upper() == "WR"]
    chosen = wr_hits[0] if wr_hits else (hits[0] if len(hits) == 1 else None)
    if not chosen and key in NAME_ALIASES:
        alias_key = NAME_ALIASES[key].lower()
        hits = index.get(alias_key) or []
        wr_hits = [h for h in hits if (h.get("position") or "").upper() == "WR"]
        chosen = wr_hits[0] if wr_hits else (hits[0] if len(hits) == 1 else None)
    return chosen["name"] if chosen else None


def main() -> None:
    seed = json.loads(SEED_PATH.read_text(encoding="utf-8"))
    players = _to_pandas(nfl.load_players())
    index = _player_name_index(players)

    cache_path = PIPELINE_DIR / "cache" / "awards" / "proBowlWr_wikipedia.json"
    raw: dict[str, list[str]] = {}
    if cache_path.exists():
        cache = json.loads(cache_path.read_text(encoding="utf-8"))
        raw = dict(cache.get("proBowlWr") or {})
    # Fall back to current seed for any seasons not in cache.
    for season, names in (seed.get("proBowlWr") or {}).items():
        raw.setdefault(season, names)
    for season, names in MANUAL_SEASONS.items():
        raw[season] = names

    cleaned: dict[str, list[str]] = {}
    dropped: list[tuple[str, str]] = []
    unresolved: list[tuple[str, str]] = []

    for season in sorted(raw.keys(), key=int):
        out: list[str] = []
        for name in raw[season]:
            if _looks_like_team(name):
                dropped.append((season, name))
                continue
            resolved = _resolve_wr(name, index)
            if not resolved:
                unresolved.append((season, name))
                continue
            if resolved not in out:
                out.append(resolved)
        cleaned[season] = out
        print(f"{season}: {len(raw[season])} raw -> {len(out)} WRs")

    seed["proBowlWr"] = cleaned
    seed["notes"]["proBowlWr"] = (
        "Pro Bowl / Pro Bowl Games WR selections for that NFL season "
        "(starters, reserves, listed alternates). Built from Wikipedia "
        "rosters with team-name noise removed; 2013–2015 curated for "
        "draft-format Pro Bowl pages. Selection counts as True even if "
        "the player sat out."
    )
    SEED_PATH.write_text(json.dumps(seed, indent=2) + "\n", encoding="utf-8")
    print(f"\nWrote {SEED_PATH}")
    print(f"Dropped team-like tokens: {len(dropped)}")
    print(f"Unresolved names: {len(unresolved)}")
    for season, name in unresolved[:40]:
        print(f"  {season}: {name}")


if __name__ == "__main__":
    main()
