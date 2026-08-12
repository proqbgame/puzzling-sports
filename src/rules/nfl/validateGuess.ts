import type { NflDatabase } from "../../data/NflDatabase.js";
import type { PlayerSeasonAssignment } from "../../types/nfl.js";
import {
  edgeFailureMessage,
  validateEdgesForCell,
  type EdgeComparisonDetail,
} from "./compareEdge.js";
import type { Criterion } from "./criteria.js";
import { criterionLabel } from "./criteria.js";
import { getCellEdges, type CellEdgeMap } from "../topology.js";
import { getFailedCriteria } from "./matchesCriterion.js";
import { OUTER_CELL_IDS, type CellId } from "../grid.js";

export type GameMode = "easy" | "hard";

export type BoardState = Partial<Record<CellId, PlayerSeasonAssignment>>;

export interface PuzzleCellConfig {
  criteria: Criterion[];
  edges?: CellEdgeMap;
}

export interface PuzzleDefinition {
  /** Pre-filled center/base player + season */
  base: PlayerSeasonAssignment;
  cells: Partial<Record<CellId, PuzzleCellConfig>>;
  edgeOverrides?: Partial<Record<CellId, CellEdgeMap>>;
}

export type ValidationFailureReason =
  | "player_not_found"
  | "ambiguous_player"
  | "season_required"
  | "season_not_found"
  | "no_valid_season"
  | "criteria_failed"
  | "edge_failed";

export interface ValidationFailure {
  reason: ValidationFailureReason;
  message: string;
  criterionLabel?: string;
  neighborCellId?: CellId;
}

export interface GuessValidationResult {
  valid: boolean;
  assignment?: PlayerSeasonAssignment;
  failures: ValidationFailure[];
}

export interface GuessInput {
  cellId: CellId;
  playerName: string;
  /** Required in hard mode; optional in easy mode */
  season?: string;
}

function pickMostRecentSeason(
  assignments: PlayerSeasonAssignment[],
): PlayerSeasonAssignment | undefined {
  if (assignments.length === 0) {
    return undefined;
  }

  return [...assignments].sort((a, b) => b.season.localeCompare(a.season))[0];
}

function assignmentPassesCellRules(
  assignment: PlayerSeasonAssignment,
  cellId: CellId,
  puzzle: PuzzleDefinition,
  board: BoardState,
): { valid: boolean; failures: ValidationFailure[] } {
  const failures: ValidationFailure[] = [];
  const cellConfig = puzzle.cells[cellId];

  if (!cellConfig) {
    return { valid: false, failures: [{ reason: "criteria_failed", message: "Unknown cell" }] };
  }

  for (const failed of getFailedCriteria(assignment, cellConfig.criteria)) {
    failures.push({
      reason: "criteria_failed",
      message: `Does not match: ${failed.label}`,
      criterionLabel: failed.label,
    });
  }

  const edges = getCellEdges(cellId, puzzle.edgeOverrides);
  const mergedEdges = { ...edges, ...cellConfig.edges };
  const edgeResult = validateEdgesForCell(
    assignment,
    cellId,
    withBaseOnBoard(puzzle.base, board),
    mergedEdges,
  );

  for (const edge of edgeResult.failures) {
    failures.push({
      reason: "edge_failed",
      message: edgeFailureMessage(edge),
      neighborCellId: edge.neighborCellId,
    });
  }

  return { valid: failures.length === 0, failures };
}

function withBaseOnBoard(
  base: PlayerSeasonAssignment,
  board: BoardState,
): BoardState {
  return { ...board, center: base };
}

function resolveSeasonInput(
  db: NflDatabase,
  seasonInput: string | undefined,
): string | undefined {
  if (!seasonInput) {
    return undefined;
  }
  return db.normalizeSeasonInput(seasonInput) ?? seasonInput.trim();
}

