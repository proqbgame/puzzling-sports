"""Fetch modern-era (1999+) NFL QB + WR + RB season stats via nflreadpy."""

from __future__ import annotations

from typing import Any

import nflreadpy as nfl
import pandas as pd

from config import MIN_GAMES_PER_SEASON
from utils import empty_honors

# Include non-roster passers with this many regular-season attempts (position noise).
MIN_PASS_ATTEMPTS_INCLUSION = 50
# Meaningful WR volume — excludes special-teamers / gadget listings with tiny usage.
MIN_TARGETS_INCLUSION = 16
MIN_RECEPTIONS_INCLUSION = 8
# Meaningful RB volume — excludes return specialists / goal-line only listings.
MIN_RUSH_ATTEMPTS_INCLUSION = 40
MIN_RUSH_YARDS_INCLUSION = 200


def _to_pandas(frame) -> pd.DataFrame:
    if isinstance(frame, pd.DataFrame):
        return frame
    return frame.to_pandas()


def _first_present(df: pd.DataFrame, candidates: list[str]) -> str | None:
    for col in candidates:
        if col in df.columns:
            return col
    return None


def _safe_num(value: Any, default: float = 0.0) -> float:
    if value is None:
        return default
    try:
        if isinstance(value, float) and value != value:  # NaN
            return default
        return float(value)
    except (TypeError, ValueError):
        return default


def player_info_map(players: pd.DataFrame | None = None) -> dict[str, dict[str, Any]]:
    """Map gsis player id -> college / draft fields from load_players()."""
    if players is None:
        players = _to_pandas(nfl.load_players())

    id_col = _first_present(players, ["gsis_id", "player_id", "gsisId"])
    if not id_col:
        return {}

    name_col = _first_present(
        players,
        ["display_name", "player_name", "full_name", "football_name"],
    )
    college_col = _first_present(players, ["college_name", "college", "college_conference"])
    pick_col = _first_present(players, ["draft_pick", "draft_number", "entry_number"])
    round_col = _first_present(players, ["draft_round", "entry_round"])
    year_col = _first_present(players, ["draft_year", "rookie_season", "entry_year"])
    espn_col = _first_present(players, ["espn_id", "espnId"])

    info: dict[str, dict[str, Any]] = {}
    for _, row in players.iterrows():
        player_id = row.get(id_col)
        if player_id is None or (isinstance(player_id, float) and pd.isna(player_id)):
            continue
        pid = str(player_id).strip()
        if not pid or pid.lower() == "nan":
            continue
        espn_raw = None if not espn_col else row.get(espn_col)
        espn_id: str | None = None
        if espn_raw is not None and not (isinstance(espn_raw, float) and pd.isna(espn_raw)):
            text = str(espn_raw).strip()
            if text and text.lower() != "nan":
                try:
                    espn_id = str(int(float(text)))
                except (TypeError, ValueError):
                    espn_id = text
        info[pid] = {
            "name": None if not name_col else row.get(name_col),
            "college": None if not college_col else row.get(college_col),
            "draftPick": None if not pick_col else row.get(pick_col),
            "draftRound": None if not round_col else row.get(round_col),
            "draftYear": None if not year_col else row.get(year_col),
            "espnId": espn_id,
        }
    return info


def _roster_ids_for_position(seasons: list[int], position: str) -> set[str]:
    print(f"    Loading rosters for {seasons[0]}–{seasons[-1]} ({position})...")
    rosters = _to_pandas(nfl.load_rosters(seasons))
    position_col = _first_present(rosters, ["position", "pos"])
    if not position_col:
        raise RuntimeError("rosters missing position column")
    filtered = rosters[rosters[position_col].astype(str).str.upper() == position.upper()]
    roster_id_col = _first_present(filtered, ["gsis_id", "player_id", "gsisId"])
    if not roster_id_col:
        raise RuntimeError("rosters missing gsis/player id column")
    ids = set(filtered[roster_id_col].dropna().astype(str))
    print(f"    Unique roster {position}s: {len(ids)}")
    return ids


def _qb_ids_from_rosters(seasons: list[int]) -> set[str]:
    return _roster_ids_for_position(seasons, "QB")


def _wr_ids_from_rosters(seasons: list[int]) -> set[str]:
    return _roster_ids_for_position(seasons, "WR")


def _rb_ids_from_rosters(seasons: list[int]) -> set[str]:
    return _roster_ids_for_position(seasons, "RB")


