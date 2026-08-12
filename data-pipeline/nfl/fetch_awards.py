"""
Fetch and merge NFL QB/WR awards for 1999+ seasons.

Sources
-------
1. Super Bowl champions — nflverse schedules (`game_type == "SB"`) joined to
   that season's roster via `load_rosters`. A QB or WR is `champion` for a
   season iff they appear on the Super Bowl-winning club's roster in that NFL
   season (not "any player ever associated with the franchise").

2. Individual awards (AP MVP, Super Bowl MVP, AP first-team All-Pro, Pro Bowl)
   — maintained supplemental seed `awards_seed.json`, keyed by NFL season year
   and player display name. nflreadpy has no awards endpoint; PFR HTML is
   blocked (403) from automated clients. The seed is rebuilt/updated
   intentionally rather than scraped at build time.

Match rule: display_name (or football_name) against `load_players()`, preferring
position when the seed section implies one (QB awards → QB, WR awards → WR).
"""

from __future__ import annotations

import json
import re
from collections import defaultdict
from pathlib import Path
from typing import Any

import nflreadpy as nfl
import pandas as pd

from config import CACHE_DIR, PIPELINE_DIR
from utils import empty_honors, season_label

HONOR_FIELDS = ("mvp", "proBowl", "allPro", "sbMvp", "champion")

SEED_PATH = PIPELINE_DIR / "awards_seed.json"
CACHE_AWARDS_DIR = CACHE_DIR / "awards"
# Bump when champion position scope or seed sections change.
AWARDS_CACHE_VERSION = "v3"

# Career-ever keys on bios, derived from season honors.
EVER_FLAG_BY_HONOR = {
    "mvp": "everMvp",
    "proBowl": "everProBowl",
    "allPro": "everAllPro",
    "sbMvp": "everSbMvp",
    "champion": "everChampion",
}

# Seed honor key -> preferred roster position for name resolution.
SEED_PREFERRED_POSITION = {
    "mvp": None,  # any position (mostly QB; skill players resolve uniquely)
    "sbMvp": None,
    "allPro": "QB",
    "proBowl": "QB",
    "allProWr": "WR",
    "proBowlWr": "WR",
    "allProRb": "RB",
    "proBowlRb": "RB",
}

# Map seed section -> season honor field written onto rows.
SEED_HONOR_FIELD = {
    "mvp": "mvp",
    "sbMvp": "sbMvp",
    "allPro": "allPro",
    "proBowl": "proBowl",
    "allProWr": "allPro",
    "proBowlWr": "proBowl",
    "allProRb": "allPro",
    "proBowlRb": "proBowl",
}


def _to_pandas(frame) -> pd.DataFrame:
    if isinstance(frame, pd.DataFrame):
        return frame
    return frame.to_pandas()


def _clean_person_name(raw: str) -> str:
    text = str(raw or "").strip()
    text = re.sub(r"\[[^\]]*\]", "", text)  # footnote markers
    text = re.sub(r"\([^)]*\)", "", text)  # (2), team notes
    text = re.sub(r"[*†‡§]+", "", text)
    text = re.sub(r"\s+", " ", text).strip()
    # Drop trailing ordinal suffixes like "Brady2" from table scrapes.
    text = re.sub(r"(\D)\d+$", r"\1", text).strip()
    return text


