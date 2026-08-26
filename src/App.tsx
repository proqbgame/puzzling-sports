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
  isPuzzleComplete as isNflPuzzleComplete,
  validateGuess as validateNflGuess,
  type BoardState as NflBoardState,
  type PuzzleDefinition as NflPuzzleDefinition,
} from "./rules/nfl/validateGuess.js";
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
import { formatAssignmentMiniStats } from "./components/PuzzleCell.js";
import { GuessPanel } from "./components/GuessPanel.js";
import { HomeSportNav } from "./components/HomeSportNav.js";
import { PuzzleGrid } from "./components/PuzzleGrid.js";
import { PuzzleTimer } from "./components/PuzzleTimer.js";
import { WinBanner } from "./components/WinBanner.js";
import { gridKeyForSport } from "./puzzle/archiveIndex.js";
import {
  puzzleDisplayName,
  puzzleKeyFor,
  submitCompletionTime,
} from "./utils/leaderboard.js";
import {
  loadGiveUpProgress,
  restoreMlbBoardFromProgress,
  restoreNbaBoardFromProgress,
  restoreNflBoardFromProgress,
  saveGiveUpProgress,
} from "./utils/puzzleProgress.js";
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
  const [finishTimeMs, setFinishTimeMs] = useState<number | null>(null);
  const [rankLoading, setRankLoading] = useState(false);
  const [rank, setRank] = useState<number | null>(null);
  const [rankTotal, setRankTotal] = useState<number | null>(null);
  const [topTimeMs, setTopTimeMs] = useState<number | null>(null);

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
            const puzzleKey = puzzleKeyFor(
              gridKeyForSport("mlb", mlbPosition),
              puzzleFile.date,
            );
            const saved = loadGiveUpProgress(puzzleKey);
            if (saved) {
              setMlbBoard(restoreMlbBoardFromProgress(db, saved, mlbPosition));
              setGaveUp(true);
              setSelectedCell(null);
            } else {
              setMlbBoard({});
              setGaveUp(false);
            }
            setNbaBoard({});
            setNflBoard({});
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
            const puzzleKey = puzzleKeyFor(
              gridKeyForSport("nfl", nflPosition),
              puzzleFile.date,
            );
            const saved = loadGiveUpProgress(puzzleKey);
            if (saved) {
              setNflBoard(restoreNflBoardFromProgress(db, saved));
              setGaveUp(true);
              setSelectedCell(null);
            } else {
              setNflBoard({});
              setGaveUp(false);
            }
            setNbaBoard({});
            setMlbBoard({});
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
          const puzzleKey = puzzleKeyFor(
            gridKeyForSport("nba"),
            puzzleFile.date,
          );
          const saved = loadGiveUpProgress(puzzleKey);
          if (saved) {
            setNbaBoard(restoreNbaBoardFromProgress(db, saved));
            setGaveUp(true);
            setSelectedCell(null);
          } else {
            setNbaBoard({});
            setGaveUp(false);
          }
          setNflBoard({});
          setMlbBoard({});
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

  const activeNflPosition =
    loadState.status === "ready" &&
    loadState.sport === "nfl" &&
    "position" in loadState.puzzleFile
      ? loadState.puzzleFile.position
      : nflPosition;
  const activeMlbPosition =
    loadState.status === "ready" &&
    loadState.sport === "mlb" &&
    "position" in loadState.puzzleFile
      ? loadState.puzzleFile.position
      : mlbPosition;
  const activeGridKey =
    loadState.status === "ready"
      ? gridKeyForSport(
          loadState.sport,
          loadState.sport === "mlb" ? activeMlbPosition : activeNflPosition,
        )
      : null;
  const activePuzzleKey =
    activeGridKey && loadState.status === "ready"
      ? puzzleKeyFor(activeGridKey, loadState.puzzleFile.date)
      : null;
  const activePuzzleName =
    loadState.status === "ready"
      ? puzzleDisplayName(
          loadState.sport,
          activeNflPosition,
          activeMlbPosition,
        )
      : "";

  useEffect(() => {
    setTopTimeMs(null);
    setFinishTimeMs(null);
    setRank(null);
    setRankTotal(null);
    setRankLoading(false);
  }, [activePuzzleKey]);

  useEffect(() => {
    if (!won || finishTimeMs === null || !activePuzzleKey) {
      return;
    }

    let cancelled = false;
    setRankLoading(true);
    setRank(null);
    setRankTotal(null);

    void submitCompletionTime(activePuzzleKey, finishTimeMs).then((result) => {
      if (cancelled) {
        return;
      }
      setRankLoading(false);
      if (result) {
        setRank(result.rank);
        setRankTotal(result.total);
        if (typeof result.topTimeMs === "number") {
          setTopTimeMs(result.topTimeMs);
        }
      }
    });

    return () => {
      cancelled = true;
    };
  }, [won, finishTimeMs, activePuzzleKey]);

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
      saveGiveUpProgress(
        puzzleKeyFor(gridKeyForSport("mlb", position), loadState.puzzleFile.date),
        filled,
      );
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
      saveGiveUpProgress(
        puzzleKeyFor(gridKeyForSport("nfl", position), loadState.puzzleFile.date),
        filled,
      );
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
    saveGiveUpProgress(
      puzzleKeyFor(gridKeyForSport("nba"), loadState.puzzleFile.date),
      filled,
    );
  }

  if (sport === null) {
    return (
      <div className="home-shell">
        <div className="home-atmosphere" />
        <div className="home-stage">
          <h1 className="home-brand">Puzzling Sports</h1>
          <p className="home-kicker home-kicker-after-brand">Choose a sport</p>
          <p className="home-lede">
            Daily 3×3 sports puzzles. Date <code>{puzzleDate}</code>.
          </p>
          <HomeSportNav puzzleDate={puzzleDate} />

          <section className="home-rules" aria-labelledby="home-rules-heading">
            <p className="home-kicker">How to play</p>
            <h2 id="home-rules-heading" className="home-rules-title">
              Game rules
            </h2>
            <ol className="home-rules-list">
              <li>
                Each puzzle is a <strong>3×3 jigsaw</strong>. The center player
                is given; fill the eight outer pieces.
              </li>
              <li>
                Every outer piece must match its <strong>shell clues</strong>{" "}
                (the labels around the board).
              </li>
              <li>
                Shared edges compare stats: a <strong>tab</strong> means your
                player’s stat is greater than or equal to the neighbor; a{" "}
                <strong>socket</strong> means less than or equal.
              </li>
              <li>
                <strong>Easy</strong> mode needs only a player name.{" "}
                <strong>Hard</strong> mode also needs the season year.
              </li>
              <li>
                A new daily puzzle drops at midnight Eastern for every sport
                grid.
              </li>
            </ol>
          </section>
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
      {activePuzzleKey ? (
        <PuzzleTimer
          storageKey={activePuzzleKey}
          running={!won && !gaveUp}
          topTimeMs={typeof topTimeMs === "number" ? topTimeMs : undefined}
          onStop={(elapsedMs) => {
            setFinishTimeMs((previous) => previous ?? elapsedMs);
          }}
        />
      ) : null}

      <GameHeader
        date={puzzleFile.date}
        basePlayerName={puzzleFile.base.playerName}
        basePlayerSeason={puzzleFile.base.season}
        basePlayerStats={formatAssignmentMiniStats(definition.base)}
        mode={mode}
        filledCount={filledCount}
        onModeChange={setMode}
        sport={loadState.sport}
        nflPosition={activeNflPosition}
        mlbPosition={activeMlbPosition}
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
          suggestPlayers={(query) => {
            if (loadState.sport === "nba") {
              return loadState.db.searchPlayersByName(query);
            }
            if (loadState.sport === "nfl") {
              const position =
                "position" in puzzleFile
                  ? puzzleFile.position.toUpperCase()
                  : "QB";
              return loadState.db.searchPlayersByName(query, {
                position: position as "QB" | "WR" | "RB",
              });
            }
            const position =
              "position" in puzzleFile
                ? puzzleFile.position === "pitcher"
                  ? "P"
                  : "H"
                : "H";
            return loadState.db.searchPlayersByName(query, { position });
          }}
          onSubmit={handleSubmitGuess}
        />
      </main>

      {won ? (
        <WinBanner
          date={puzzleFile.date}
          puzzleName={activePuzzleName}
          timeMs={finishTimeMs}
          rank={rank}
          total={rankTotal}
          rankLoading={rankLoading || finishTimeMs === null}
        />
      ) : null}
    </div>
  );
}
