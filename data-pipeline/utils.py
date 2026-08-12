"""Shared helpers for NBA API fetching."""

from __future__ import annotations

import json
import time
from pathlib import Path
from typing import Any, Callable, TypeVar

from config import MAX_RETRIES, REQUEST_DELAY_SEC, RETRY_BACKOFF_SEC

T = TypeVar("T")

_last_request_at = 0.0


def throttle() -> None:
    """Space out requests to stats.nba.com."""
    global _last_request_at
    now = time.monotonic()
    elapsed = now - _last_request_at
    if elapsed < REQUEST_DELAY_SEC:
        time.sleep(REQUEST_DELAY_SEC - elapsed)
    _last_request_at = time.monotonic()


def retry_api_call(fn: Callable[[], T]) -> T:
    """Call an nba_api endpoint with throttling and retries."""
    last_error: Exception | None = None
    for attempt in range(MAX_RETRIES):
        try:
            throttle()
            return fn()
        except Exception as exc:  # noqa: BLE001 — API errors vary
            last_error = exc
            if attempt < MAX_RETRIES - 1:
                time.sleep(RETRY_BACKOFF_SEC * (attempt + 1))
    raise RuntimeError(f"NBA API call failed after {MAX_RETRIES} attempts") from last_error


def season_label(year: int) -> str:
    """Convert start year (e.g. 2012) to NBA season string (e.g. 2012-13)."""
    return f"{year}-{str(year + 1)[-2:]}"


def season_year_from_label(label: str) -> int:
    """Convert '2012-13' -> 2012."""
    return int(label.split("-")[0])


def iter_season_years(first_year: int, last_year: int) -> list[int]:
    return list(range(first_year, last_year + 1))


def current_season_start_year() -> int:
    """Approximate current NBA season start year (Oct–Jun league year)."""
    from datetime import date

    today = date.today()
    return today.year if today.month >= 10 else today.year - 1


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


def format_player_name(raw: str) -> str:
    """Convert 'Chamberlain, Wilt' -> 'Wilt Chamberlain'."""
    text = raw.strip()
    if "," in text:
        last, first = text.split(",", 1)
        return f"{first.strip()} {last.strip()}".strip()
    return text