def _aggregate_player_season_rows(
    rows: list[dict[str, Any]],
    *,
    primary_keys: tuple[str, ...] = ("attempts", "games", "passYds"),
) -> dict[str, Any]:
    """
    Ensure one row per player-season.

    Multi-team rule (also documented in metadata.statsNotes):
    nflverse reg season summaries already expose one total row per player with
    recent_team = last club that season. If duplicate split rows appear, keep the
    highest-volume row so totals are not double-counted.
    """
    if len(rows) == 1:
        return rows[0]

    return max(
        rows,
        key=lambda r: tuple(_safe_num(r.get(k)) for k in primary_keys),
    )


def _load_reg_stats(seasons: list[int]) -> pd.DataFrame:
    print(f"    Loading player stats (reg) for {len(seasons)} seasons...")
    stats = _to_pandas(nfl.load_player_stats(seasons, summary_level="reg"))
    print(f"    Stat rows: {len(stats)}")
    stats_id_col = _first_present(stats, ["player_id", "gsis_id", "gsisId"])
    if not stats_id_col:
        raise RuntimeError("player stats missing player_id column")
    stats = stats.copy()
    stats["player_id_str"] = stats[stats_id_col].astype(str)
    return stats


def _common_stat_cols(frame: pd.DataFrame) -> dict[str, str | None]:
    return {
        "name": _first_present(
            frame,
            ["player_display_name", "player_name", "display_name", "full_name"],
        ),
        "team": _first_present(frame, ["recent_team", "team", "team_abbr"]),
        "games": _first_present(frame, ["games", "gp"]),
        "season": _first_present(frame, ["season"]),
        "pass_yds": _first_present(frame, ["passing_yards", "pass_yards", "passYds"]),
        "pass_td": _first_present(frame, ["passing_tds", "pass_tds", "passTd"]),
        "ints": _first_present(frame, ["interceptions", "passing_interceptions", "ints"]),
        "cmp": _first_present(frame, ["completions", "passing_completions"]),
        "att": _first_present(frame, ["attempts", "passing_attempts"]),
        "rush_yds": _first_present(frame, ["rushing_yards", "rush_yards", "rushYds"]),
        "rush_td": _first_present(frame, ["rushing_tds", "rush_tds", "rushTd"]),
        "rush_att": _first_present(
            frame, ["carries", "rushing_attempts", "rush_attempts", "attempts_rush"]
        ),
        "rec": _first_present(frame, ["receptions", "receiving_receptions"]),
        "targets": _first_present(frame, ["targets", "receiving_targets"]),
        "rec_yds": _first_present(frame, ["receiving_yards", "rec_yards", "recYds"]),
        "rec_td": _first_present(frame, ["receiving_tds", "rec_tds", "recTd"]),
    }


def _base_season_dict(row: pd.Series, cols: dict[str, str | None], position: str) -> dict[str, Any]:
    name_col = cols["name"]
    team_col = cols["team"]
    games_col = cols["games"]
    season_col = cols["season"]
    assert name_col and team_col and games_col and season_col
    return {
        "playerId": str(row["player_id_str"]),
        "playerName": row.get(name_col),
        "season": int(row[season_col]),
        "team": row.get(team_col),
        "position": position,
        "games": _safe_num(row.get(games_col)),
        "passYds": row.get(cols["pass_yds"]) if cols["pass_yds"] else 0,
        "passTd": row.get(cols["pass_td"]) if cols["pass_td"] else 0,
        "interceptions": row.get(cols["ints"]) if cols["ints"] else 0,
        "completions": row.get(cols["cmp"]) if cols["cmp"] else 0,
        "attempts": row.get(cols["att"]) if cols["att"] else 0,
        "rushYds": row.get(cols["rush_yds"]) if cols["rush_yds"] else 0,
        "rushTd": row.get(cols["rush_td"]) if cols["rush_td"] else 0,
        "receptions": row.get(cols["rec"]) if cols["rec"] else 0,
        "targets": row.get(cols["targets"]) if cols["targets"] else 0,
        "recYds": row.get(cols["rec_yds"]) if cols["rec_yds"] else 0,
        "recTd": row.get(cols["rec_td"]) if cols["rec_td"] else 0,
        "honors": empty_honors(),  # filled later by fetch_awards / merge
    }


