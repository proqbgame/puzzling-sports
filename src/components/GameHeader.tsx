import { useState } from "react";
import type { GameMode } from "../rules/validateGuess.js";
import { ArchivePanel } from "./ArchivePanel.js";

interface GameHeaderProps {
  date: string;
  mode: GameMode;
  filledCount: number;
  onModeChange: (mode: GameMode) => void;
  sport?: "nba" | "nfl" | "mlb";
  nflPosition?: "qb" | "wr" | "rb";
  mlbPosition?: "pitcher" | "hitter";
  giveUpDisabled?: boolean;
  onGiveUp?: () => void;
}

export function GameHeader({
  date,
  mode,
  filledCount,
  onModeChange,
  sport = "nba",
  nflPosition = "qb",
  mlbPosition = "hitter",
  giveUpDisabled = false,
  onGiveUp,
}: GameHeaderProps) {
  const [archiveOpen, setArchiveOpen] = useState(false);
  const eyebrow =
    sport === "nfl"
      ? `Daily NFL ${nflPosition.toUpperCase()} Puzzle`
      : sport === "mlb"
        ? `Daily MLB ${mlbPosition.toUpperCase()} Puzzle`
        : "Daily NBA Puzzle";

  return (
    <>
      <header className="game-header">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h1>Puzzling Sports</h1>
          <p className="subhead">{formatDisplayDate(date)}</p>
        </div>

        <div className="header-actions">
          <div className="progress-pill">{filledCount} / 8 filled</div>
          <a className="header-nav-link" href={`?date=${date}`}>
            Home
          </a>
          <button
            type="button"
            className="header-nav-link"
            onClick={() => setArchiveOpen(true)}
          >
            Archive
          </button>
          {onGiveUp ? (
            <button
              type="button"
              className="header-nav-link give-up-button"
              onClick={onGiveUp}
              disabled={giveUpDisabled}
            >
              Give up
            </button>
          ) : null}
          <div className="mode-toggle" role="group" aria-label="Game mode">
            <button
              type="button"
              className={mode === "easy" ? "active" : ""}
              onClick={() => onModeChange("easy")}
            >
              Easy
            </button>
            <button
              type="button"
              className={mode === "hard" ? "active" : ""}
              onClick={() => onModeChange("hard")}
            >
              Hard
            </button>
          </div>
        </div>
      </header>

      <ArchivePanel
        open={archiveOpen}
        onClose={() => setArchiveOpen(false)}
        sport={sport}
        nflPosition={nflPosition}
        mlbPosition={mlbPosition}
        currentDate={date}
      />
    </>
  );
}

function formatDisplayDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}
