import { useEffect, useState, type FormEvent } from "react";

import type { DailyPuzzleFile } from "../puzzle/types.js";
import type { DailyNflPuzzleFile } from "../puzzle/nfl/types.js";
import type { DailyMlbPuzzleFile } from "../puzzle/mlb/types.js";
import {
  CELL_POSITIONS,
  NEIGHBOR_BY_DIRECTION,
  statForEdge as nbaStatForEdge,
  statLabel as nbaStatLabel,
  type CellId,
  type EdgeConnection,
  type GridDirection,
} from "../rules/grid.js";
import {
  statForEdge as nflStatForEdge,
  statLabel as nflStatLabel,
} from "../rules/nfl/statConfig.js";
import {
  edgeOpForConnection as mlbEdgeOp,
  statForEdge as mlbStatForEdge,
  statLabel as mlbStatLabel,
} from "../rules/mlb/statConfig.js";
import {
  STANDARD_CELL_EDGES,
  resolveEdgeTopology,
} from "../rules/topology.js";
import type { BoardState as NbaBoardState, GameMode } from "../rules/validateGuess.js";
import type { BoardState as NflBoardState } from "../rules/nfl/validateGuess.js";
import type { BoardState as MlbBoardState } from "../rules/mlb/validateGuess.js";

type AnyPuzzleFile = DailyPuzzleFile | DailyNflPuzzleFile | DailyMlbPuzzleFile;
type AnyBoardState = NbaBoardState | NflBoardState | MlbBoardState;

interface GuessPanelProps {
  selectedCell: CellId | null;
  puzzle: AnyPuzzleFile;
  board: AnyBoardState;
  mode: GameMode;
  feedback: string | null;
  sport?: "nba" | "nfl" | "mlb";
  onSubmit: (playerName: string, season?: string) => void;
}

export function GuessPanel({
  selectedCell,
  puzzle,
  board,
  mode,
  feedback,
  sport = "nba",
  onSubmit,
}: GuessPanelProps) {
  const [playerName, setPlayerName] = useState("");
  const [season, setSeason] = useState("");

  useEffect(() => {
    setPlayerName("");
    setSeason("");
  }, [selectedCell]);

  if (!selectedCell) {
    return (
      <aside className="guess-panel idle">
        <p className="panel-eyebrow">Your move</p>
        <h2>Select a piece</h2>
        <p className="panel-copy">
          Tap an empty outer cell, then guess a player who fits the shell clue
          and edge stats.
        </p>
        <dl className="mode-help">
          <div>
            <dt>Easy</dt>
            <dd>Name only — we pick a valid season.</dd>
          </div>
          <div>
            <dt>Hard</dt>
            <dd>
              Name + season ({sport === "nba" ? "2012-13" : "2022"}).
            </dd>
          </div>
        </dl>
      </aside>
    );
  }

  const cell = puzzle.cells[selectedCell];
  const locked = Boolean(board[selectedCell]);
  const edgeHints = getEdgeHints(
    selectedCell,
    puzzle.base.playerName,
    board,
    sport,
    sport === "mlb" && "position" in puzzle
      ? puzzle.position
      : sport === "nfl" && "position" in puzzle
        ? puzzle.position
        : "qb",
    puzzle.edges,
  );

  function handleSubmit(event: FormEvent): void {
    event.preventDefault();
    if (!playerName.trim()) {
      return;
    }
    onSubmit(
      playerName.trim(),
      mode === "hard" ? season.trim() : undefined,
    );
  }

  return (
    <aside className="guess-panel">
      <p className="panel-eyebrow">Guessing for</p>
      <h2>{formatCellName(selectedCell)}</h2>

      {cell ? (
        <div className="criteria-chips" aria-label="Shell criteria">
          {cell.labels.map((label) => (
            <span key={label} className="criteria-chip">
              {label}
            </span>
          ))}
        </div>
      ) : null}

      {edgeHints.length > 0 ? (
        <div className="edge-block">
          <p className="panel-eyebrow">Stat edges</p>
          <ul className="edge-hints">
            {edgeHints.map((hint) => (
              <li key={hint}>{hint}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <form onSubmit={handleSubmit}>
        <label>
          Player name
          <input
            type="text"
            value={playerName}
            onChange={(event) => setPlayerName(event.target.value)}
            placeholder={
              sport === "mlb"
                ? "e.g. Mike Trout"
                : sport === "nfl"
                  ? "e.g. Patrick Mahomes"
                  : "e.g. Steve Nash"
            }
            autoFocus
            disabled={locked}
          />
        </label>

        {mode === "hard" ? (
          <label>
            Season
            <input
              type="text"
              value={season}
              onChange={(event) => setSeason(event.target.value)}
              placeholder={
                sport === "nba" ? "e.g. 2005-06 or 2005" : "e.g. 2022 or 2022-23"
              }
              disabled={locked}
            />
          </label>
        ) : null}

        {feedback ? <p className="feedback error">{feedback}</p> : null}

        <button type="submit" disabled={locked || !playerName.trim()}>
          Submit guess
        </button>
      </form>
    </aside>
  );
}

function formatCellName(cellId: CellId): string {
  return cellId
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function neighborDisplayName(
  neighborId: CellId,
  basePlayerName: string,
  board: AnyBoardState,
): string {
  if (neighborId === "center") {
    return basePlayerName;
  }

  const assignment = board[neighborId];
  return assignment?.playerName ?? formatCellName(neighborId);
}

function getEdgeHints(
  cellId: CellId,
  basePlayerName: string,
  board: AnyBoardState,
  sport: "nba" | "nfl" | "mlb",
  position: "qb" | "wr" | "rb" | "pitcher" | "hitter" = "qb",
  storedEdges?: AnyPuzzleFile["edges"],
): string[] {
  const edges = resolveEdgeTopology(storedEdges)[cellId] ?? STANDARD_CELL_EDGES[cellId];
  const neighbors = NEIGHBOR_BY_DIRECTION[cellId];
  const hints: string[] = [];

  for (const [direction, connection] of Object.entries(edges) as [
    GridDirection,
    EdgeConnection,
  ][]) {
    const neighborId = neighbors[direction];
    if (!neighborId) {
      continue;
    }

    const mlbStat =
      sport === "mlb"
        ? mlbStatForEdge(
            CELL_POSITIONS[cellId],
            CELL_POSITIONS[neighborId],
            position,
          )
        : null;
    const label =
      sport === "mlb" && mlbStat
        ? mlbStatLabel(mlbStat, position)
        : sport === "nfl"
        ? nflStatLabel(
            nflStatForEdge(
              CELL_POSITIONS[cellId],
              CELL_POSITIONS[neighborId],
              position,
            ),
            position,
          )
        : nbaStatLabel(
            nbaStatForEdge(
              CELL_POSITIONS[cellId],
              CELL_POSITIONS[neighborId],
            ),
          );
    const op =
      mlbStat
        ? mlbEdgeOp(connection, mlbStat)
        : connection === "tab"
          ? "≥"
          : "≤";
    const neighbor = neighborDisplayName(neighborId, basePlayerName, board);

    hints.push(`${label} ${op} ${neighbor}`);
  }

  return hints;
}
