# NFL data pipeline

Python pipeline that builds Super Bowl–era QB data for Puzzling Sports. Modern QB seasons (1999→current) are supported; historical pre-1999 stats are still TBD.

## One-time setup (Windows PowerShell)

```powershell
cd "C:\Users\charl\Puzzling Sports\data-pipeline\nfl"
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

`requirements.txt` includes `nflreadpy`, `pandas`, `pyarrow`, and `tqdm`.

If activation fails with an execution-policy error:

```powershell
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
.\.venv\Scripts\Activate.ps1
```

## Modern build (with awards)

```powershell
cd "C:\Users\charl\Puzzling Sports\data-pipeline\nfl"
.\.venv\Scripts\Activate.ps1
python build.py --skip-historical
python validate.py
```

Skip awards (empty honors) with `--skip-awards`. Refresh the awards merge cache with `--refresh-all`.

## Spike (unchanged)

```powershell
python spike_sample.py
# or
.\build.ps1 -Spike
```

Spike output stays under `data/nfl/_spike/` and does not load awards.

## Awards

| Honor | Source |
|-------|--------|
| `champion` | nflverse `load_schedules` Super Bowl winner × `load_rosters` QBs that season |
| `mvp` | `awards_seed.json` (AP NFL MVP) |
| `sbMvp` | `awards_seed.json` (Super Bowl MVP, keyed to NFL season) |
| `allPro` | `awards_seed.json` (AP first-team All-Pro QBs) |
| `proBowl` | `awards_seed.json` (Pro Bowl selections for that season) |

nflreadpy has no awards endpoint; PFR HTML is blocked for automated clients, so individual awards ship as a maintained seed file.

## Config notes

- Super Bowl era start: `FIRST_SEASON_YEAR = 1966`
- Modern bulk stats: `MODERN_STATS_START_YEAR = 1999`
- Season labels: `"2023"` (NFL year), not NBA-style `"2023-24"`
- Paths: cache under `data-pipeline/nfl/cache`, output under `data/nfl/`
