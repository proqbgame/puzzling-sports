/**
 * Fill empty NFL outer cells with the easiest valid player-seasons.
 */

import type { NflDatabase } from "../../data/NflDatabase.js";
import { OUTER_CELL_IDS, type CellId } from "../../rules/grid.js";
import { getCellEdges } from "../../rules/topology.js";
import { matchesCriterion } from "../../rules/nfl/matchesCriterion.js";
import { validateEdgesForCell } from "../../rules/nfl/compareEdge.js";
import type {
  BoardState,
  PuzzleDefinition,
} from "../../rules/nfl/validateGuess.js";
import type { PlayerSeasonAssignment } from "../../types/nfl.js";
import type { NflPuzzlePosition } from "./types.js";

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

function poolForPosition(
  db: NflDatabase,
  position: NflPuzzlePosition,
): readonly PlayerSeasonAssignment[] {
  if (position === "wr") {
    return db.getWrAssignments();
  }
  if (position === "rb") {
    return db.getRbAssignments();
  }
  return db.getQbAssignments();
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

/** Higher = easier / more recognizable. */
export function nflEaseScore(assignment: PlayerSeasonAssignment): number {
  const { bio, stats } = assignment;
  const honors = stats.honors;
  let score = 0;

  if (honors.mvp) score += 80;
  if (honors.allPro) score += 55;
  if (honors.sbMvp) score += 50;
  if (honors.champion) score += 35;
  if (honors.proBowl) score += 25;

  if (bio.everMvp) score += 40;
  if (bio.everAllPro) score += 25;
  if (bio.everChampion) score += 20;
  if (bio.everProBowl) score += 15;
  if (bio.everSbMvp) score += 30;

  score += Math.min(bio.seasonsPlayed, 18) * 1.5;

  if (stats.position === "WR") {
    score += stats.recYds / 80;
    score += stats.recTd * 2;
  } else if (stats.position === "RB") {
    score += (stats.rushYds ?? 0) / 80;
    score += (stats.rushTd ?? 0) * 2;
  } else {
    score += stats.passYds / 200;
    score += stats.passTd * 1.5;
  }

  if (bio.draftPick != null && bio.draftPick > 0 && bio.draftPick <= 10) {
    score += Math.max(0, 25 - bio.draftPick * 2);
  }

  const year = Number(assignment.season.slice(0, 4));
  if (Number.isFinite(year)) {
    score += (year - 1970) * 0.05;
  }

  return score;
}

export function listValidNflAssignmentsForCell(
  db: NflDatabase,
  definition: PuzzleDefinition,
  board: BoardState,
  cellId: CellId,
  position: NflPuzzlePosition,
): PlayerSeasonAssignment[] {
  const used = usedPlayerIds(definition, board);
  const valid: PlayerSeasonAssignment[] = [];

  for (const assignment of poolForPosition(db, position)) {
    if (used.has(assignment.playerId)) {
      continue;
    }
    if (assignmentFitsCell(assignment, cellId, definition, board)) {
      valid.push(assignment);
    }
  }

  return valid;
}

export function fillNflGiveUpBoard(
  db: NflDatabase,
  definition: PuzzleDefinition,
  board: BoardState,
  position: NflPuzzlePosition,
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
        candidates: listValidNflAssignmentsForCell(
          db,
          definition,
          current,
          cellId,
          position,
        ),
      }))
      .sort((a, b) => a.candidates.length - b.candidates.length);

    const next = ranked[0]!;
    if (next.candidates.length === 0) {
      return null;
    }

    const ordered = [...next.candidates].sort((a, b) => {
      const scoreDiff = nflEaseScore(b) - nflEaseScore(a);
      if (scoreDiff !== 0) {
        return scoreDiff;
      }
      return b.season.localeCompare(a.season);
    });

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
