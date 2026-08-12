"""Shared helpers for the NFL data pipeline."""

from __future__ import annotations

import json
from datetime import date
from pathlib import Path
from typing import Any


def season_label(year: int) -> str:
    """Convert NFL season year (e.g. 2023) to label string \"2023\"."""
    return str(year)


def season_year_from_label(label: str) -> int:
    """Convert \"2023\" -> 2023."""
    return int(str(label).split("-")[0])


def iter_season_years(first_year: int, last_year: int) -> list[int]:
    return list(range(first_year, last_year + 1))


def current_season_start_year() -> int:
    """Approximate current NFL season year (Sep–Feb league year)."""
    today = date.today()
    return today.year if today.month >= 9 else today.year - 1


def load_json_cache(path: Path) -> Any | None:
    if path.exists():
        return json.loads(path.read_text(encoding="utf-8"))
    return None


def save_json_cache(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")


def write_json(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def empty_honors() -> dict[str, bool]:
    return {
        "mvp": False,
        "proBowl": False,
        "allPro": False,
        "sbMvp": False,
        "champion": False,
    }
