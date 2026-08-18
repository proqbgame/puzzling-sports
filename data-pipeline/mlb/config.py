"""Configuration for the MLB data pipeline."""

from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent.parent
PIPELINE_DIR = Path(__file__).resolve().parent
CACHE_DIR = PIPELINE_DIR / "cache"
OUTPUT_DIR = ROOT_DIR / "data" / "mlb"

SPORT = "mlb"

# Expansion / modern-stat era. Lahman batting/pitching go earlier; this keeps
# the puzzle pool recognizable and file size reasonable.
FIRST_SEASON_YEAR = 1961
LAST_SEASON_YEAR = None

# Minimum playing time for a season row to be included.
MIN_HITTER_AB = 80
MIN_PITCHER_IP = 20.0
