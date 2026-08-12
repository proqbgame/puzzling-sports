"""
Clean proBowlRb seed: drop team names / noise; keep names that resolve to RB players.
Also fill missing 2013–2015 seasons with curated lists (draft-format Pro Bowl).
"""

from __future__ import annotations

import json
from pathlib import Path

import nflreadpy as nfl
import pandas as pd

from config import PIPELINE_DIR
from fetch_awards import NAME_ALIASES, _canonical_award_name, _player_name_index

SEED_PATH = PIPELINE_DIR / "awards_seed.json"

MANUAL_SEASONS: dict[str, list[str]] = {
    # 2014 Pro Bowl (2013 season)
    "2013": [
        "Jamaal Charles",
        "Matt Forte",
        "Marshawn Lynch",
        "LeSean McCoy",
        "Adrian Peterson",
        "Knowshon Moreno",
        "Eddie Lacy",
        "DeMarco Murray",
        "Frank Gore",
    ],
    # 2015 Pro Bowl (2014 season)
    "2014": [
        "DeMarco Murray",
        "Le'Veon Bell",
        "Arian Foster",
        "Jamaal Charles",
        "Marshawn Lynch",
        "Matt Forte",
        "Justin Forsett",
        "Eddie Lacy",
        "Jeremy Hill",
        "C.J. Anderson",
        "Mark Ingram",
        "Alfred Morris",
    ],
    # 2016 Pro Bowl (2015 season)
    "2015": [
        "Adrian Peterson",
        "Todd Gurley",
        "Devonta Freeman",
        "Doug Martin",
        "Latavius Murray",
        "Jonathan Stewart",
        "Darren McFadden",
        "Chris Ivory",
        "Danny Woodhead",
        "David Johnson",
        "Lamar Miller",
    ],
}

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
}


def _to_pandas(frame) -> pd.DataFrame:
    if isinstance(frame, pd.DataFrame):
        return frame
    return frame.to_pandas()


def _looks_like_team(name: str) -> bool:
    low = name.strip().lower()
    if low in TEAM_TOKENS:
        return True
    if " " not in low and low in TEAM_TOKENS:
        return True
    return False


def _resolve_rb(name: str, index: dict[str, list[dict[str, str]]]) -> str | None:
    canon = _canonical_award_name(name)
    key = canon.lower()
    hits = index.get(key) or []
    rb_hits = [h for h in hits if (h.get("position") or "").upper() in {"RB", "FB"}]
    chosen = rb_hits[0] if rb_hits else (hits[0] if len(hits) == 1 else None)
    if not chosen and key in NAME_ALIASES:
        alias_key = NAME_ALIASES[key].lower()
        hits = index.get(alias_key) or []
        rb_hits = [h for h in hits if (h.get("position") or "").upper() in {"RB", "FB"}]
        chosen = rb_hits[0] if rb_hits else (hits[0] if len(hits) == 1 else None)
    return chosen["name"] if chosen else None


def main() -> None:
    seed = json.loads(SEED_PATH.read_text(encoding="utf-8"))
    players = _to_pandas(nfl.load_players())
    index = _player_name_index(players)

    cache_path = PIPELINE_DIR / "cache" / "awards" / "proBowlRb_wikipedia.json"
    raw: dict[str, list[str]] = {}
    if cache_path.exists():
        cache = json.loads(cache_path.read_text(encoding="utf-8"))
        raw = dict(cache.get("proBowlRb") or {})
    for season, names in (seed.get("proBowlRb") or {}).items():
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
            resolved = _resolve_rb(name, index)
            if not resolved:
                unresolved.append((season, name))
                continue
            if resolved not in out:
                out.append(resolved)
        cleaned[season] = out
        print(f"{season}: {len(raw[season])} raw -> {len(out)} RBs")

    seed["proBowlRb"] = cleaned
    seed["notes"]["proBowlRb"] = (
        "Pro Bowl / Pro Bowl Games RB selections for that NFL season "
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
