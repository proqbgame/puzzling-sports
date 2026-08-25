import { formatDuration, formatOrdinal } from "../utils/leaderboard.js";

interface WinBannerProps {
  date: string;
  puzzleName: string;
  timeMs: number | null;
  rank: number | null;
  total: number | null;
  rankLoading: boolean;
}

export function WinBanner({
  date,
  puzzleName,
  timeMs,
  rank,
  total,
  rankLoading,
}: WinBannerProps) {
  const standing =
    rank !== null && total !== null
      ? `You ranked ${formatOrdinal(rank)} out of ${total.toLocaleString()} in today's ${puzzleName}.`
      : null;

  return (
    <div className="win-banner" role="status">
      <div className="win-card">
        <p className="eyebrow">Puzzle complete</p>
        <h2>You filled the grid!</h2>
        {timeMs !== null ? (
          <p className="win-time">Finish time: {formatDuration(timeMs)}</p>
        ) : null}
        {rankLoading ? (
          <p className="win-standing muted">Checking today&apos;s standings…</p>
        ) : standing ? (
          <p className="win-standing">{standing}</p>
        ) : (
          <p className="win-standing muted">
            Nice work on {date}. Daily rankings are unavailable right now.
          </p>
        )}
        <div className="win-actions">
          <a className="sport-picker-link" href={`?date=${date}`}>
            Choose another puzzle
          </a>
        </div>
        <p className="win-footnote">New puzzles at 12:00 AM Eastern.</p>
      </div>
    </div>
  );
}
