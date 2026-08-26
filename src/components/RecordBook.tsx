import { useEffect, useState } from "react";
import {
  RECORD_BOOK_GRIDS,
  fetchAllTimeRecords,
  formatDuration,
  type GridRecord,
  type RecordBookMode,
} from "../utils/leaderboard.js";

function dateFromPuzzleKey(puzzleKey: string | null): string | null {
  if (!puzzleKey) {
    return null;
  }
  const date = puzzleKey.split(":")[1];
  return date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null;
}

function formatRecordDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function RecordModeSection({
  mode,
  title,
  blurb,
  records,
}: {
  mode: RecordBookMode;
  title: string;
  blurb: string;
  records: GridRecord[];
}) {
  return (
    <div className="record-book-section">
      <div className="record-book-section-head">
        <h3 className="record-book-section-title">{title}</h3>
        <p className="record-book-section-blurb">{blurb}</p>
      </div>
      <ul className="record-book-list">
        {RECORD_BOOK_GRIDS.map((entry) => {
          const record = records.find(
            (item) => item.gridKey === entry.gridKey && item.mode === mode,
          );
          const date = dateFromPuzzleKey(record?.puzzleKey ?? null);
          return (
            <li key={`${mode}-${entry.gridKey}`} className="record-book-row">
              <div className="record-book-copy">
                <span className="record-book-label">{entry.label}</span>
                <span className="record-book-detail">{entry.detail}</span>
                {date ? (
                  <span className="record-book-date">
                    Set on {formatRecordDate(date)}
                  </span>
                ) : null}
              </div>
              <span className="record-book-time">
                {typeof record?.topTimeMs === "number"
                  ? formatDuration(record.topTimeMs)
                  : "—"}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function RecordBook() {
  const [records, setRecords] = useState<GridRecord[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void fetchAllTimeRecords()
      .then((next) => {
        if (!cancelled) {
          setRecords(next);
          setFailed(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setRecords([]);
          setFailed(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="record-book" aria-labelledby="record-book-heading">
      <p className="home-kicker">All-time bests</p>
      <h2 id="record-book-heading" className="home-rules-title">
        Record book
      </h2>
      <p className="record-book-lede">
        Fastest completion for each puzzle type, split by Easy and Hard mode.
      </p>

      {records === null ? (
        <p className="record-book-status">Loading records…</p>
      ) : failed ? (
        <p className="record-book-status">Records are unavailable right now.</p>
      ) : (
        <div className="record-book-modes">
          <RecordModeSection
            mode="easy"
            title="Easy mode"
            blurb="Name-only completions"
            records={records}
          />
          <RecordModeSection
            mode="hard"
            title="Hard mode"
            blurb="Name + season completions"
            records={records}
          />
        </div>
      )}
    </section>
  );
}
