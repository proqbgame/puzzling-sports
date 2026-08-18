"""Shared helpers for the MLB data pipeline."""

from __future__ import annotations

import json
from datetime import date
from pathlib import Path
from typing import Any


def season_label(year: int) -> str:
    return str(year)


def season_year_from_label(label: str) -> int:
    return int(str(label).split("-")[0])


def current_season_year() -> int:
    """MLB season year (opens in March)."""
    today = date.today()
    return today.year if today.month >= 3 else today.year - 1


def write_json(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def empty_honors() -> dict[str, bool]:
    return {
        "mvp": False,
        "allStar": False,
        "cyYoung": False,
        "silverSlugger": False,
        "goldGlove": False,
        "wsMvp": False,
        "champion": False,
    }
