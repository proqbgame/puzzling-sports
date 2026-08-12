"""Merge raw pipeline data into game-ready bios.json and seasons.json."""

from __future__ import annotations

from collections import defaultdict
from typing import Any

from fetch_awards import empty_honors
from utils import season_label


def _normalize_college(value: str | None) -> str | None:
    if not value:
        return None
    cleaned = value.strip()
    return cleaned or None


def _canonical_name(*candidates: str) -> str:
    for name in candidates:
        if name and name.strip():
            return name.strip()
    return "Unknown"


def build_bios(
    season_rows: list[dict[str, Any]],
    draft_by_id: dict[str, dict[str, Any]],
    player_info_by_id: dict[str, dict[str, Any]],
    honors_by_player: dict[str, dict[str, dict[str, bool]]],
) -> dict[str, dict[str, Any]]:
    seasons_by_player: dict[str, set[str]] = defaultdict(set)
    names_by_player: dict[str, str] = {}

    for row in season_rows:
        player_id = row["playerId"]
        seasons_by_player[player_id].add(row["season"])
        names_by_player[player_id] = row.get("playerName") or names_by_player.get(player_id, "")

    ever_honors: dict[str, dict[str, bool]] = defaultdict(lambda: defaultdict(bool))
    for player_id, seasons in honors_by_player.items():
        for season_honors in seasons.values():
            for honor, value in season_honors.items():
                if value:
                    ever_honors[player_id][honor] = True

    bios: dict[str, dict[str, Any]] = {}

    for player_id, seasons in seasons_by_player.items():
        draft = draft_by_id.get(player_id, {})
        info = player_info_by_id.get(player_id, {})

        college = _normalize_college(draft.get("college")) or _normalize_college(
            info.get("college")
        )

        name = _canonical_name(
            names_by_player.get(player_id, ""),
            draft.get("name", ""),
            info.get("name", ""),
        )

        draft_pick = draft.get("draftPick")
        draft_round = draft.get("draftRound")
        draft_year = draft.get("draftYear")

        bios[player_id] = {
            "id": player_id,
            "name": name,
            "college": college,
            "draftPick": draft_pick,
            "draftRound": draft_round,
            "draftYear": draft_year,
            "undrafted": draft_pick is None,
            "seasonsPlayed": len(seasons),
            "everAllStar": ever_honors[player_id].get("allStar", False),
            "everMvp": ever_honors[player_id].get("mvp", False),
            "everChampion": ever_honors[player_id].get("champion", False),
            "everDpoy": ever_honors[player_id].get("dpoy", False),
            "everSixthMan": ever_honors[player_id].get("sixthMan", False),
            "everMostImproved": ever_honors[player_id].get("mostImproved", False),
            "everFinalsMvp": ever_honors[player_id].get("finalsMvp", False),
            "everAllNba": ever_honors[player_id].get("allNba", False),
            "everAllDefensive": ever_honors[player_id].get("allDefensive", False),
        }

    return bios


def build_seasons(
    season_rows: list[dict[str, Any]],
    honors_by_player: dict[str, dict[str, dict[str, bool]]],
) -> list[dict[str, Any]]:
    output: list[dict[str, Any]] = []

    for row in season_rows:
        player_id = row["playerId"]
        season = row["season"]
        honors = honors_by_player.get(player_id, {}).get(season, empty_honors())

        output.append(
            {
                "playerId": player_id,
                "season": season,
                "team": row["team"],
                "games": row["games"],
                "ppg": row["ppg"],
                "rpg": row["rpg"],
                "apg": row["apg"],
                "blk": row["blk"],
                "honors": honors,
            }
        )

    return output


def build_metadata(
    bios: dict[str, dict[str, Any]],
    seasons: list[dict[str, Any]],
    first_year: int,
    last_year: int,
) -> dict[str, Any]:
    from datetime import datetime, timezone

    from config import MODERN_STATS_START_YEAR

    season_labels = sorted({row["season"] for row in seasons})
    historical = [s for s in season_labels if season_year_from_label(s) < MODERN_STATS_START_YEAR]
    modern = [s for s in season_labels if season_year_from_label(s) >= MODERN_STATS_START_YEAR]

    return {
        "sport": "nba",
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
        "statsNotes": {
            "modernBulkStatsFrom": season_label(MODERN_STATS_START_YEAR),
            "historicalStatsSource": "PlayerCareerStats",
            "blocksTrackedFrom": "1973-74",
            "blocksBefore1974MayBeZero": True,
        },
        "generatedAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
    }


def season_year_from_label(label: str) -> int:
    return int(label.split("-")[0])


def merge_season_rows(
    historical_rows: list[dict[str, Any]],
    modern_rows: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    """Combine historical + modern rows; prefer modern data when both exist."""
    merged: dict[tuple[str, str], dict[str, Any]] = {}

    for row in historical_rows:
        merged[(row["playerId"], row["season"])] = row

    for row in modern_rows:
        merged[(row["playerId"], row["season"])] = row

    return list(merged.values())