# Common award-list names that differ from nflverse display_name.
NAME_ALIASES = {
    "michael vick": "Mike Vick",
    "kenneth walker": "Kenneth Walker III",
    "steve smith": "Steve Smith",
    "chad johnson": "Chad Johnson",
    "chad ochocinco": "Chad Johnson",
    "amon-ra st. brown": "Amon-Ra St. Brown",
    "amon-ra st brown": "Amon-Ra St. Brown",
    "ja'marr chase": "Ja'Marr Chase",
    "cee dee lamb": "CeeDee Lamb",
    "ceedee lamb": "CeeDee Lamb",
    "deebo samuel": "Deebo Samuel Sr.",
    "a. j. green": "A.J. Green",
    "aj green": "A.J. Green",
    "t. y. hilton": "T.Y. Hilton",
    "ty hilton": "T.Y. Hilton",
    "a. j. brown": "A.J. Brown",
    "aj brown": "A.J. Brown",
    "d. j. chark": "DJ Chark",
    "d.j. chark": "DJ Chark",
    "dj chark": "DJ Chark",
    "odell beckham": "Odell Beckham Jr.",
    "odell beckham jr": "Odell Beckham Jr.",
    "chris godwin": "Chris Godwin Jr.",
    "dk metcalf": "DK Metcalf",
    "d.k. metcalf": "DK Metcalf",
    "leveon bell": "Le'Veon Bell",
    "le'veon bell": "Le'Veon Bell",
    "c. j. anderson": "C.J. Anderson",
    "cj anderson": "C.J. Anderson",
    "c.j. anderson": "C.J. Anderson",
    "a. j. dillon": "A.J. Dillon",
    "aj dillon": "A.J. Dillon",
    "d. k. metcalf": "DK Metcalf",
    "marion barber iii": "Marion Barber",
    "mark ingram ii": "Mark Ingram",
}


def _canonical_award_name(raw: str) -> str:
    cleaned = _clean_person_name(raw)
    # Normalize "A. J. Green" -> "A.J. Green"
    cleaned = re.sub(r"\b([A-Z])\.\s+(?=[A-Z]\.)", r"\1.", cleaned)
    cleaned = re.sub(r"\b([A-Z])\.\s+([A-Z][a-z])", r"\1. \2", cleaned)
    alias = NAME_ALIASES.get(cleaned.lower())
    return alias or cleaned


def _load_seed(path: Path = SEED_PATH) -> dict[str, Any]:
    if not path.exists():
        raise FileNotFoundError(
            f"Missing awards seed at {path}. Expected awards_seed.json beside the pipeline."
        )
    return json.loads(path.read_text(encoding="utf-8"))


def _player_name_index(players: pd.DataFrame | None = None) -> dict[str, list[dict[str, str]]]:
    """Lowercased display/football name -> list of {gsis_id, position, name}."""
    if players is None:
        players = _to_pandas(nfl.load_players())

    id_col = "gsis_id" if "gsis_id" in players.columns else None
    if not id_col:
        return {}

    name_cols = [c for c in ("display_name", "football_name", "short_name") if c in players.columns]
    pos_col = "position" if "position" in players.columns else None

    index: dict[str, list[dict[str, str]]] = defaultdict(list)
    for _, row in players.iterrows():
        gsis = row.get(id_col)
        if gsis is None or (isinstance(gsis, float) and pd.isna(gsis)):
            continue
        pid = str(gsis).strip()
        if not pid or pid.lower() == "nan":
            continue
        pos = ""
        if pos_col and row.get(pos_col) is not None and not (
            isinstance(row.get(pos_col), float) and pd.isna(row.get(pos_col))
        ):
            pos = str(row.get(pos_col)).upper()
        for col in name_cols:
            raw = row.get(col)
            if raw is None or (isinstance(raw, float) and pd.isna(raw)):
                continue
            key = _clean_person_name(str(raw)).lower()
            if not key:
                continue
            entry = {"gsis_id": pid, "position": pos, "name": str(raw)}
            if entry not in index[key]:
                index[key].append(entry)
    return index


def _resolve_gsis_id(
    name: str,
    name_index: dict[str, list[dict[str, str]]],
    *,
    preferred_position: str | None = "QB",
) -> str | None:
    key = _canonical_award_name(name).lower()
    if not key:
        return None
    candidates = name_index.get(key, [])
    if not candidates:
        return None
    if preferred_position:
        preferred = [
            c for c in candidates if c.get("position") == preferred_position.upper()
        ]
        if preferred:
            return preferred[0]["gsis_id"]
    if len(candidates) == 1:
        return candidates[0]["gsis_id"]
    # Fall back: prefer QB when ambiguous and no preferred match.
    qb = [c for c in candidates if c.get("position") == "QB"]
    if qb:
        return qb[0]["gsis_id"]
    return candidates[0]["gsis_id"]


