interface WinBannerProps {
  date: string;
}

export function WinBanner({ date }: WinBannerProps) {
  return (
    <div className="win-banner" role="status">
      <div className="win-card">
        <p className="eyebrow">Puzzle complete</p>
        <h2>You filled the grid!</h2>
        <p>Nice work on {date}.</p>
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