function findEasyModeAssignments(
  db: NflDatabase,
  playerId: string,
  cellId: CellId,
  puzzle: PuzzleDefinition,
  board: BoardState,
): PlayerSeasonAssignment[] {
  const valid: PlayerSeasonAssignment[] = [];

  for (const seasonRow of db.getSeasonsForPlayer(playerId)) {
    const assignment = db.getAssignment(playerId, seasonRow.season);
    if (!assignment) {
      continue;
    }

    const result = assignmentPassesCellRules(assignment, cellId, puzzle, board);
    if (result.valid) {
      valid.push(assignment);
    }
  }

  return valid;
}

/**
 * Validate a guess for one NFL cell (criteria + edge compares).
 */
export function validateGuess(
  db: NflDatabase,
  puzzle: PuzzleDefinition,
  board: BoardState,
  mode: GameMode,
  input: GuessInput,
): GuessValidationResult {
  const playerIds = db.findPlayerIdsByName(input.playerName);

  if (playerIds.length === 0) {
    return {
      valid: false,
      failures: [{ reason: "player_not_found", message: "Player not found" }],
    };
  }

  if (mode === "hard") {
    if (!input.season?.trim()) {
      return {
        valid: false,
        failures: [
          { reason: "season_required", message: "Season is required in hard mode" },
        ],
      };
    }

    const season = resolveSeasonInput(db, input.season);
    if (!season) {
      return {
        valid: false,
        failures: [
          { reason: "season_not_found", message: "Season not recognized" },
        ],
      };
    }

    const passing: PlayerSeasonAssignment[] = [];
    let lastFailures: ValidationFailure[] = [
      {
        reason: "season_not_found",
        message: `No ${season} season found for this player`,
      },
    ];

    for (const playerId of playerIds) {
      const assignment = db.getAssignment(playerId, season);
      if (!assignment) {
        continue;
      }

      const result = assignmentPassesCellRules(
        assignment,
        input.cellId,
        puzzle,
        board,
      );
      if (result.valid) {
        passing.push(assignment);
      } else {
        lastFailures = result.failures;
      }
    }

    if (passing.length === 1) {
      return { valid: true, assignment: passing[0], failures: [] };
    }

    if (passing.length > 1) {
      const names = [
        ...new Set(passing.map((a) => a.playerName)),
      ];
      return {
        valid: false,
        failures: [
          {
            reason: "ambiguous_player",
            message: `Multiple players match: ${names.join(", ")}`,
          },
        ],
      };
    }

    return { valid: false, failures: lastFailures };
  }

  // Easy mode: try every name match; auto-pick the most recent season that fits
  const validAssignments: PlayerSeasonAssignment[] = [];
  for (const playerId of playerIds) {
    validAssignments.push(
      ...findEasyModeAssignments(
        db,
        playerId,
        input.cellId,
        puzzle,
        board,
      ),
    );
  }

  if (validAssignments.length === 0) {
    return {
      valid: false,
      failures: [
        {
          reason: "no_valid_season",
          message: "No season works for this player in this cell",
        },
      ],
    };
  }

  const assignment = pickMostRecentSeason(validAssignments)!;
  return { valid: true, assignment, failures: [] };
}

/** True when all 8 outer cells are filled and every edge is valid. */
export function isPuzzleComplete(
  puzzle: PuzzleDefinition,
  board: BoardState,
): boolean {
  const fullBoard = withBaseOnBoard(puzzle.base, board);

  for (const cellId of OUTER_CELL_IDS) {
    const assignment = fullBoard[cellId];
    const cellConfig = puzzle.cells[cellId];

    if (!assignment || !cellConfig) {
      return false;
    }

    const result = assignmentPassesCellRules(
      assignment,
      cellId,
      puzzle,
      board,
    );
    if (!result.valid) {
      return false;
    }
  }

  return true;
}

export function formatCriteriaList(criteria: Criterion[]): string {
  return criteria.map((c) => criterionLabel(c)).join(" + ");
}

export type { EdgeComparisonDetail };
