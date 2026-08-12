/**
 * Fill empty outer cells with the "easiest" valid player-seasons
 * that still satisfy criteria + edge compares.
 */

import type { NbaDatabase } from "../data/NbaDatabase.js";
import { OUTER_CELL_IDS, type CellId } from "../rules/grid.js";
import { getCellEdges } from "../rules/topology.js";
import { matchesCriterion } from "../rules/matchesCriterion.js";
import { validateEdgesForCell } from "../rules/compareEdge.js";
import type {
  BoardState,
  PuzzleDefinition,
} from "../rules/validateGuess.js";
import type { PlayerSeasonAssignment } from "../types/nba.js";

function withBaseOnBoard(
  base: PlayerSeasonAssignment,
  board: BoardState,
): BoardState {
  return { ...board, center: base };
}

function usedPlayerIds(
  definition: PuzzleDefinition,
  board: BoardState,
): Set<string> {
  const used = new Set<string>([definition.base.playerId]);
  for (const cellId of OUTER_CELL_IDS) {
    const assignment = board[cellId];
    if (assignment) {
      used.add(assignment.playerId);
    }
  }
  return used;
}

function assignmentFitsCell(
  assignment: PlayerSeasonAssignment,
  cellId: CellId,
  definition: PuzzleDefinition,
  board: BoardState,
): boolean {
  const cellConfig = definition.cells[cellId];
  if (!cellConfig) {
    return false;
  }

  for (const criterion of cellConfig.criteria) {
    if (!matchesCriterion(assignment, criterion)) {
      return false;
    }
  }

  const edges = getCellEdges(cellId, definition.edgeOverrides);
  const mergedEdges = { ...edges, ...cellConfig.edges };
  const edgeResult = validateEdgesForCell(
    assignment,
    cellId,
    withBaseOnBoard(definition.base, board),
    mergedEdges,
  );
  return edgeResult.valid;
}

/** Higher = easier / more recognizable for a casual player. */
export function nbaEaseScore(assignment: PlayerSeasonAssignment): number {
  const { bio, stats } = assignment;
  const honors = stats.honors;
  let score = 0;

  if (honors.mvp) score += 80;
  if (honors.allNba) score += 55;
  if (honors.finalsMvp) score += 50;
  if (honors.dpoy) score += 40;
  if (honors.champion) score += 35;
  if (honors.allStar) score += 25;
  if (honors.allDefensive) score += 20;

  if (bio.everMvp) score += 40;
  if (bio.everAllNba) score += 25;
  if (bio.everChampion) score += 20;
  if (bio.everAllStar) score += 15;

  score += Math.min(bio.seasonsPlayed, 18) * 1.5;
  score += stats.ppg * 0.8;
  score += stats.rpg * 0.4;
  score += stats.apg * 0.5;

  if (bio.draftPick != null && bio.draftPick > 0 && bio.draftPick <= 10) {
    score += Math.max(0, 25 - bio.draftPick * 2);
  }

  const year = Number(assignment.season.slice(0, 4));
  if (Number.isFinite(year)) {
    score += (year - 1970) * 0.05;
  }

  return score;
}

export function listValidNbaAssignmentsForCell(
  db: NbaDatabase,
  definition: PuzzleDefinition,
  board: BoardState,
  cellId: CellId,
): PlayerSeasonAssignment[] {
  const used = usedPlayerIds(definition, board);
  const valid: PlayerSeasonAssignment[] = [];

  for (const assignment of db.getAllAssignments()) {
    if (used.has(assignment.playerId)) {
      continue;
    }
    if (assignmentFitsCell(assignment, cellId, definition, board)) {
      valid.push(assignment);
    }
  }

  return valid;
}

function pickEasiest(
  candidates: PlayerSeasonAssignment[],
): PlayerSeasonAssignment | undefined {
  if (candidates.length === 0) {
    return undefined;
  }

  return [...candidates].sort((a, b) => {
    const scoreDiff = nbaEaseScore(b) - nbaEaseScore(a);
    if (scoreDiff !== 0) {
      return scoreDiff;
    }
    return b.season.localeCompare(a.season);
  })[0];
}

/**
 * Fill every empty outer cell with the easiest valid assignment that
 * keeps the board consistent. Uses hardest-cell-first + backtracking.
 */
export function fillNbaGiveUpBoard(
  db: NbaDatabase,
  definition: PuzzleDefinition,
  board: BoardState,
): BoardState | null {
  const start: BoardState = { ...board };

  function emptyCells(current: BoardState): CellId[] {
    return OUTER_CELL_IDS.filter((cellId) => !current[cellId]);
  }

  function search(current: BoardState): BoardState | null {
    const remaining = emptyCells(current);
    if (remaining.length === 0) {
      return current;
    }

    const ranked = remaining
      .map((cellId) => ({
        cellId,
        candidates: listValidNbaAssignmentsForCell(
          db,
          definition,
          current,
          cellId,
        ),
      }))
      .sort((a, b) => a.candidates.length - b.candidates.length);

    const next = ranked[0]!;
    if (next.candidates.length === 0) {
      return null;
    }

    const ordered = [...next.candidates].sort((a, b) => {
      const scoreDiff = nbaEaseScore(b) - nbaEaseScore(a);
      if (scoreDiff !== 0) {
        return scoreDiff;
      }
      return b.season.localeCompare(a.season);
    });

    // Try the easiest few first; keep a safety cap for performance.
    for (const assignment of ordered.slice(0, 40)) {
      const trial: BoardState = {
        ...current,
        [next.cellId]: assignment,
      };
      const result = search(trial);
      if (result) {
        return result;
      }
    }

    return null;
  }

  return search(start);
}

/** Convenience: easiest single pick for one empty cell (no backtracking). */
export function pickEasiestNbaAssignmentForCell(
  db: NbaDatabase,
  definition: PuzzleDefinition,
  board: BoardState,
  cellId: CellId,
): PlayerSeasonAssignment | undefined {
  return pickEasiest(
    listValidNbaAssignmentsForCell(db, definition, board, cellId),
  );
}
