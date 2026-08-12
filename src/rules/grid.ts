/**
 * 3×3 grid layout for the puzzle board.
 */

export type CellId =
  | "top-left"
  | "top-middle"
  | "top-right"
  | "middle-left"
  | "center"
  | "middle-right"
  | "bottom-left"
  | "bottom-middle"
  | "bottom-right";

export type GridDirection = "up" | "down" | "left" | "right";

export type EdgeConnection = "tab" | "socket";

export type StatKey = "ppg" | "rpg" | "apg" | "blk";

export interface CellPosition {
  row: number;
  col: number;
}

export const CELL_POSITIONS: Record<CellId, CellPosition> = {
  "top-left": { row: 0, col: 0 },
  "top-middle": { row: 0, col: 1 },
  "top-right": { row: 0, col: 2 },
  "middle-left": { row: 1, col: 0 },
  center: { row: 1, col: 1 },
  "middle-right": { row: 1, col: 2 },
  "bottom-left": { row: 2, col: 0 },
  "bottom-middle": { row: 2, col: 1 },
  "bottom-right": { row: 2, col: 2 },
};

/** Outer cells the player must fill (not center). */
export const OUTER_CELL_IDS: readonly CellId[] = [
  "top-left",
  "top-middle",
  "top-right",
  "middle-left",
  "middle-right",
  "bottom-left",
  "bottom-middle",
  "bottom-right",
] as const;

export const NEIGHBOR_BY_DIRECTION: Record<
  CellId,
  Partial<Record<GridDirection, CellId>>
> = {
  "top-left": { right: "top-middle", down: "middle-left" },
  "top-middle": { left: "top-left", right: "top-right", down: "center" },
  "top-right": { left: "top-middle", down: "middle-right" },
  "middle-left": { up: "top-left", right: "center", down: "bottom-left" },
  center: {
    up: "top-middle",
    down: "bottom-middle",
    left: "middle-left",
    right: "middle-right",
  },
  "middle-right": { up: "top-right", left: "center", down: "bottom-right" },
  "bottom-left": { up: "middle-left", right: "bottom-middle" },
  "bottom-middle": {
    up: "center",
    left: "bottom-left",
    right: "bottom-right",
  },
  "bottom-right": { up: "middle-right", left: "bottom-middle" },
};

export function directionBetween(
  from: CellPosition,
  to: CellPosition,
): GridDirection | null {
  if (to.row === from.row - 1 && to.col === from.col) {
    return "up";
  }
  if (to.row === from.row + 1 && to.col === from.col) {
    return "down";
  }
  if (to.col === from.col - 1 && to.row === from.row) {
    return "left";
  }
  if (to.col === from.col + 1 && to.row === from.row) {
    return "right";
  }
  return null;
}

export function oppositeDirection(dir: GridDirection): GridDirection {
  switch (dir) {
    case "up":
      return "down";
    case "down":
      return "up";
    case "left":
      return "right";
    case "right":
      return "left";
  }
}

/**
 * Stat used on the shared edge between two adjacent cells.
 *
 * Matches the base-player layout:
 *   vertical row 0|1 → PPG, row 1|2 → AST
 *   horizontal col 0|1 → RPG, col 1|2 → BLK
 */
export function statForEdge(a: CellPosition, b: CellPosition): StatKey {
  if (a.row !== b.row) {
    const upper = a.row < b.row ? a : b;
    return upper.row === 0 ? "ppg" : "apg";
  }

  if (a.col !== b.col) {
    const left = a.col < b.col ? a : b;
    return left.col === 0 ? "rpg" : "blk";
  }

  throw new Error("Cells are not adjacent");
}

export function statLabel(stat: StatKey): string {
  switch (stat) {
    case "ppg":
      return "PPG";
    case "rpg":
      return "RPG";
    case "apg":
      return "AST";
    case "blk":
      return "BLK";
  }
}
