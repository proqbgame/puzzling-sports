import { useEffect, useState } from "react";
import {
  gridKeyForSport,
  type PuzzleArchiveIndex,
  type PuzzleGridKey,
} from "../puzzle/archiveIndex.js";
import { easternTodayIso } from "../utils/easternDate.js";

interface ArchivePanelProps {
  open: boolean;
  onClose: () => void;
  sport: "nba" | "nfl";
  nflPosition?: "qb" | "wr" | "rb";
  currentDate: string;
}

function hrefForDate(
  date: string,
  sport: "nba" | "nfl",
  nflPosition: "qb" | "wr" | "rb",
): string {
  if (sport === "nfl") {
    return `?sport=nfl&position=${nflPosition}&date=${date}`;
  }
  return `?sport=nba&date=${date}`;
}

function formatArchiveDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function ArchivePanel({
  open,
  onClose,
  sport,
  nflPosition = "qb",
  currentDate,
}: ArchivePanelProps) {
  const [index, setIndex] = useState<PuzzleArchiveIndex | null>(null);
  const [error, setError] = useState<string | null>(null);
  const today = easternTodayIso();
  const gridKey: PuzzleGridKey = gridKeyForSport(sport, nflPosition);

  useEffect(() => {
    if (!open) {
      return;
    }

    let cancelled = false;

    async function load(): Promise<void> {
      try {
        const response = await fetch("/data/puzzles/index.json");
        if (!response.ok) {
          throw new Error(`Could not load archive (${response.status})`);
        }
        const data = (await response.json()) as PuzzleArchiveIndex;
        if (!cancelled) {
          setIndex(data);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Could not load archive");
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [open]);

  if (!open) {
    return null;
  }

  const dates = index?.grids[gridKey] ?? [];
  const title =
    sport === "nfl"
      ? `NFL ${nflPosition.toUpperCase()} archive`
      : "NBA archive";

  return (
    <div className="archive-backdrop" role="presentation" onClick={onClose}>
      <aside
        className="archive-panel"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="archive-header">
          <div>
            <p className="panel-eyebrow">Past puzzles</p>
            <h2>{title}</h2>
          </div>
          <button type="button" className="archive-close" onClick={onClose}>
            Close
          </button>
        </div>

        <p className="archive-note">
          New puzzles publish at 12:00 AM Eastern. Dates use America/New_York.
        </p>

        {error ? <p className="archive-error">{error}</p> : null}

        {!error && !index ? (
          <p className="archive-loading">Loading archive…</p>
        ) : null}

        {index && dates.length === 0 ? (
          <p className="archive-empty">No saved puzzles for this grid yet.</p>
        ) : null}

        {dates.length > 0 ? (
          <ul className="archive-list">
            {dates.map((date) => {
              const isCurrent = date === currentDate;
              const isToday = date === today;
              return (
                <li key={date}>
                  <a
                    className={[
                      "archive-link",
                      isCurrent ? "is-current" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    href={hrefForDate(date, sport, nflPosition)}
                    aria-current={isCurrent ? "page" : undefined}
                  >
                    <span>{formatArchiveDate(date)}</span>
                    <span className="archive-meta">
                      {isToday ? "Today" : date}
                      {isCurrent ? " · playing" : ""}
                    </span>
                  </a>
                </li>
              );
            })}
          </ul>
        ) : null}
      </aside>
    </div>
  );
}
