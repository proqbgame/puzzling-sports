/**
 * Puzzle-piece tab/socket layout.
 *
 * tab    → knob protrudes outward; stat must be >= neighbor
 * socket → indent inward; stat must be <= neighbor
 *
 * Outer board edges stay flat (no tab/socket). Interior edges are
 * complementary: if A.right is tab, B.left must be socket.
 */

import {
  NEIGHBOR_BY_DIRECTION,
  oppositeDirection,
  type CellId,
  type EdgeConnection,
  type GridDirection,
} from "./grid.js";

export type CellEdgeMap = Partial<Record<GridDirection, EdgeConnection>>;

export type EdgeTopology = Record<CellId, CellEdgeMap>;

const ALL_CELL_IDS: CellId[] = [
  "top-left",
  "top-middle",
  "top-right",
  "middle-left",
  "center",
  "middle-right",
  "bottom-left",
  "bottom-middle",
  "bottom-right",
];

/** Default layout (legacy puzzles without a stored topology). */
export const STANDARD_CELL_EDGES: EdgeTopology = {
  "top-left": { right: "socket", down: "tab" },
  "top-middle": { left: "tab", right: "socket", down: "socket" },
  "top-right": { left: "tab", down: "tab" },
  "middle-left": { up: "socket", right: "tab", down: "tab" },
  center: { up: "tab", left: "socket", right: "socket", down: "tab" },
  "middle-right": { up: "socket", left: "tab", down: "tab" },
  "bottom-left": { up: "socket", right: "tab" },
  "bottom-middle": { up: "socket", left: "socket", right: "tab" },
  "bottom-right": { up: "socket", left: "socket" },
};

/** Empty per-cell maps for every cell id. */
function emptyTopology(): EdgeTopology {
  return {
    "top-left": {},
    "top-middle": {},
    "top-right": {},
    "middle-left": {},
    center: {},
    "middle-right": {},
    "bottom-left": {},
    "bottom-middle": {},
    "bottom-right": {},
  };
}

/**
 * Build a valid random tab/socket topology.
 * Each undirected interior edge is oriented once (tab vs socket).
 */
export function generateEdgeTopology(rng: () => number): EdgeTopology {
  const edges = emptyTopology();

  for (const cellId of ALL_CELL_IDS) {
    const neighbors = NEIGHBOR_BY_DIRECTION[cellId];

    for (const direction of ["right", "down"] as const) {
      const neighborId = neighbors[direction];
      if (!neighborId) {
        continue;
      }

      const connection: EdgeConnection = rng() < 0.5 ? "tab" : "socket";
      const opposite: EdgeConnection =
        connection === "tab" ? "socket" : "tab";

      edges[cellId][direction] = connection;
      edges[neighborId][oppositeDirection(direction)] = opposite;
    }
  }

  return edges;
}

/** True when every cell that has neighbors has a stored connection for each. */
export function isCompleteEdgeTopology(
  topology: Partial<Record<CellId, CellEdgeMap>> | null | undefined,
): topology is EdgeTopology {
  if (!topology) {
    return false;
  }

  for (const cellId of ALL_CELL_IDS) {
    const cellEdges = topology[cellId];
    if (!cellEdges) {
      return false;
    }

    const neighbors = NEIGHBOR_BY_DIRECTION[cellId];
    for (const direction of Object.keys(neighbors) as GridDirection[]) {
      const kind = cellEdges[direction];
      if (kind !== "tab" && kind !== "socket") {
        return false;
      }
    }
  }

  return true;
}

/** Prefer a stored daily topology; fall back to the legacy standard layout. */
export function resolveEdgeTopology(
  topology?: Partial<Record<CellId, CellEdgeMap>> | null,
): EdgeTopology {
  return isCompleteEdgeTopology(topology) ? topology : STANDARD_CELL_EDGES;
}

export function getCellEdges(
  cellId: CellId,
  overrides?: Partial<Record<CellId, CellEdgeMap>>,
): CellEdgeMap {
  if (overrides?.[cellId]) {
    return overrides[cellId]!;
  }

  if (isCompleteEdgeTopology(overrides)) {
    return overrides[cellId] ?? {};
  }

  return STANDARD_CELL_EDGES[cellId] ?? {};
}
