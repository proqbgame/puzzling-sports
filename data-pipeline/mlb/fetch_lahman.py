"""Load Lahman batting/pitching/awards into raw season rows + player info."""

from __future__ import annotations

from collections import defaultdict
from typing import Any

import pandas as pd
from lahman_local import load_table

from config import FIRST_SEASON_YEAR, MIN_HITTER_AB, MIN_PITCHER_IP
from utils import empty_honors, season_label

AWARD_MAP = {
    "Most Valuable Player": "mvp",
    "Cy Young Award": "cyYoung",
    "Silver Slugger": "silverSlugger",
    "Gold Glove": "goldGlove",
    "World Series MVP": "wsMvp",
}


def _safe_int(value: Any, default: int = 0) -> int:
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return default
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def _safe_float(value: Any, default: float = 0.0) -> float:
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return default
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _ip_from_outs(ipouts: Any) -> float:
    outs = _safe_int(ipouts, 0)
    whole, rem = divmod(outs, 3)
    return round(whole + rem / 10.0, 1)


def _display_name(row: pd.Series) -> str:
    first = str(row.get("nameFirst") or "").strip()
    last = str(row.get("nameLast") or "").strip()
    given = str(row.get("nameGiven") or "").strip()
    if first and last:
        return f"{first} {last}"
    if given and last:
        return f"{given} {last}"
    return last or given or "Unknown"


def _load_id_map() -> dict[str, dict[str, str | None]]:
    """Map Lahman playerID -> mlbam / espn ids via Chadwick."""
    mapping: dict[str, dict[str, str | None]] = {}
    try:
        from pybaseball import chadwick_register

        register = chadwick_register()
    except Exception as exc:  # noqa: BLE001
        print(f"    Warning: chadwick register unavailable ({exc})")
        return mapping

    if register is None or register.empty:
        return mapping

    bbref_col = "key_bbref" if "key_bbref" in register.columns else None
    mlbam_col = "key_mlbam" if "key_mlbam" in register.columns else None
    espn_col = "key_espn" if "key_espn" in register.columns else None
    if not bbref_col:
        return mapping

    for _, row in register.iterrows():
        bbref = row.get(bbref_col)
        if pd.isna(bbref) or not str(bbref).strip():
            continue
        mlbam = row.get(mlbam_col) if mlbam_col else None
        espn = row.get(espn_col) if espn_col else None
        mapping[str(bbref).strip()] = {
            "mlbamId": None
            if pd.isna(mlbam)
            else str(int(mlbam))
            if str(mlbam).replace(".0", "").isdigit()
            else str(mlbam).strip(),
            "espnId": None
            if pd.isna(espn)
            else str(int(espn))
            if str(espn).replace(".0", "").isdigit()
            else str(espn).strip(),
        }
    return mapping


def _college_by_player() -> dict[str, str]:
    try:
        playing = load_table("CollegePlaying")
        school_table = load_table("Schools")
    except Exception as exc:  # noqa: BLE001
        print(f"    Warning: college tables unavailable ({exc})")
        return {}
    if playing is None or playing.empty or school_table is None or school_table.empty:
        return {}

    name_col = "name_full" if "name_full" in school_table.columns else "name"
    names = {
        str(row["schoolID"]): str(row.get(name_col) or row["schoolID"])
        for _, row in school_table.iterrows()
        if not pd.isna(row.get("schoolID"))
    }
    # Prefer the most recent college listed.
    playing = playing.sort_values(["playerID", "yearID"])
    latest: dict[str, str] = {}
    for _, row in playing.iterrows():
        player_id = str(row["playerID"])
        school_id = str(row.get("schoolID") or "")
        name = names.get(school_id)
        if name:
            latest[player_id] = name
    return latest


def _aggregate_batting(first_year: int, last_year: int) -> pd.DataFrame:
    df = load_table("Batting")
    df = df[(df["yearID"] >= first_year) & (df["yearID"] <= last_year)].copy()
    grouped = (
        df.groupby(["playerID", "yearID"], as_index=False)
        .agg(
            {
                "G": "sum",
                "AB": "sum",
                "H": "sum",
                "HR": "sum",
                "RBI": "sum",
                "SB": "sum",
                "teamID": "last",
            }
        )
    )
    grouped = grouped[grouped["AB"] >= MIN_HITTER_AB]
    grouped["avg"] = grouped.apply(
        lambda row: round(row["H"] / row["AB"], 3) if row["AB"] else 0.0,
        axis=1,
    )
    return grouped


def _era_from_outs(er: Any, ipouts: Any) -> float:
    outs = _safe_int(ipouts, 0)
    earned = _safe_int(er, 0)
    if outs <= 0:
        return 0.0
    return round(earned * 27.0 / outs, 2)


def _aggregate_pitching(first_year: int, last_year: int) -> pd.DataFrame:
    df = load_table("Pitching")
    df = df[(df["yearID"] >= first_year) & (df["yearID"] <= last_year)].copy()
    grouped = (
        df.groupby(["playerID", "yearID"], as_index=False)
        .agg(
            {
                "G": "sum",
                "W": "sum",
                "SO": "sum",
                "ER": "sum",
                "IPouts": "sum",
                "teamID": "last",
            }
        )
    )
    grouped["ip"] = grouped["IPouts"].map(_ip_from_outs)
    grouped = grouped[grouped["ip"] >= MIN_PITCHER_IP]
    grouped["era"] = grouped.apply(
        lambda row: _era_from_outs(row.get("ER"), row.get("IPouts")),
        axis=1,
    )
    return grouped


