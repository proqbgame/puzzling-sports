import type { CellId } from "../rules/grid.js";
import type { NbaDatabase } from "../data/NbaDatabase.js";
import type { NflDatabase } from "../data/NflDatabase.js";
import type { MlbDatabase } from "../data/MlbDatabase.js";
import type { BoardState as NbaBoardState } from "../rules/validateGuess.js";
import type { BoardState as NflBoardState } from "../rules/nfl/validateGuess.js";
import type { BoardState as MlbBoardState } from "../rules/mlb/validateGuess.js";
import type { MlbPuzzlePosition } from "../puzzle/mlb/types.js";

type BrowserStorage = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

function getBrowserStorage(): BrowserStorage | null {
  try {
    const root = globalThis as { localStorage?: BrowserStorage };
    return root.localStorage ?? null;
  } catch {
    return null;
  }
}

interface SavedCellRef {
  playerId: string;
  season: string;
}

export interface SavedGiveUpProgress {
  version: 1;
  gaveUp: true;
  cells: Partial<Record<CellId, SavedCellRef>>;
}

function progressStorageKey(puzzleKey: string): string {
  return `ps.progress:${puzzleKey}`;
}

function boardToSavedCells(
  board: NbaBoardState | NflBoardState | MlbBoardState,
): Partial<Record<CellId, SavedCellRef>> {
  const cells: Partial<Record<CellId, SavedCellRef>> = {};
  for (const [cellId, assignment] of Object.entries(board)) {
    if (!assignment) {
      continue;
    }
    cells[cellId as CellId] = {
      playerId: assignment.playerId,
      season: assignment.season,
    };
  }
  return cells;
}

export function saveGiveUpProgress(
  puzzleKey: string,
  board: NbaBoardState | NflBoardState | MlbBoardState,
): void {
  const storage = getBrowserStorage();
  if (!storage) {
    return;
  }
  const payload: SavedGiveUpProgress = {
    version: 1,
    gaveUp: true,
    cells: boardToSavedCells(board),
  };
  try {
    storage.setItem(progressStorageKey(puzzleKey), JSON.stringify(payload));
  } catch {
    // Ignore quota / private-mode failures.
  }
}

export function loadGiveUpProgress(
  puzzleKey: string,
): SavedGiveUpProgress | null {
  const storage = getBrowserStorage();
  if (!storage) {
    return null;
  }
  try {
    const raw = storage.getItem(progressStorageKey(puzzleKey));
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as SavedGiveUpProgress;
    if (parsed?.version !== 1 || parsed.gaveUp !== true || !parsed.cells) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function clearGiveUpProgress(puzzleKey: string): void {
  const storage = getBrowserStorage();
  try {
    storage?.removeItem(progressStorageKey(puzzleKey));
  } catch {
    // Ignore.
  }
}

export function restoreNbaBoardFromProgress(
  db: NbaDatabase,
  progress: SavedGiveUpProgress,
): NbaBoardState {
  const board: NbaBoardState = {};
  for (const [cellId, ref] of Object.entries(progress.cells)) {
    if (!ref) {
      continue;
    }
    const assignment = db.getAssignment(ref.playerId, ref.season);
    if (assignment) {
      board[cellId as CellId] = assignment;
    }
  }
  return board;
}

export function restoreNflBoardFromProgress(
  db: NflDatabase,
  progress: SavedGiveUpProgress,
): NflBoardState {
  const board: NflBoardState = {};
  for (const [cellId, ref] of Object.entries(progress.cells)) {
    if (!ref) {
      continue;
    }
    const assignment = db.getAssignment(ref.playerId, ref.season);
    if (assignment) {
      board[cellId as CellId] = assignment;
    }
  }
  return board;
}

export function restoreMlbBoardFromProgress(
  db: MlbDatabase,
  progress: SavedGiveUpProgress,
  position: MlbPuzzlePosition,
): MlbBoardState {
  const mlbPosition = position === "pitcher" ? "P" : "H";
  const board: MlbBoardState = {};
  for (const [cellId, ref] of Object.entries(progress.cells)) {
    if (!ref) {
      continue;
    }
    const assignment = db.getAssignment(ref.playerId, ref.season, mlbPosition);
    if (assignment) {
      board[cellId as CellId] = assignment;
    }
  }
  return board;
}
