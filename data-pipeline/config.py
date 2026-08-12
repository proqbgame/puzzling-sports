"""Configuration for the NBA data pipeline."""

from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent
PIPELINE_DIR = Path(__file__).resolve().parent
CACHE_DIR = PIPELINE_DIR / "cache"
OUTPUT_DIR = ROOT_DIR / "data" / "nba"

# First season with reliable modern stat tracking (BAA/NBA merged era).
FIRST_SEASON_YEAR = 1946
# LeagueDashPlayerStats (bulk per-season) works from this year onward.
MODERN_STATS_START_YEAR = 1996
# Set to None to use the current NBA season (computed at runtime).
LAST_SEASON_YEAR = None

# Minimum games played in a season for that season row to be included.
MIN_GAMES_PER_SEASON = 1

# Delay between NBA API requests (seconds) to reduce rate-limit errors.
REQUEST_DELAY_SEC = 0.7

# How many times to retry a failed API call.
MAX_RETRIES = 4
RETRY_BACKOFF_SEC = 2.0
