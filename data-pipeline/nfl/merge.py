"""Merge raw pipeline data into game-ready bios.json and seasons.json.

Full historical merge is not implemented yet. Helpers below are used by
spike_sample.py and will grow into the NBA-shaped merge path.
"""

from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timezone
from typing import Any

from config import FIRST_SEASON_YEAR, MODERN_STATS_START_YEAR, SPORT
from utils import empty_honors, season_label, season_year_from_label


def _normalize_college(value: str | None) -> str | None:
    if not value:
        return None
    cleaned = str(value).strip()
    if not cleaned or cleaned.lower() in {"none", "nan", "null"}:
        return None
    return cleaned


def _canonical_name(*candidates: Any) -> str:
    for name in candidates:
        if name is None:
            continue
        text = str(name).strip()
        if text and text.lower() not in {"none", "nan", "null"}:
            return text
    return "Unknown"


def _safe_int(value: Any) -> int | None:
    if value is None:
        return None
    try:
        if isinstance(value, float) and value != value:  # NaN
            return None
        return int(value)
    except (TypeError, ValueError):
        return None


def _safe_float(value: Any, default: float = 0.0) -> float:
    if value is None:
        return default
    try:
        if isinstance(value, float) and value != value:  # NaN
            return default
        return float(value)
    except (TypeError, ValueError):
        return default


def build_bios_from_rows(
    season_rows: list[dict[str, Any]],
    player_info_by_id: dict[str, dict[str, Any]] | None = None,
    honors_by_player: dict[str, dict[str, dict[str, bool]]] | None = None,
) -> dict[str, dict[str, Any]]:
    """Build bios map from season rows + optional player info (college/draft) + honors."""
    player_info_by_id = player_info_by_id or {}
    honors_by_player = honors_by_player or {}
    seasons_by_player: dict[str, set[str]] = defaultdict(set)
    names_by_player: dict[str, str] = {}

    for row in season_rows:
        player_id = str(row["playerId"])
        seasons_by_player[player_id].add(str(row["season"]))
        names_by_player[player_id] = row.get("playerName") or names_by_player.get(player_id, "")

    bios: dict[str, dict[str, Any]] = {}
    for player_id, seasons in seasons_by_player.items():
        info = player_info_by_id.get(player_id, {})
        draft_pick = _safe_int(info.get("draftPick"))
        draft_round = _safe_int(info.get("draftRound"))
        draft_year = _safe_int(info.get("draftYear"))

        ever = {
            "everProBowl": False,
            "everMvp": False,
            "everAllPro": False,
            "everSbMvp": False,
            "everChampion": False,
        }
        for season_honors in honors_by_player.get(player_id, {}).values():
            if season_honors.get("proBowl"):
                ever["everProBowl"] = True
            if season_honors.get("mvp"):
                ever["everMvp"] = True
            if season_honors.get("allPro"):
                ever["everAllPro"] = True
            if season_honors.get("sbMvp"):
                ever["everSbMvp"] = True
            if season_honors.get("champion"):
                ever["everChampion"] = True

        espn_raw = info.get("espnId")
        espn_id: str | None = None
        if espn_raw is not None and str(espn_raw).strip().lower() not in {"", "none", "nan", "null"}:
            try:
                espn_id = str(int(float(str(espn_raw).strip())))
            except (TypeError, ValueError):
                espn_id = str(espn_raw).strip()

        bios[player_id] = {
            "id": player_id,
            "name": _canonical_name(names_by_player.get(player_id, ""), info.get("name", "")),
            "espnId": espn_id,
            "college": _normalize_college(info.get("college")),
            "draftPick": draft_pick,
            "draftRound": draft_round,
            "draftYear": draft_year,
            "undrafted": draft_pick is None,
            "seasonsPlayed": len(seasons),
            **ever,
        }

    return bios


