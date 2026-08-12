import type { PlayerSeasonAssignment } from "../../types/nfl.js";
import {
  CELL_POSITIONS,
  directionBetween,
  type CellId,
  type EdgeConnection,
  type GridDirection,
  NEIGHBOR_BY_DIRECTION,
} from "../grid.js";
import { statForEdge, statLabel, type NflStatKey } from "./statConfig.js";

export interface EdgeComparisonDetail {
  direction: GridDirection;
  neighborCellId: CellId;
  stat: NflStatKey;
  connection: EdgeConnection;
  fromValue: number;
  toValue: number;
  valid: boolean;
}

function getStatValue(assignment: PlayerSeasonAssignment, stat: NflStatKey): number {
  return Number(assignment.stats[stat as keyof typeof assignment.stats] ?? 0);
}

/**
 * Compare `from` vs `to` on the edge they share.
 * Tab ≥ neighbor; socket ≤ neighbor (same topology as NBA).
 */
export function compareEdge(
  from: PlayerSeasonAssignment,
  to: PlayerSeasonAssignment,
  fromCellId: CellId,
  toCellId: CellId,
  connectionOnFrom: EdgeConnection,
): boolean {
  const fromPos = CELL_POSITIONS[fromCellId];
  const toPos = CELL_POSITIONS[toCellId];
  const position = from.stats.position;
  const stat = statForEdge(fromPos, toPos, position);
  const fromValue = getStatValue(from, stat);
  const toValue = getStatValue(to, stat);

  if (connectionOnFrom === "tab") {
    return fromValue >= toValue;
  }

  return fromValue <= toValue;
}

export function describeEdgeComparison(
  from: PlayerSeasonAssignment,
  to: PlayerSeasonAssignment,
  fromCellId: CellId,
  toCellId: CellId,
  connectionOnFrom: EdgeConnection,
): EdgeComparisonDetail {
  const fromPos = CELL_POSITIONS[fromCellId];
  const toPos = CELL_POSITIONS[toCellId];
  const position = from.stats.position;
  const direction =
    directionBetween(fromPos, toPos) ??
    directionBetween(toPos, fromPos) ??
    "up";
  const stat = statForEdge(fromPos, toPos, position);
  const fromValue = getStatValue(from, stat);
  const toValue = getStatValue(to, stat);
  const valid =
    connectionOnFrom === "tab" ? fromValue >= toValue : fromValue <= toValue;

  return {
    direction,
    neighborCellId: toCellId,
    stat,
    connection: connectionOnFrom,
    fromValue,
    toValue,
    valid,
  };
}

export function edgeFailureMessage(detail: EdgeComparisonDetail): string {
  const op = detail.connection === "tab" ? ">=" : "<=";
  return `${statLabel(detail.stat)} must be ${op} neighbor (${detail.fromValue} vs ${detail.toValue})`;
}

export function validateEdgesForCell(
  assignment: PlayerSeasonAssignment,
  cellId: CellId,
  board: Partial<Record<CellId, PlayerSeasonAssignment>>,
  cellEdges: Partial<Record<GridDirection, EdgeConnection>>,
): { valid: boolean; failures: EdgeComparisonDetail[] } {
  const failures: EdgeComparisonDetail[] = [];
  const neighbors = NEIGHBOR_BY_DIRECTION[cellId];

  for (const [direction, connection] of Object.entries(cellEdges) as [
    GridDirection,
    EdgeConnection,
  ][]) {
    const neighborId = neighbors[direction];
    if (!neighborId) {
      continue;
    }

    const neighborAssignment = board[neighborId];
    if (!neighborAssignment) {
      continue;
    }

    const detail = describeEdgeComparison(
      assignment,
      neighborAssignment,
      cellId,
      neighborId,
      connection,
    );

    if (!detail.valid) {
      failures.push(detail);
    }
  }

  return { valid: failures.length === 0, failures };
}
