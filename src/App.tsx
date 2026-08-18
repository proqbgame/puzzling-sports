import { useEffect, useMemo, useState } from "react";

import type { NbaDatabase } from "./data/NbaDatabase.js";
import type { NflDatabase } from "./data/NflDatabase.js";
import type { MlbDatabase } from "./data/MlbDatabase.js";
import { fillNbaGiveUpBoard } from "./puzzle/giveUpFill.js";
import { puzzleDefinitionFromFile } from "./puzzle/loadPuzzle.js";
import { fillNflGiveUpBoard } from "./puzzle/nfl/giveUpFill.js";
import { puzzleDefinitionFromNflFile } from "./puzzle/nfl/loadPuzzle.js";
import { fillMlbGiveUpBoard } from "./puzzle/mlb/giveUpFill.js";
import { puzzleDefinitionFromMlbFile } from "./puzzle/mlb/loadPuzzle.js";
import type { DailyPuzzleFile } from "./puzzle/types.js";
import type { DailyNflPuzzleFile } from "./puzzle/nfl/types.js";
import type { DailyMlbPuzzleFile } from "./puzzle/mlb/types.js";
import type { CellId } from "./rules/grid.js";
import {
  isPuzzleComplete as isNbaPuzzleComplete,
  validateGuess as validateNbaGuess,
  type BoardState as NbaBoardState,
  type GameMode,
  type PuzzleDefinition as NbaPuzzleDefinition,
} from "./rules/validateGuess.js";
import {
  isPuzzleComplete as isMlbPuzzleComplete,
  validateGuess as validateMlbGuess,
  type BoardState as MlbBoardState,
  type PuzzleDefinition as MlbPuzzleDefinition,
} from "./rules/mlb/validateGuess.js";
import type { PlayerSeasonAssignment as NbaAssignment } from "./types/nba.js";
import type { PlayerSeasonAssignment as NflAssignment } from "./types/nfl.js";
import type { PlayerSeasonAssignment as MlbAssignment } from "./types/mlb.js";
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
import {
  getMlbPositionFromUrl,
  loadDailyMlbPuzzleBrowser,
  loadMlbDataBrowser,
} from "./web/loadMlbDataBrowser.js";
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

type MlbReady = {
  status: "ready";
  sport: "mlb";
  db: MlbDatabase;
  puzzleFile: DailyMlbPuzzleFile;
  definition: MlbPuzzleDefinition;
};

type LoadState =
  | { status: "loading"; message: string }
  | { status: "error"; message: string }
  | NbaReady
  | NflReady
  | MlbReady;

