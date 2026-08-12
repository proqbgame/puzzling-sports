import { useEffect, useMemo, useState } from "react";

import type { NbaDatabase } from "./data/NbaDatabase.js";
import type { NflDatabase } from "./data/NflDatabase.js";
import { fillNbaGiveUpBoard } from "./puzzle/giveUpFill.js";
import { puzzleDefinitionFromFile } from "./puzzle/loadPuzzle.js";
import { fillNflGiveUpBoard } from "./puzzle/nfl/giveUpFill.js";
import { puzzleDefinitionFromNflFile } from "./puzzle/nfl/loadPuzzle.js";
import type { DailyPuzzleFile } from "./puzzle/types.js";
import type { DailyNflPuzzleFile } from "./puzzle/nfl/types.js";
import type { CellId } from "./rules/grid.js";
import {
  isPuzzleComplete as isNbaPuzzleComplete,
  validateGuess as validateNbaGuess,
  type BoardState as NbaBoardState,
  type GameMode,
  type PuzzleDefinition as NbaPuzzleDefinition,
} from "./rules/validateGuess.js";
import {
  isPuzzleComplete as isNflPuzzleComplete,
  validateGuess as validateNflGuess,
  type BoardState as NflBoardState,
  type PuzzleDefinition as NflPuzzleDefinition,
} from "./rules/nfl/validateGuess.js";
import type { PlayerSeasonAssignment as NbaAssignment } from "./types/nba.js";
import type { PlayerSeasonAssignment as NflAssignment } from "./types/nfl.js";
import {
  getPuzzleDateFromUrl,
  loadDailyPuzzleBrowser,
  loadNbaDataBrowser,
} from "./web/loadNbaDataBrowser.js";
import {
  getNflPositionFromUrl,
  getSportFromUrl,
  loadDailyNflPuzzleBrowser,
  loadNflDataBrowser,
} from "./web/loadNflDataBrowser.js";
import { GameHeader } from "./components/GameHeader.js";
import { GuessPanel } from "./components/GuessPanel.js";
import { PuzzleGrid } from "./components/PuzzleGrid.js";
import { WinBanner } from "./components/WinBanner.js";
import "./App.css";

type NbaReady = {
  status: "ready";
  sport: "nba";
  db: NbaDatabase;
  puzzleFile: DailyPuzzleFile;
  definition: NbaPuzzleDefinition;
};

type NflReady = {
  status: "ready";
  sport: "nfl";
  db: NflDatabase;
  puzzleFile: DailyNflPuzzleFile;
  definition: NflPuzzleDefinition;
};

type LoadState =
  | { status: "loading"; message: string }
  | { status: "error"; message: string }
  | NbaReady
  | NflReady;