def fetch_modern_qb_season_rows(
    first_year: int,
    last_year: int,
    *,
    skip_awards: bool = True,
    stats: pd.DataFrame | None = None,
) -> tuple[list[dict[str, Any]], dict[str, dict[str, Any]]]:
    """
    Load all modern QBs with regular-season stats for first_year..last_year.

    Returns (raw season rows, player_info_by_id).
    Honors are empty stubs when skip_awards is True (current default path).
    """
    seasons = list(range(first_year, last_year + 1))
    if not seasons:
        return [], {}

    if stats is None:
        stats = _load_reg_stats(seasons)

    qb_ids = _qb_ids_from_rosters(seasons)
    qb_stats = stats[stats["player_id_str"].isin(qb_ids)].copy()

    attempt_col = _first_present(stats, ["attempts", "passing_attempts"])
    if attempt_col:
        passers = stats[stats[attempt_col].fillna(0) >= MIN_PASS_ATTEMPTS_INCLUSION].copy()
        qb_stats = pd.concat([qb_stats, passers], ignore_index=True)
        qb_stats = qb_stats.drop_duplicates(
            subset=["player_id_str", "season"]
            if "season" in qb_stats.columns
            else ["player_id_str"]
        )

    print(f"    QB / passer season rows (pre-merge): {len(qb_stats)}")

    cols = _common_stat_cols(qb_stats)
    if not cols["name"]:
        raise RuntimeError("player stats missing name column")
    if not cols["season"] or not cols["team"] or not cols["games"]:
        raise RuntimeError("player stats missing season/team/games columns")

    grouped: dict[tuple[str, int], list[dict[str, Any]]] = {}
    for _, row in qb_stats.iterrows():
        games = _safe_num(row.get(cols["games"]))
        if games < MIN_GAMES_PER_SEASON:
            continue
        player_id = str(row["player_id_str"])
        season = int(row[cols["season"]])
        grouped.setdefault((player_id, season), []).append(
            _base_season_dict(row, cols, "QB")
        )

    raw_rows = [
        _aggregate_player_season_rows(
            group,
            primary_keys=("attempts", "games", "passYds"),
        )
        for group in grouped.values()
    ]
    print(f"    Unique QB player-season rows: {len(raw_rows)}")

    print("    Loading players for college / draft...")
    player_info = player_info_map()
    print(f"    Player bios available: {len(player_info)}")

    return raw_rows, player_info


def fetch_modern_wr_season_rows(
    first_year: int,
    last_year: int,
    *,
    skip_awards: bool = True,
    stats: pd.DataFrame | None = None,
    player_info: dict[str, dict[str, Any]] | None = None,
) -> tuple[list[dict[str, Any]], dict[str, dict[str, Any]]]:
    """
    Load modern WRs with meaningful receiving volume for first_year..last_year.

    Inclusion: roster position WR, plus receptions/targets threshold so
    special-teamers and gadget listings with tiny usage are dropped. QBs are
    never included via receiving volume alone.
    """
    del skip_awards  # honors filled later, same as QB path
    seasons = list(range(first_year, last_year + 1))
    if not seasons:
        return [], {}

    if stats is None:
        stats = _load_reg_stats(seasons)

    wr_ids = _wr_ids_from_rosters(seasons)
    wr_stats = stats[stats["player_id_str"].isin(wr_ids)].copy()

    cols = _common_stat_cols(wr_stats)
    if not cols["name"]:
        raise RuntimeError("player stats missing name column")
    if not cols["season"] or not cols["team"] or not cols["games"]:
        raise RuntimeError("player stats missing season/team/games columns")

    rec_col = cols["rec"]
    tgt_col = cols["targets"]
    if rec_col or tgt_col:
        volume_mask = pd.Series(False, index=wr_stats.index)
        if rec_col:
            volume_mask = volume_mask | (
                wr_stats[rec_col].fillna(0) >= MIN_RECEPTIONS_INCLUSION
            )
        if tgt_col:
            volume_mask = volume_mask | (
                wr_stats[tgt_col].fillna(0) >= MIN_TARGETS_INCLUSION
            )
        wr_stats = wr_stats[volume_mask].copy()

    print(f"    WR season rows (pre-merge, volume-filtered): {len(wr_stats)}")

    grouped: dict[tuple[str, int], list[dict[str, Any]]] = {}
    for _, row in wr_stats.iterrows():
        games = _safe_num(row.get(cols["games"]))
        if games < MIN_GAMES_PER_SEASON:
            continue
        player_id = str(row["player_id_str"])
        season = int(row[cols["season"]])
        grouped.setdefault((player_id, season), []).append(
            _base_season_dict(row, cols, "WR")
        )

    raw_rows = [
        _aggregate_player_season_rows(
            group,
            primary_keys=("targets", "receptions", "recYds", "games"),
        )
        for group in grouped.values()
    ]
    print(f"    Unique WR player-season rows: {len(raw_rows)}")

    if player_info is None:
        print("    Loading players for college / draft...")
        player_info = player_info_map()
        print(f"    Player bios available: {len(player_info)}")

    return raw_rows, player_info