export default function App() {
  const [loadState, setLoadState] = useState<LoadState>({
    status: "loading",
    message: "Loading game data…",
  });
  const [mode, setMode] = useState<GameMode>("easy");
  const [nbaBoard, setNbaBoard] = useState<NbaBoardState>({});
  const [nflBoard, setNflBoard] = useState<NflBoardState>({});
  const [mlbBoard, setMlbBoard] = useState<MlbBoardState>({});
  const [selectedCell, setSelectedCell] = useState<CellId | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [gaveUp, setGaveUp] = useState(false);

  const sport = useMemo(() => getSportFromUrl(), []);
  const puzzleDate = useMemo(() => getPuzzleDateFromUrl(), []);
  const nflPosition = useMemo(() => getNflPositionFromUrl(), []);
  const mlbPosition = useMemo(() => getMlbPositionFromUrl(), []);

  useEffect(() => {
    let cancelled = false;

    async function load(): Promise<void> {
      if (sport === null) {
        return;
      }

      try {
        if (sport === "mlb") {
          setLoadState({ status: "loading", message: "Loading MLB data…" });
          const db = await loadMlbDataBrowser();

          setLoadState({
            status: "loading",
            message: "Loading today’s MLB puzzle…",
          });
          const puzzleFile = await loadDailyMlbPuzzleBrowser(
            puzzleDate,
            mlbPosition,
          );
          const definition = puzzleDefinitionFromMlbFile(puzzleFile, db);

          if (!definition) {
            throw new Error("Could not load puzzle base player from MLB database.");
          }

          if (!cancelled) {
            setLoadState({
              status: "ready",
              sport: "mlb",
              db,
              puzzleFile,
              definition,
            });
          }
          return;
        }

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
  }, [sport, puzzleDate, nflPosition, mlbPosition]);

  const filledCount =
    loadState.status === "ready" && loadState.sport === "nfl"
      ? Object.keys(nflBoard).length
      : loadState.status === "ready" && loadState.sport === "mlb"
        ? Object.keys(mlbBoard).length
        : Object.keys(nbaBoard).length;

  const won =
    loadState.status === "ready" &&
    !gaveUp &&
    (loadState.sport === "nba"
      ? isNbaPuzzleComplete(loadState.definition, nbaBoard)
      : loadState.sport === "mlb"
        ? isMlbPuzzleComplete(loadState.definition, mlbBoard)
        : isNflPuzzleComplete(loadState.definition, nflBoard));

  function handleSubmitGuess(playerName: string, season?: string): void {
    if (loadState.status !== "ready" || !selectedCell || gaveUp) {
      return;
    }

    if (loadState.sport === "mlb") {
      const result = validateMlbGuess(
        loadState.db,
        loadState.definition,
        mlbBoard,
        mode,
        {
          cellId: selectedCell,
          playerName,
          season,
        },
      );

      if (result.valid && result.assignment) {
        setMlbBoard((current) => ({
          ...current,
          [selectedCell]: result.assignment as MlbAssignment,
        }));
        setFeedback(null);
        setSelectedCell(null);
        return;
      }

      setFeedback(result.failures[0]?.message ?? "That guess does not fit.");
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

    if (loadState.sport === "mlb") {
      const position =
        loadState.puzzleFile.position === "pitcher" ? "pitcher" : "hitter";
      const filled = fillMlbGiveUpBoard(
        loadState.db,
        loadState.definition,
        mlbBoard,
        position,
      );
      if (!filled) {
        setFeedback("Could not find a complete fill for the remaining cells.");
        return;
      }
      setMlbBoard(filled);
      setGaveUp(true);
      setSelectedCell(null);
      setFeedback(null);
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
    const grids = [
      { href: `?sport=nba&date=${puzzleDate}`, label: "NBA", detail: "Points · rebounds · assists · blocks" },
      { href: `?sport=nfl&position=qb&date=${puzzleDate}`, label: "NFL QB", detail: "Pass yards · TD · COMP% · INT" },
      { href: `?sport=nfl&position=wr&date=${puzzleDate}`, label: "NFL WR", detail: "Rec yards · receptions · targets · TD" },
      { href: `?sport=nfl&position=rb&date=${puzzleDate}`, label: "NFL RB", detail: "Rush yards · rush TD · rec yards · rec TD" },
      { href: `?sport=mlb&position=hitter&date=${puzzleDate}`, label: "MLB Hitter", detail: "HR · RBI · AVG · SB" },
      { href: `?sport=mlb&position=pitcher&date=${puzzleDate}`, label: "MLB Pitcher", detail: "SO · W · IP · ERA" },
    ];
    return (
      <div className="home-shell">
        <div className="home-atmosphere" />
        <div className="home-stage">
          <p className="home-kicker">Puzzling Sports</p>
          <h1 className="home-brand">Choose a sport</h1>
          <p className="home-lede">
            Daily 3×3 sports puzzles. Date <code>{puzzleDate}</code>.
          </p>
          <nav className="home-grid-nav" aria-label="Sports">
            {grids.map((grid) => (
              <a key={grid.label} className="home-grid-card" href={grid.href}>
                <span className="home-grid-label">{grid.label}</span>
                <span className="home-grid-detail">{grid.detail}</span>
              </a>
            ))}
          </nav>
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
            ) : sport === "mlb" ? (
              <>
                . Try{" "}
                <code>
                  ?sport=mlb&amp;position={mlbPosition}&amp;date={puzzleDate}
                </code>
                . Run{" "}
                <code>
                  npm run generate:mlb-puzzle -- {puzzleDate} {mlbPosition}
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
  const board =
    loadState.sport === "nfl"
      ? nflBoard
      : loadState.sport === "mlb"
        ? mlbBoard
        : nbaBoard;

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
        mlbPosition={
          loadState.sport === "mlb" && "position" in puzzleFile
            ? puzzleFile.position
            : mlbPosition
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
