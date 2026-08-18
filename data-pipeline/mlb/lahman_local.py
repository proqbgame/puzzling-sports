"""Download Lahman Baseball Database CSVs into the local cache.

Primary source is the 2025 SABR Lahman edition (through the previous
complete season) mirrored by daviddalpiaz/pylahman. Older Baseball Databank
forks are fallbacks only — they currently stop at 2021.
"""

from __future__ import annotations

from pathlib import Path

import pandas as pd
import requests

from config import CACHE_DIR

TABLE_FILES = {
    "People": ["data-raw/People.csv", "core/People.csv"],
    "Batting": ["data-raw/Batting.csv", "core/Batting.csv"],
    "Pitching": ["data-raw/Pitching.csv", "core/Pitching.csv"],
    "AwardsPlayers": ["data-raw/AwardsPlayers.csv", "core/AwardsPlayers.csv"],
    "AllstarFull": ["data-raw/AllstarFull.csv", "core/AllstarFull.csv"],
    "SeriesPost": ["data-raw/SeriesPost.csv", "core/SeriesPost.csv"],
    "BattingPost": ["data-raw/BattingPost.csv", "core/BattingPost.csv"],
    "PitchingPost": ["data-raw/PitchingPost.csv", "core/PitchingPost.csv"],
    "Teams": ["data-raw/Teams.csv", "core/Teams.csv"],
    "Schools": [
        "data-raw/Schools.csv",
        "core/Schools.csv",
        "contrib/Schools.csv",
    ],
    "CollegePlaying": [
        "data-raw/CollegePlaying.csv",
        "core/CollegePlaying.csv",
        "contrib/CollegePlaying.csv",
    ],
}

BASE_URLS = [
    "https://raw.githubusercontent.com/daviddalpiaz/pylahman/main",
    "https://raw.githubusercontent.com/cbwinslow/baseballdatabank/master",
    "https://raw.githubusercontent.com/cBrou/baseballdatabank/master",
    "https://raw.githubusercontent.com/chadwickbureau/baseballdatabank/master",
    "https://raw.githubusercontent.com/chadwickbureau/baseballdatabank/main",
]

HEADERS = {
    "User-Agent": "puzzling-sports-mlb-pipeline/1.0",
    "Accept": "text/csv,text/plain,*/*",
}


def cache_dir() -> Path:
    return CACHE_DIR / "lahman"


def clear_cache() -> None:
    root = cache_dir()
    if not root.exists():
        return
    for path in root.glob("*"):
        if path.is_file():
            path.unlink()


def _cache_path(relative: str) -> Path:
    return cache_dir() / relative.replace("/", "_")


def _read_csv(path: Path) -> pd.DataFrame:
    return pd.read_csv(path, encoding="utf-8-sig")


def _looks_like_lahman(header: str) -> bool:
    return any(
        token in header
        for token in ("playerID", "schoolID", "yearID", "teamID")
    )


def load_table(name: str) -> pd.DataFrame:
    relatives = TABLE_FILES[name]
    last_error: Exception | None = None
    for relative in relatives:
        dest = _cache_path(relative)
        if dest.exists() and dest.stat().st_size > 1000:
            return _read_csv(dest)
        dest.parent.mkdir(parents=True, exist_ok=True)
        for base in BASE_URLS:
            url = f"{base}/{relative}"
            try:
                response = requests.get(url, timeout=120, headers=HEADERS)
                response.raise_for_status()
                header = response.text.split("\n", 1)[0]
                if not _looks_like_lahman(header):
                    continue
                dest.write_bytes(response.content)
                print(f"    Cached {name} from {url}")
                return _read_csv(dest)
            except Exception as exc:  # noqa: BLE001
                last_error = exc
    raise RuntimeError(f"Could not download {name}: {last_error}")