def _honors_by_player(
    first_year: int,
    last_year: int,
) -> dict[str, dict[str, dict[str, bool]]]:
    honors: dict[str, dict[str, dict[str, bool]]] = defaultdict(
        lambda: defaultdict(empty_honors)
    )

    awards = load_table("AwardsPlayers")
    awards = awards[(awards["yearID"] >= first_year) & (awards["yearID"] <= last_year)]
    for _, row in awards.iterrows():
        honor_key = AWARD_MAP.get(str(row.get("awardID") or ""))
        if not honor_key:
            continue
        player_id = str(row["playerID"])
        season = season_label(int(row["yearID"]))
        honors[player_id][season][honor_key] = True

    stars = load_table("AllstarFull")
    stars = stars[(stars["yearID"] >= first_year) & (stars["yearID"] <= last_year)]
    for _, row in stars.iterrows():
        player_id = str(row["playerID"])
        season = season_label(int(row["yearID"]))
        honors[player_id][season]["allStar"] = True

    series = load_table("SeriesPost")
    series = series[
        (series["yearID"] >= first_year)
        & (series["yearID"] <= last_year)
        & (series["round"] == "WS")
    ]
    winners = {
        (int(row["yearID"]), str(row["teamIDwinner"]))
        for _, row in series.iterrows()
        if not pd.isna(row.get("teamIDwinner"))
    }

    for post in (load_table("BattingPost"), load_table("PitchingPost")):
        post = post[
            (post["yearID"] >= first_year)
            & (post["yearID"] <= last_year)
            & (post["round"] == "WS")
        ]
        for _, row in post.iterrows():
            year = int(row["yearID"])
            team = str(row.get("teamID") or "")
            if (year, team) not in winners:
                continue
            player_id = str(row["playerID"])
            honors[player_id][season_label(year)]["champion"] = True

    return honors


def fetch_mlb_season_rows(
    first_year: int,
    last_year: int,
) -> tuple[list[dict[str, Any]], dict[str, dict[str, Any]]]:
    print("    Loading Lahman people / batting / pitching...")
    people_df = load_table("People")
    batting_df = _aggregate_batting(first_year, last_year)
    pitching_df = _aggregate_pitching(first_year, last_year)
    print(f"    Hitter seasons (AB>={MIN_HITTER_AB}): {len(batting_df)}")
    print(f"    Pitcher seasons (IP>={MIN_PITCHER_IP}): {len(pitching_df)}")

    print("    Loading awards, All-Star, World Series...")
    honors_by_player = _honors_by_player(first_year, last_year)

    print("    Loading colleges and ID map...")
    colleges = _college_by_player()
    id_map = _load_id_map()

    people_by_id = {str(row["playerID"]): row for _, row in people_df.iterrows()}

    rows: list[dict[str, Any]] = []
    player_info: dict[str, dict[str, Any]] = {}

    def ensure_info(lahman_id: str) -> dict[str, Any]:
        if lahman_id in player_info:
            return player_info[lahman_id]
        person = people_by_id.get(lahman_id)
        ids = id_map.get(lahman_id, {})
        mlbam = ids.get("mlbamId")
        name = _display_name(person) if person is not None else lahman_id
        info = {
            "lahmanId": lahman_id,
            "name": name,
            "mlbamId": mlbam,
            "espnId": ids.get("espnId"),
            "college": colleges.get(lahman_id),
            "draftPick": None,
            "draftRound": None,
            "draftYear": None,
        }
        player_info[lahman_id] = info
        return info

    for _, row in batting_df.iterrows():
        lahman_id = str(row["playerID"])
        info = ensure_info(lahman_id)
        season = season_label(int(row["yearID"]))
        player_id = info["mlbamId"] or lahman_id
        rows.append(
            {
                "playerId": player_id,
                "lahmanId": lahman_id,
                "playerName": info["name"],
                "season": season,
                "team": str(row.get("teamID") or ""),
                "position": "H",
                "games": _safe_int(row.get("G"), 1) or 1,
                "ab": _safe_int(row.get("AB")),
                "hits": _safe_int(row.get("H")),
                "hr": _safe_int(row.get("HR")),
                "rbi": _safe_int(row.get("RBI")),
                "sb": _safe_int(row.get("SB")),
                "avg": _safe_float(row.get("avg")),
                "so": 0,
                "w": 0,
                "ip": 0.0,
                "era": 0.0,
                "honors": honors_by_player.get(lahman_id, {}).get(season, empty_honors()),
            }
        )

    for _, row in pitching_df.iterrows():
        lahman_id = str(row["playerID"])
        info = ensure_info(lahman_id)
        season = season_label(int(row["yearID"]))
        player_id = info["mlbamId"] or lahman_id
        rows.append(
            {
                "playerId": player_id,
                "lahmanId": lahman_id,
                "playerName": info["name"],
                "season": season,
                "team": str(row.get("teamID") or ""),
                "position": "P",
                "games": _safe_int(row.get("G"), 1) or 1,
                "ab": 0,
                "hits": 0,
                "hr": 0,
                "rbi": 0,
                "sb": 0,
                "avg": 0.0,
                "so": _safe_int(row.get("SO")),
                "w": _safe_int(row.get("W")),
                "ip": _safe_float(row.get("ip")),
                "era": _safe_float(row.get("era")),
                "honors": honors_by_player.get(lahman_id, {}).get(season, empty_honors()),
            }
        )

    # Re-key player_info by output playerId (mlbam when present).
    keyed: dict[str, dict[str, Any]] = {}
    for info in player_info.values():
        keyed[info["mlbamId"] or info["lahmanId"]] = info
    return rows, keyed