def build_seasons_from_rows(
    season_rows: list[dict[str, Any]],
    honors_by_player: dict[str, dict[str, dict[str, bool]]] | None = None,
) -> list[dict[str, Any]]:
    """Normalize raw season rows into game-ready season objects."""
    honors_by_player = honors_by_player or {}
    output: list[dict[str, Any]] = []
    for row in season_rows:
        games = _safe_int(row.get("games")) or 0
        pass_yds = _safe_float(row.get("passYds"))
        rush_yds = _safe_float(row.get("rushYds"))
        completions = _safe_float(row.get("completions"))
        attempts = _safe_float(row.get("attempts"))
        player_id = str(row["playerId"])
        season = (
            season_label(int(row["season"]))
            if str(row["season"]).isdigit()
            else str(row["season"])
        )
        honors = empty_honors()
        found = honors_by_player.get(player_id, {}).get(season) or row.get("honors")
        if found:
            for key in ("mvp", "proBowl", "allPro", "sbMvp", "champion"):
                honors[key] = bool(found.get(key, False))

        receptions = _safe_float(row.get("receptions"))
        targets = _safe_float(row.get("targets"))
        rec_yds = _safe_float(row.get("recYds"))
        position = str(row.get("position") or "QB").upper()
        if position not in {"QB", "WR", "RB"}:
            position = "QB"

        output.append(
            {
                "playerId": player_id,
                "season": season,
                "team": str(row.get("team") or ""),
                "position": position,
                "games": games,
                "passYds": int(round(pass_yds)),
                "passTd": int(round(_safe_float(row.get("passTd")))),
                "interceptions": int(round(_safe_float(row.get("interceptions")))),
                "completions": int(round(completions)),
                "attempts": int(round(attempts)),
                "rushYds": int(round(rush_yds)),
                "rushTd": int(round(_safe_float(row.get("rushTd")))),
                "receptions": int(round(receptions)),
                "targets": int(round(targets)),
                "recYds": int(round(rec_yds)),
                "recTd": int(round(_safe_float(row.get("recTd")))),
                "passYpg": round(pass_yds / games, 1) if games else 0.0,
                "rushYpg": round(rush_yds / games, 1) if games else 0.0,
                "recYpg": round(rec_yds / games, 1) if games else 0.0,
                "completionPct": round(100.0 * completions / attempts, 1) if attempts else 0.0,
                "honors": honors,
            }
        )
    return output


def build_metadata(
    bios: dict[str, dict[str, Any]],
    seasons: list[dict[str, Any]],
    first_year: int,
    last_year: int,
    *,
    awards_loaded: bool = False,
) -> dict[str, Any]:
    season_labels = sorted({row["season"] for row in seasons}, key=season_year_from_label)
    historical = [s for s in season_labels if season_year_from_label(s) < MODERN_STATS_START_YEAR]
    modern = [s for s in season_labels if season_year_from_label(s) >= MODERN_STATS_START_YEAR]

    stats_notes: dict[str, Any] = {
        "modernBulkStatsFrom": season_label(MODERN_STATS_START_YEAR),
        "historicalStatsSource": "TBD (rosters only until historical fetcher)",
        "superBowlEraFrom": season_label(FIRST_SEASON_YEAR),
        "awardsNotYetLoaded": not awards_loaded,
        "multiTeamSeasons": (
            "One row per player-season. nflverse reg totals use recent_team "
            "(last club). Duplicate splits keep the highest-volume row "
            "(QB: attempts; WR: targets/receptions; RB: rush yards)."
        ),
        "positionScope": (
            "QB: roster position QB, plus any player with >=50 regular-season "
            "pass attempts. WR: roster position WR with >=16 targets or "
            ">=8 receptions. RB: roster position RB with >=40 rush attempts "
            "or >=200 rush yards (excludes return specialists / tiny usage)."
        ),
    }
    if awards_loaded:
        stats_notes["awardsSources"] = (
            "champion: nflverse schedules Super Bowl winner joined to that "
            "season's QB/WR/RB roster (load_rosters). mvp / sbMvp / allPro / "
            "proBowl / allProWr / allProRb: supplemental awards_seed.json "
            "(AP MVP, Super Bowl MVP, AP first-team All-Pro, Pro Bowl). "
            "nflreadpy has no awards table; PFR HTML is blocked for automated "
            "clients. proBowlRb seed not yet populated."
        )
        stats_notes["allProDefinition"] = (
            "AP first-team All-Pro at quarterback (allPro), wide receiver "
            "(allProWr), or running back (allProRb)"
        )
        stats_notes["proBowlDefinition"] = (
            "Selected for the Pro Bowl / Pro Bowl Games for that NFL season "
            "(includes players who were selected but did not play). QB and WR "
            "lists are seeded; RB Pro Bowl seed (proBowlRb) may be empty."
        )
        stats_notes["championDefinition"] = (
            "Appeared on the Super Bowl-winning team's QB, WR, or RB roster "
            "that NFL season"
        )

    return {
        "sport": SPORT,
        "firstSeasonYear": first_year,
        "lastSeasonYear": last_year,
        "seasonCount": len(season_labels),
        "historicalSeasonCount": len(historical),
        "modernSeasonCount": len(modern),
        "playerCount": len(bios),
        "seasonRowCount": len(seasons),
        "seasons": season_labels,
        "historicalSeasons": historical,
        "modernSeasons": modern,
        "statsNotes": stats_notes,
        "generatedAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
    }