def fetch_modern_rb_season_rows(
    first_year: int,
    last_year: int,
    *,
    skip_awards: bool = True,
    stats: pd.DataFrame | None = None,
    player_info: dict[str, dict[str, Any]] | None = None,
) -> tuple[list[dict[str, Any]], dict[str, dict[str, Any]]]:
    """
    Load modern RBs with meaningful rushing volume for first_year..last_year.

    Inclusion: roster position RB, plus rush attempts/yards threshold so
    return specialists and tiny-usage listings are dropped.
    """
    del skip_awards
    seasons = list(range(first_year, last_year + 1))
    if not seasons:
        return [], {}

    if stats is None:
        stats = _load_reg_stats(seasons)

    rb_ids = _rb_ids_from_rosters(seasons)
    rb_stats = stats[stats["player_id_str"].isin(rb_ids)].copy()

    cols = _common_stat_cols(rb_stats)
    if not cols["name"]:
        raise RuntimeError("player stats missing name column")
    if not cols["season"] or not cols["team"] or not cols["games"]:
        raise RuntimeError("player stats missing season/team/games columns")

    rush_att_col = cols["rush_att"]
    rush_yds_col = cols["rush_yds"]
    if rush_att_col or rush_yds_col:
        volume_mask = pd.Series(False, index=rb_stats.index)
        if rush_att_col:
            volume_mask = volume_mask | (
                rb_stats[rush_att_col].fillna(0) >= MIN_RUSH_ATTEMPTS_INCLUSION
            )
        if rush_yds_col:
            volume_mask = volume_mask | (
                rb_stats[rush_yds_col].fillna(0) >= MIN_RUSH_YARDS_INCLUSION
            )
        rb_stats = rb_stats[volume_mask].copy()

    print(f"    RB season rows (pre-merge, volume-filtered): {len(rb_stats)}")

    grouped: dict[tuple[str, int], list[dict[str, Any]]] = {}
    for _, row in rb_stats.iterrows():
        games = _safe_num(row.get(cols["games"]))
        if games < MIN_GAMES_PER_SEASON:
            continue
        player_id = str(row["player_id_str"])
        season = int(row[cols["season"]])
        grouped.setdefault((player_id, season), []).append(
            _base_season_dict(row, cols, "RB")
        )

    raw_rows = [
        _aggregate_player_season_rows(
            group,
            primary_keys=("rushYds", "receptions", "games"),
        )
        for group in grouped.values()
    ]
    print(f"    Unique RB player-season rows: {len(raw_rows)}")

    if player_info is None:
        print("    Loading players for college / draft...")
        player_info = player_info_map()
        print(f"    Player bios available: {len(player_info)}")

    return raw_rows, player_info


def fetch_modern_season_rows(
    first_year: int,
    last_year: int,
    *,
    skip_awards: bool = True,
) -> tuple[list[dict[str, Any]], dict[str, dict[str, Any]]]:
    """Fetch QB + WR + RB modern season rows (shared stats load, one player_info map)."""
    seasons = list(range(first_year, last_year + 1))
    if not seasons:
        return [], {}

    stats = _load_reg_stats(seasons)
    qb_rows, player_info = fetch_modern_qb_season_rows(
        first_year,
        last_year,
        skip_awards=skip_awards,
        stats=stats,
    )
    wr_rows, player_info = fetch_modern_wr_season_rows(
        first_year,
        last_year,
        skip_awards=skip_awards,
        stats=stats,
        player_info=player_info,
    )
    rb_rows, player_info = fetch_modern_rb_season_rows(
        first_year,
        last_year,
        skip_awards=skip_awards,
        stats=stats,
        player_info=player_info,
    )

    # Prefer skill position specificity: RB < WR < QB when a player appears in
    # more than one bucket for the same season (rare).
    by_key: dict[tuple[str, int], dict[str, Any]] = {}
    for row in rb_rows:
        by_key[(row["playerId"], int(row["season"]))] = row
    for row in wr_rows:
        by_key[(row["playerId"], int(row["season"]))] = row
    for row in qb_rows:
        by_key[(row["playerId"], int(row["season"]))] = row

    combined = list(by_key.values())
    print(
        f"    Combined modern rows: {len(combined)} "
        f"(QB={len(qb_rows)}, WR={len(wr_rows)}, RB={len(rb_rows)})"
    )
    return combined, player_info
