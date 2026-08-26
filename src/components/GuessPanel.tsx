import {
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";

import type { PlayerSuggestion } from "../data/playerSuggestions.js";
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
  suggestPlayers?: (query: string) => PlayerSuggestion[];
  onSubmit: (playerName: string, season?: string) => void;
}

export function GuessPanel({
  selectedCell,
  puzzle,
  board,
  mode,
  feedback,
  sport = "nba",
  suggestPlayers,
  onSubmit,
}: GuessPanelProps) {
  const [playerName, setPlayerName] = useState("");
  const [season, setSeason] = useState("");
  const [suggestions, setSuggestions] = useState<PlayerSuggestion[]>([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const listId = useId();
  const blurTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    setPlayerName("");
    setSeason("");
    setSuggestions([]);
    setMenuOpen(false);
    setActiveIndex(-1);
  }, [selectedCell]);

  useEffect(() => {
    return () => {
      if (blurTimeoutRef.current !== null) {
        window.clearTimeout(blurTimeoutRef.current);
      }
    };
  }, []);

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
    puzzle.base,
    board,
    sport,
    sport === "mlb" && "position" in puzzle
      ? puzzle.position
      : sport === "nfl" && "position" in puzzle
        ? puzzle.position
        : "qb",
    puzzle.edges,
  );

  function updateSuggestions(query: string): void {
    if (!suggestPlayers || locked) {
      setSuggestions([]);
      setMenuOpen(false);
      setActiveIndex(-1);
      return;
    }

    const next = suggestPlayers(query);
    setSuggestions(next);
    setMenuOpen(next.length > 0);
    setActiveIndex(next.length > 0 ? 0 : -1);
  }

  function selectSuggestion(suggestion: PlayerSuggestion): void {
    setPlayerName(suggestion.playerName);
    setSuggestions([]);
    setMenuOpen(false);
    setActiveIndex(-1);
  }

  function handleSubmit(event: FormEvent): void {
    event.preventDefault();
    if (!playerName.trim()) {
      return;
    }
    setMenuOpen(false);
    onSubmit(
      playerName.trim(),
      mode === "hard" ? season.trim() : undefined,
    );
  }

  function handleNameKeyDown(event: KeyboardEvent<HTMLInputElement>): void {
    if (!menuOpen || suggestions.length === 0) {
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => (index + 1) % suggestions.length);
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) =>
        index <= 0 ? suggestions.length - 1 : index - 1,
      );
      return;
    }

    if (event.key === "Enter" && activeIndex >= 0) {
      event.preventDefault();
      selectSuggestion(suggestions[activeIndex]);
      return;
    }

    if (event.key === "Escape") {
      setMenuOpen(false);
      setActiveIndex(-1);
    }
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
          <div className="player-typeahead">
            <input
              type="text"
              role="combobox"
              aria-autocomplete="list"
              aria-expanded={menuOpen}
              aria-controls={listId}
              aria-activedescendant={
                menuOpen && activeIndex >= 0
                  ? `${listId}-option-${activeIndex}`
                  : undefined
              }
              value={playerName}
              onChange={(event) => {
                const value = event.target.value;
                setPlayerName(value);
                updateSuggestions(value);
              }}
              onFocus={() => {
                if (blurTimeoutRef.current !== null) {
                  window.clearTimeout(blurTimeoutRef.current);
                  blurTimeoutRef.current = null;
                }
                updateSuggestions(playerName);
              }}
              onBlur={() => {
                blurTimeoutRef.current = window.setTimeout(() => {
                  setMenuOpen(false);
                  setActiveIndex(-1);
                }, 120);
              }}
              onKeyDown={handleNameKeyDown}
              placeholder={
                sport === "mlb"
                  ? "e.g. Mike Trout"
                  : sport === "nfl"
                    ? "e.g. Patrick Mahomes"
                    : "e.g. Steve Nash"
              }
              autoComplete="off"
              autoFocus
              disabled={locked}
            />

            {menuOpen && suggestions.length > 0 ? (
              <ul
                id={listId}
                className="player-typeahead-menu"
                role="listbox"
                aria-label="Matching players"
              >
                {suggestions.map((suggestion, index) => (
                  <li
                    key={suggestion.playerId}
                    id={`${listId}-option-${index}`}
                    className={
                      index === activeIndex
                        ? "player-typeahead-option is-active"
                        : "player-typeahead-option"
                    }
                    role="option"
                    aria-selected={index === activeIndex}
                  >
                    <button
                      type="button"
                      className="player-typeahead-row"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => selectSuggestion(suggestion)}
                      onMouseEnter={() => setActiveIndex(index)}
                    >
                      <span className="player-typeahead-copy">
                        <span className="player-typeahead-name">
                          {suggestion.playerName}
                        </span>
                        <span className="player-typeahead-years">
                          {suggestion.firstYear} - {suggestion.lastYear}
                        </span>
                      </span>
                      <span className="player-typeahead-select">Select</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
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

function formatEdgeStatValue(statKey: string, value: number): string {
  if (statKey === "avg") {
    return value.toFixed(3).replace(/^0/, "");
  }
  if (statKey === "era") {
    return value.toFixed(2);
  }
  if (statKey === "compPct") {
    return `${value}%`;
  }
  if (Number.isInteger(value)) {
    return String(value);
  }
  return String(Math.round(value * 10) / 10);
}

function neighborHintLabel(
  neighborId: CellId,
  base: AnyPuzzleFile["base"],
  board: AnyBoardState,
  statKey: string,
): string {
  if (neighborId === "center") {
    const raw = (base.stats as Record<string, unknown>)[statKey];
    if (typeof raw === "number") {
      return `${base.playerName} ${formatEdgeStatValue(statKey, raw)}`;
    }
    return base.playerName;
  }

  const assignment = board[neighborId];
  if (!assignment) {
    return formatCellName(neighborId);
  }

  const raw = (assignment.stats as Record<string, unknown>)[statKey];
  if (typeof raw === "number") {
    return `${assignment.playerName} ${formatEdgeStatValue(statKey, raw)}`;
  }
  return assignment.playerName;
}

function getEdgeHints(
  cellId: CellId,
  base: AnyPuzzleFile["base"],
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

    const fromPos = CELL_POSITIONS[cellId];
    const toPos = CELL_POSITIONS[neighborId];
    const statKey =
      sport === "mlb"
        ? mlbStatForEdge(fromPos, toPos, position)
        : sport === "nfl"
          ? nflStatForEdge(fromPos, toPos, position)
          : nbaStatForEdge(fromPos, toPos);
    const label =
      sport === "mlb"
        ? mlbStatLabel(statKey, position)
        : sport === "nfl"
          ? nflStatLabel(statKey, position)
          : nbaStatLabel(statKey);
    const op =
      sport === "mlb"
        ? mlbEdgeOp(connection, statKey)
        : connection === "tab"
          ? "≥"
          : "≤";
    const neighbor = neighborHintLabel(neighborId, base, board, statKey);

    hints.push(`${label} ${op} ${neighbor}`);
  }

  return hints;
}
