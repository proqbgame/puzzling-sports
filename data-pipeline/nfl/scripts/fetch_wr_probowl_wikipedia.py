"""
Build / resume proBowlWr seed entries from Wikipedia Pro Bowl pages.

Event year YYYY covers NFL season (YYYY - 1).
Resumes from existing awards_seed.json proBowlWr entries.
"""

from __future__ import annotations

import json
import re
import time
import urllib.error
import urllib.request
from pathlib import Path

PIPELINE_DIR = Path(__file__).resolve().parents[1]
SEED_PATH = PIPELINE_DIR / "awards_seed.json"
OUT_PATH = PIPELINE_DIR / "cache" / "awards" / "proBowlWr_wikipedia.json"

EVENT_YEARS = list(range(2000, 2027))
UA = "PuzzlingSportsDataBot/1.0 (educational; awards seed builder)"
SLEEP_SEC = 2.5
MAX_RETRIES = 5


def _page_title(event_year: int) -> str:
    if event_year <= 2022:
        return f"{event_year}_Pro_Bowl"
    return f"{event_year}_Pro_Bowl_Games"


def _fetch_html(title: str) -> str:
    url = f"https://en.wikipedia.org/api/rest_v1/page/html/{title}"
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "text/html"})
    with urllib.request.urlopen(req, timeout=45) as resp:
        return resp.read().decode("utf-8", errors="replace")


def _fetch_with_retry(title: str) -> str:
    delay = SLEEP_SEC
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            return _fetch_html(title)
        except urllib.error.HTTPError as exc:
            if exc.code != 429 or attempt == MAX_RETRIES:
                raise
            wait = delay * attempt + 5
            print(f"  429 on {title}; sleeping {wait:.0f}s (attempt {attempt})")
            time.sleep(wait)
    raise RuntimeError(f"Failed to fetch {title}")


def _clean_name(raw: str) -> str:
    text = re.sub(r"<[^>]+>", "", raw)
    text = re.sub(r"\[[^\]]*\]", "", text)
    text = re.sub(r"\([^)]*\)", "", text)
    text = re.sub(r"[*†‡§]+", "", text)
    text = re.sub(r"\s+", " ", text).strip()
    text = re.sub(r"^\d+\s+", "", text).strip()
    return text


def _extract_wr_names(html: str) -> list[str]:
    names: list[str] = []
    rows = re.findall(r"<tr[^>]*>(.*?)</tr>", html, flags=re.I | re.S)
    for row in rows:
        cells = re.findall(r"<t[hd][^>]*>(.*?)</t[hd]>", row, flags=re.I | re.S)
        if not cells:
            continue
        pos = _clean_name(cells[0]).lower()
        if pos not in ("wide receiver", "wr", "wide receivers"):
            continue
        blob = " ".join(cells[1:])
        link_names = re.findall(r"<a[^>]*>([^<]+)</a>", blob, flags=re.I)
        candidates = link_names if link_names else re.split(r"<br\s*/?>|,|\n", blob, flags=re.I)
        for cand in candidates:
            name = _clean_name(cand)
            if not name or len(name) < 3:
                continue
            if name.lower() in {
                "starter",
                "starters",
                "reserve",
                "reserves",
                "alternate",
                "alternates",
                "afc",
                "nfc",
            }:
                continue
            if name not in names:
                names.append(name)
    return names


def main() -> None:
    seed = json.loads(SEED_PATH.read_text(encoding="utf-8"))
    by_season: dict[str, list[str]] = dict(seed.get("proBowlWr") or {})
    errors: list[str] = []

    for event_year in EVENT_YEARS:
        season = str(event_year - 1)
        if season in by_season and by_season[season]:
            print(f"{season}: skip (already have {len(by_season[season])} WRs)")
            continue

        title = _page_title(event_year)
        try:
            html = _fetch_with_retry(title)
            names = _extract_wr_names(html)
            if not names and event_year > 2022:
                html = _fetch_with_retry(f"{event_year}_Pro_Bowl")
                names = _extract_wr_names(html)
            if not names:
                errors.append(f"{season}: no WRs found on {title}")
                print(f"{season}: EMPTY")
            else:
                by_season[season] = names
                print(f"{season}: {len(names)} WRs from {title}")
                # Persist after each success so a later 429 doesn't wipe progress
                seed["proBowlWr"] = dict(sorted(by_season.items(), key=lambda kv: int(kv[0])))
                SEED_PATH.write_text(json.dumps(seed, indent=2) + "\n", encoding="utf-8")
        except Exception as exc:  # noqa: BLE001
            errors.append(f"{season}: {title} -> {exc}")
            print(f"FAIL {season}: {exc}")
        time.sleep(SLEEP_SEC)

    seed["proBowlWr"] = dict(sorted(by_season.items(), key=lambda kv: int(kv[0])))
    seed["notes"]["proBowlWr"] = (
        "Pro Bowl / Pro Bowl Games WR selections for that NFL season "
        "(starters, reserves, listed alternates from Wikipedia rosters). "
        "Selection counts as True even if the player sat out."
    )
    SEED_PATH.write_text(json.dumps(seed, indent=2) + "\n", encoding="utf-8")

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUT_PATH.write_text(
        json.dumps({"proBowlWr": seed["proBowlWr"], "errors": errors}, indent=2),
        encoding="utf-8",
    )
    print(f"\nSeasons filled: {len(seed['proBowlWr'])} / {len(EVENT_YEARS)}")
    if errors:
        print("Errors:")
        for e in errors:
            print(" ", e)


if __name__ == "__main__":
    main()
