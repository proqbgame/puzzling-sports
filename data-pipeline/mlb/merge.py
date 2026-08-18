"""Merge raw MLB rows into bios.json / seasons.json / metadata.json."""

from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timezone
from typing import Any

from config import FIRST_SEASON_YEAR, MIN_HITTER_AB, MIN_PITCHER_IP, SPORT
from utils import empty_honors, season_label, season_year_from_label


def _normalize_college(value: str | None) -> str | None:
    if not value:
        return None
    cleaned = str(value).strip()
    if not cleaned or cleaned.lower() in {"none", "nan", "null"}:
        return None
    return cleaned


def build_bios_from_rows(
    season_rows: list[dict[str, Any]],
    player_info_by_id: dict[str, dict[str, Any]],
) -> dict[str, dict[str, Any]]:
    seasons_by_player: dict[str, set[str]] = defaultdict(set)
    names_by_player: dict[str, str] = {}
    honors_ever: dict[str, dict[str, bool]] = defaultdict(
        lambda: {
            "everMvp": False,
            "everAllStar": False,
            "everCyYoung": False,
            "everSilverSlugger": False,
            "everGoldGlove": False,
            "everWsMvp": False,
            "everChampion": False,
        }
    )

    for row in season_rows:
        player_id = str(row["playerId"])
        seasons_by_player[player_id].add(str(row["season"]))
        names_by_player[player_id] = row.get("playerName") or names_by_player.get(
            player_id, ""
        )
        honors = row.get("honors") or {}
        ever = honors_ever[player_id]
        if honors.get("mvp"):
            ever["everMvp"] = True
        if honors.get("allStar"):
            ever["everAllStar"] = True
        if honors.get("cyYoung"):
            ever["everCyYoung"] = True
        if honors.get("silverSlugger"):
            ever["everSilverSlugger"] = True
        if honors.get("goldGlove"):
            ever["everGoldGlove"] = True
        if honors.get("wsMvp"):
            ever["everWsMvp"] = True
        if honors.get("champion"):
            ever["everChampion"] = True

    bios: dict[str, dict[str, Any]] = {}
    for player_id, seasons in seasons_by_player.items():
        info = player_info_by_id.get(player_id, {})
        bios[player_id] = {
            "id": player_id,
            "name": names_by_player.get(player_id) or info.get("name") or "Unknown",
            "mlbamId": info.get("mlbamId") or (player_id if player_id.isdigit() else None),
            "espnId": info.get("espnId"),
            "college": _normalize_college(info.get("college")),
            "draftPick": info.get("draftPick"),
            "draftRound": info.get("draftRound"),
            "draftYear": info.get("draftYear"),
            "undrafted": False,
            "seasonsPlayed": len(seasons),
            **honors_ever[player_id],
        }
    return bios


def build_seasons_from_rows(season_rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    output: list[dict[str, Any]] = []
    for row in season_rows:
        honors = empty_honors()
        found = row.get("honors") or {}
        for key in honors:
            honors[key] = bool(found.get(key, False))
        position = str(row.get("position") or "H").upper()
        if position not in {"P", "H"}:
            position = "H"
        output.append(
            {
                "playerId": str(row["playerId"]),
                "season": str(row["season"]),
                "team": str(row.get("team") or ""),
                "position": position,
                "games": int(row.get("games") or 1),
                "ab": int(row.get("ab") or 0),
                "hits": int(row.get("hits") or 0),
                "hr": int(row.get("hr") or 0),
                "rbi": int(row.get("rbi") or 0),
                "sb": int(row.get("sb") or 0),
                "avg": float(row.get("avg") or 0.0),
                "so": int(row.get("so") or 0),
                "w": int(row.get("w") or 0),
                "ip": float(row.get("ip") or 0.0),
                "era": float(row.get("era") or 0.0),
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
    season_labels = sorted({row["season"] for row in seasons}, key=season_year_from_label)
    hitter_rows = [row for row in seasons if row["position"] == "H"]
    pitcher_rows = [row for row in seasons if row["position"] == "P"]
    actual_first = (
        season_year_from_label(season_labels[0]) if season_labels else first_year
    )
    actual_last = (
        season_year_from_label(season_labels[-1]) if season_labels else last_year
    )
    return {
        "sport": SPORT,
        "firstSeasonYear": actual_first,
        "lastSeasonYear": actual_last,
        "seasonCount": len(season_labels),
        "playerCount": len(bios),
        "seasonRowCount": len(seasons),
        "seasons": season_labels,
        "statsNotes": {
            "source": "SABR Lahman Baseball Database 2025 edition (via pylahman CSVs; batting, pitching, awards, All-Star, World Series)",
            "modernBulkStatsFrom": season_label(FIRST_SEASON_YEAR),
            "positionScope": (
                f"Hitter rows: >= {MIN_HITTER_AB} AB in a season. "
                f"Pitcher rows: >= {MIN_PITCHER_IP} IP. "
                "Two-way players (e.g. Ohtani) may have both an H and a P row in the same year."
            ),
            "edgeStats": (
                "Hitter: HR / RBI / AVG / SB. "
                "Pitcher: SO / W / IP / ERA (ERA is lower-is-better; tab/socket inverted on that edge)."
            ),
            "championDefinition": (
                "Appeared in the World Series for the winning team (Lahman batting_post / pitching_post)."
            ),
            "multiTeamSeasons": "One batting row and/or one pitching row per player-season; last team kept.",
            "headshots": "MLB.com headshots via mlbamId when Chadwick provides a mapping.",
        },
        "generatedAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "hitterSeasonCount": len(hitter_rows),
        "pitcherSeasonCount": len(pitcher_rows),
    }