def _honors_bucket(
    honors_by_player: dict[str, dict[str, dict[str, bool]]],
    player_id: str,
    season: int | str,
) -> dict[str, bool]:
    season_key = season_label(int(season))
    return honors_by_player.setdefault(player_id, {}).setdefault(season_key, empty_honors())


def _mark(
    honors_by_player: dict[str, dict[str, dict[str, bool]]],
    player_id: str,
    season: int | str,
    honor: str,
) -> None:
    bucket = _honors_bucket(honors_by_player, player_id, season)
    bucket[honor] = True


def fetch_super_bowl_champions(
    first_year: int,
    last_year: int,
    *,
    positions: tuple[str, ...] = ("QB", "WR"),
) -> dict[tuple[str, str], bool]:
    """
    Return {(gsis_id, season_label): True} for skill players on Super Bowl–winning rosters.
    """
    seasons = list(range(first_year, last_year + 1))
    if not seasons:
        return {}

    print(f"    Loading schedules for Super Bowl winners ({seasons[0]}–{seasons[-1]})...")
    schedules = _to_pandas(nfl.load_schedules(seasons))
    sb = schedules[schedules["game_type"].astype(str) == "SB"].copy()
    if sb.empty:
        print("    Warning: no Super Bowl rows in schedules for requested years")
        return {}

    winners: dict[int, str] = {}
    for _, row in sb.iterrows():
        season = int(row["season"])
        home_score = row.get("home_score")
        away_score = row.get("away_score")
        if pd.isna(home_score) or pd.isna(away_score):
            continue
        winner = str(row["home_team"] if float(home_score) > float(away_score) else row["away_team"])
        winners[season] = winner

    print(f"    Super Bowl winners resolved: {len(winners)}")
    print(f"    Loading rosters for champion joins ({', '.join(positions)})...")
    rosters = _to_pandas(nfl.load_rosters(seasons))
    pos_col = "position" if "position" in rosters.columns else None
    allowed = {p.upper() for p in positions}
    if pos_col:
        rosters = rosters[rosters[pos_col].astype(str).str.upper().isin(allowed)].copy()

    out: dict[tuple[str, str], bool] = {}
    for season, team in winners.items():
        season_rosters = rosters[
            (rosters["season"].astype(int) == season) & (rosters["team"].astype(str) == team)
        ]
        for gsis in season_rosters["gsis_id"].dropna().astype(str):
            if gsis and gsis.lower() != "nan":
                out[(gsis, season_label(season))] = True

    print(f"    Champion roster marks ({'/'.join(positions)}): {len(out)}")
    return out


def apply_seed_awards(
    seed: dict[str, Any],
    name_index: dict[str, list[dict[str, str]]],
    honors_by_player: dict[str, dict[str, dict[str, bool]]],
    unresolved: list[str],
) -> None:
    """Apply mvp / sbMvp / allPro / proBowl / allProWr / proBowlWr from the seed file."""
    for seed_key, honor_field in SEED_HONOR_FIELD.items():
        by_season = seed.get(seed_key) or {}
        preferred = SEED_PREFERRED_POSITION.get(seed_key)
        for season_str, names in by_season.items():
            season = int(season_str)
            for raw_name in names:
                name = _canonical_award_name(raw_name)
                gsis = _resolve_gsis_id(
                    name,
                    name_index,
                    preferred_position=preferred,
                )
                if not gsis:
                    unresolved.append(f"{seed_key}:{season}:{name}")
                    continue
                _mark(honors_by_player, gsis, season, honor_field)


