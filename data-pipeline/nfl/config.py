"""Configuration for the NFL data pipeline."""

from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent.parent
PIPELINE_DIR = Path(__file__).resolve().parent
CACHE_DIR = PIPELINE_DIR / "cache"
OUTPUT_DIR = ROOT_DIR / "data" / "nfl"
SPIKE_OUTPUT_DIR = OUTPUT_DIR / "_spike"

SPORT = "nfl"

# Super Bowl era starts with the 1966 season (Super Bowl I).
FIRST_SEASON_YEAR = 1966
# nflverse player stats (season totals) are solid from this year onward.
MODERN_STATS_START_YEAR = 1999
# Set to None to use the current NFL season (computed at runtime).
LAST_SEASON_YEAR = None

# Minimum games played in a season for that season row to be included.
MIN_GAMES_PER_SEASON = 1