export default function App() {
  const [loadState, setLoadState] = useState<LoadState>({
    status: "loading",
    message: "Loading game data…",
  });
  const [mode, setMode] = useState<GameMode>("easy");
  const [nbaBoard, setNbaBoard] = useState<NbaBoardState>({});
  const [nflBoard, setNflBoard] = useState<NflBoardState>({});
  const [selectedCell, setSelectedCell] = useState<CellId | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [gaveUp, setGaveUp] = useState(false);

  const sport = useMemo(() => getSportFromUrl(), []);
  const puzzleDate = useMemo(() => getPuzzleDateFromUrl(), []);
  const nflPosition = useMemo(() => getNflPositionFromUrl(), []);

  useEffect(() => {
    let cancelled = false;

    async function load(): Promise<void> {
      if (sport === null) {
        return;
      }

      try {
        if (sport === "nfl") {
          setLoadState({ status: "loading", message: "Loading NFL data…" });
          const db = await loadNflDataBrowser();

          setLoadState({
            status: "loading",
            message: "Loading today’s NFL puzzle…",
          });
          const puzzleFile = await loadDailyNflPuzzleBrowser(
            puzzleDate,
            nflPosition,
          );
          const definition = puzzleDefinitionFromNflFile(puzzleFile, db);

          if (!definition) {
            throw new Error("Could not load puzzle base player from NFL database.");
          }

          if (!cancelled) {
            setLoadState({
              status: "ready",
              sport: "nfl",
              db,
              puzzleFile,
              definition,
            });
          }
          return;
        }

        setLoadState({ status: "loading", message: "Loading NBA data…" });
        const db = await loadNbaDataBrowser();

        setLoadState({ status: "loading", message: "Loading today’s puzzle…" });
        const puzzleFile = await loadDailyPuzzleBrowser(puzzleDate);
        const definition = puzzleDefinitionFromFile(puzzleFile, db);

        if (!definition) {
          throw new Error("Could not load puzzle base player from NBA database.");
        }

        if (!cancelled) {
          setLoadState({
            status: "ready",
            sport: "nba",
            db,
            puzzleFile,
            definition,
          });
        }
      } catch (error) {
        if (!cancelled) {
          setLoadState({
            status: "error",
            message:
              error instanceof Error ? error.message : "Failed to load game data.",
          });
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [sport, puzzleDate, nflPosition]);

  const filledCount =
    loadState.status === "ready" && loadState.sport === "nfl"
      ? Object.keys(nflBoard).length
      : Object.keys(nbaBoard).length;

  const won =
    loadState.status === "ready" &&
    !gaveUp &&
    (loadState.sport === "nba"
      ? isNbaPuzzleComplete(loadState.definition, nbaBoard)
      : isNflPuzzleComplete(loadState.definition, nflBoard));

  function handleSubmitGuess(playerName: string, season?: string): void {
    if (loadState.status !== "ready" || !selectedCell || gaveUp) {
      return;
    }

    if (loadState.sport === "nfl") {
      const result = validateNflGuess(
        loadState.db,
        loadState.definition,
        nflBoard,
        mode,
        {
          cellId: selectedCell,
          playerName,
          season,
        },
      );

      if (result.valid && result.assignment) {
        setNflBoard((current) => ({
          ...current,
          [selectedCell]: result.assignment as NflAssignment,
        }));
        setFeedback(null);
        setSelectedCell(null);
        return;
      }

      setFeedback(result.failures[0]?.message ?? "That guess does not fit.");
      return;
    }

    const result = validateNbaGuess(
      loadState.db,
      loadState.definition,
      nbaBoard,
      mode,
      {
        cellId: selectedCell,
        playerName,
        season,
      },
    );

    if (result.valid && result.assignment) {
      setNbaBoard((current) => ({
        ...current,
        [selectedCell]: result.assignment as NbaAssignment,
      }));
      setFeedback(null);
      setSelectedCell(null);
      return;
    }

    setFeedback(result.failures[0]?.message ?? "That guess does not fit.");
  }

  function handleGiveUp(): void {
    if (loadState.status !== "ready" || gaveUp || filledCount >= 8) {
      return;
    }

    if (loadState.sport === "nfl") {
      const position =
        "position" in loadState.puzzleFile
          ? loadState.puzzleFile.position
          : nflPosition;
      const filled = fillNflGiveUpBoard(
        loadState.db,
        loadState.definition,
        nflBoard,
        position,
      );
      if (!filled) {
        setFeedback("Could not find a complete fill for the remaining cells.");
        return;
      }
      setNflBoard(filled);
      setGaveUp(true);
      setSelectedCell(null);
      setFeedback(null);
      return;
    }

    const filled = fillNbaGiveUpBoard(
      loadState.db,
      loadState.definition,
      nbaBoard,
    );
    if (!filled) {
      setFeedback("Could not find a complete fill for the remaining cells.");
      return;
    }
    setNbaBoard(filled);
    setGaveUp(true);
    setSelectedCell(null);
    setFeedback(null);
  }

  if (sport === null) {
    const nbaHref = `?sport=nba&date=${puzzleDate}`;
    const nflQbHref = `?sport=nfl&position=qb&date=${puzzleDate}`;
    const nflWrHref = `?sport=nfl&position=wr&date=${puzzleDate}`;
    const nflRbHref = `?sport=nfl&position=rb&date=${puzzleDate}`;
    return (
      <div className="app-shell">
        <div className="loading-card sport-picker">
          <p className="eyebrow">Puzzling Sports</p>
          <h1>Choose a sport</h1>
          <p>
            Date <code>{puzzleDate}</code> — pick NBA, NFL QB, NFL WR, or NFL RB.
          </p>
          <div className="sport-picker-actions">
            <a className="sport-picker-link" href={nbaHref}>
              NBA
            </a>
            <a className="sport-picker-link" href={nflQbHref}>
              NFL QB
            </a>
            <a className="sport-picker-link" href={nflWrHref}>
              NFL WR
            </a>
            <a className="sport-picker-link" href={nflRbHref}>
              NFL RB
            </a>
          </div>
        </div>
      </div>
    );
  }

  if (loadState.status === "loading") {
    return (
      <div className="app-shell">
        <div className="loading-card">
          <div className="loading-spinner" />
          <p>{loadState.message}</p>
          <p className="hint">This can take 10–20 seconds on first load.</p>
        </div>
      </div>
    );
  }

  if (loadState.status === "error") {
    return (
      <div className="app-shell">
        <div className="loading-card error">
          <h1>Could not start game</h1>
          <p>{loadState.message}</p>
          <p className="hint">
            Puzzle date: <code>{puzzleDate}</code>
            {sport === "nfl" ? (
              <>
                . Try{" "}
                <code>
                  ?sport=nfl&amp;position={nflPosition}&amp;date={puzzleDate}
                </code>
                . Run{" "}
                <code>
                  npm run generate:nfl-puzzle -- {puzzleDate} {nflPosition}
                </code>
                , then <code>npm run sync:data</code>.
              </>
            ) : (
              <>
                . Looking for NBA at{" "}
                <code>/data/puzzles/nba/{puzzleDate}.json</code>. Try{" "}
                <code>?sport=nba&amp;date=2026-06-30</code>, or NFL QB:{" "}
                <code>?sport=nfl&amp;position=qb&amp;date={puzzleDate}</code>.
                Run <code>npm run generate:puzzle -- {puzzleDate}</code>, then{" "}
                <code>npm run sync:data</code>.
              </>
            )}
          </p>
          <div className="sport-picker-actions">
            <a className="sport-picker-link" href={`?date=${puzzleDate}`}>
              Home
            </a>
          </div>
        </div>
      </div>
    );
  }

  const { puzzleFile, definition } = loadState;
  const board = loadState.sport === "nfl" ? nflBoard : nbaBoard;

  return (
    <div className="app-shell">
      <GameHeader
        date={puzzleFile.date}
        mode={mode}
        filledCount={filledCount}
        onModeChange={setMode}
        sport={loadState.sport}
        nflPosition={
          loadState.sport === "nfl" && "position" in puzzleFile
            ? puzzleFile.position
            : "qb"
        }
        giveUpDisabled={gaveUp || filledCount >= 8}
        onGiveUp={handleGiveUp}
      />

      <main className="game-layout">
        <PuzzleGrid
          sport={loadState.sport}
          puzzle={puzzleFile}
          definition={definition}
          board={board}
          selectedCell={gaveUp ? null : selectedCell}
          onSelectCell={gaveUp ? () => undefined : setSelectedCell}
        />

        <GuessPanel
          sport={loadState.sport}
          selectedCell={gaveUp ? null : selectedCell}
          puzzle={puzzleFile}
          board={board}
          mode={mode}
          feedback={feedback}
          onSubmit={handleSubmitGuess}
        />
      </main>

      {won ? <WinBanner date={puzzleFile.date} /> : null}
    </div>
  );
}