def fetch_awards_for_seasons(
    first_year: int,
    last_year: int,
    *,
    refresh: bool = False,
) -> dict[str, dict[str, dict[str, bool]]]:
    """
    Return playerId -> seasonLabel -> honors dict for seasons in [first_year, last_year].

    Caches the flattened merge under cache/awards/honors_{version}_{first}_{last}.json.
    """
    CACHE_AWARDS_DIR.mkdir(parents=True, exist_ok=True)
    cache_path = (
        CACHE_AWARDS_DIR / f"honors_{AWARDS_CACHE_VERSION}_{first_year}_{last_year}.json"
    )

    if not refresh and cache_path.exists():
        cached = json.loads(cache_path.read_text(encoding="utf-8"))
        print(f"    Awards cache hit: {cache_path.name} ({len(cached)} players)")
        return cached

    print("    Loading players for award name -> gsis_id matching...")
    players = _to_pandas(nfl.load_players())
    name_index = _player_name_index(players)
    print(f"    Name index keys: {len(name_index)}")

    honors_by_player: dict[str, dict[str, dict[str, bool]]] = {}
    unresolved: list[str] = []

    seed = _load_seed()
    print(f"    Applying supplemental awards seed ({SEED_PATH.name})...")
    apply_seed_awards(seed, name_index, honors_by_player, unresolved)

    champions = fetch_super_bowl_champions(first_year, last_year, positions=("QB", "WR", "RB"))
    for (gsis, season), _ in champions.items():
        year = int(season)
        if first_year <= year <= last_year:
            _mark(honors_by_player, gsis, season, "champion")

    # Drop honor seasons outside requested range (seed may include extras).
    trimmed: dict[str, dict[str, dict[str, bool]]] = {}
    for pid, seasons in honors_by_player.items():
        kept = {
            s: h
            for s, h in seasons.items()
            if first_year <= int(s) <= last_year
        }
        if kept:
            trimmed[pid] = kept

    if unresolved:
        sample = "; ".join(unresolved[:12])
        more = f" (+{len(unresolved) - 12} more)" if len(unresolved) > 12 else ""
        print(f"    Warning: unresolved award names: {sample}{more}")

    cache_path.write_text(json.dumps(trimmed, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"    Players with any award/champion mark: {len(trimmed)}")
    return trimmed


def merge_honors_into_season_rows(
    season_rows: list[dict[str, Any]],
    honors_by_player: dict[str, dict[str, dict[str, bool]]],
) -> list[dict[str, Any]]:
    """Attach honors onto raw/modern season rows (mutates and returns same list)."""
    for row in season_rows:
        pid = str(row["playerId"])
        season = (
            season_label(int(row["season"]))
            if str(row["season"]).isdigit()
            else str(row["season"])
        )
        honors = empty_honors()
        found = honors_by_player.get(pid, {}).get(season)
        if found:
            for key in HONOR_FIELDS:
                honors[key] = bool(found.get(key, False))
        row["honors"] = honors
    return season_rows


def apply_ever_flags(
    bios: dict[str, dict[str, Any]],
    honors_by_player: dict[str, dict[str, dict[str, bool]]],
) -> None:
    """Set ever* career flags on bios from season honors."""
    for pid, bio in bios.items():
        for honor, ever_key in EVER_FLAG_BY_HONOR.items():
            bio[ever_key] = False
        seasons = honors_by_player.get(pid, {})
        for season_honors in seasons.values():
            for honor, ever_key in EVER_FLAG_BY_HONOR.items():
                if season_honors.get(honor):
                    bio[ever_key] = True


def honor_coverage_stats(
    seasons: list[dict[str, Any]],
) -> dict[str, int]:
    counts = {key: 0 for key in HONOR_FIELDS}
    for row in seasons:
        honors = row.get("honors") or {}
        for key in HONOR_FIELDS:
            if honors.get(key):
                counts[key] += 1
    return counts
