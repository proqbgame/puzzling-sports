import type { NbaDatabase } from "../data/NbaDatabase.js";
import type { Criterion } from "../rules/criteria.js";
import { criterionLabel } from "../rules/criteria.js";
import {
  CELL_POSITIONS,
  NEIGHBOR_BY_DIRECTION,
  OUTER_CELL_IDS,
  statForEdge,
  type CellId,
  type EdgeConnection,
  type GridDirection,
  type StatKey,
} from "../rules/grid.js";
import { getCellEdges, type EdgeTopology } from "../rules/topology.js";
import { matchesCriterion } from "../rules/matchesCriterion.js";
import {
  isPuzzleComplete,
  type BoardState,
  type PuzzleDefinition,
} from "../rules/validateGuess.js";
import type { PlayerSeasonAssignment } from "../types/nba.js";
import type { DailyPuzzleFile, GeneratedDailyPuzzle } from "./types.js";
import { toDailyPuzzleBase } from "./types.js";
import {
  assignShellCriteria,
  POWER4_COLLEGE_BIAS,
} from "./criteriaPool.js";
import {
  buildCollegePlayerCountMap,
  isShellEligibleCollege,
} from "./collegeEligibility.js";
import { isPower4School } from "./power4Schools.js";
import { dailyEdgeTopology } from "./edgeTopology.js";
import {
  createSeededRng,
  hashStringToSeed,
  shuffleInPlace,
} from "./seededRng.js";

/** Max distinct college labels allowed on the outer shell per day. */
const MAX_SHELL_COLLEGES = 2;

const GENERATION_ORDER: readonly CellId[] = [
  "top-middle",
  "middle-left",
  "middle-right",
  "bottom-middle",
  "top-left",
  "top-right",
  "bottom-left",
  "bottom-right",
];

const CORNER_CELLS = new Set<CellId>([
  "top-left",
  "top-right",
  "bottom-left",
  "bottom-right",
]);

export interface GenerateDailyPuzzleOptions {
  /** Max attempts to find a full puzzle before failing. */
  maxAttempts?: number;
  /** Minimum games played for base player season. */
  minBaseGames?: number;
}

export class PuzzleGenerationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PuzzleGenerationError";
  }
}

interface ActiveEdgeConstraint {
  stat: StatKey;
  connection: EdgeConnection;
  neighborValue: number;
}

class AssignmentSearchIndex {
  readonly assignments: readonly PlayerSeasonAssignment[];

  private readonly indicesByStatAsc: Record<StatKey, readonly number[]>;

  constructor(assignments: readonly PlayerSeasonAssignment[]) {
    this.assignments = assignments;
    this.indicesByStatAsc = {
      ppg: this.buildSortedIndices("ppg"),
      rpg: this.buildSortedIndices("rpg"),
      apg: this.buildSortedIndices("apg"),
      blk: this.buildSortedIndices("blk"),
    };
  }

  private buildSortedIndices(stat: StatKey): number[] {
    const indices = this.assignments.map((_, index) => index);
    indices.sort(
      (a, b) =>
        this.assignments[a]!.stats[stat] - this.assignments[b]!.stats[stat],
    );
    return indices;
  }

  private indicesMatchingStatConstraint(
    stat: StatKey,
    connection: EdgeConnection,
    neighborValue: number,
  ): readonly number[] {
    const sorted = this.indicesByStatAsc[stat];

    if (connection === "socket") {
      let lo = 0;
      let hi = sorted.length;
      while (lo < hi) {
        const mid = (lo + hi) >>> 1;
        if (this.assignments[sorted[mid]!]!.stats[stat] <= neighborValue) {
          lo = mid + 1;
        } else {
          hi = mid;
        }
      }
      return sorted.slice(0, lo);
    }

    let lo = 0;
    let hi = sorted.length;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (this.assignments[sorted[mid]!]!.stats[stat] < neighborValue) {
        lo = mid + 1;
      } else {
        hi = mid;
      }
    }
    return sorted.slice(lo);
  }

  private intersectIndexLists(
    left: readonly number[],
    right: readonly number[],
  ): number[] {
    if (left.length === 0 || right.length === 0) {
      return [];
    }

    if (left.length <= right.length) {
      const rightSet = new Set(right);
      return left.filter((index) => rightSet.has(index));
    }

    const leftSet = new Set(left);
    return right.filter((index) => leftSet.has(index));
  }

  findEdgeCandidates(
    cellId: CellId,
    base: PlayerSeasonAssignment,
    partial: Partial<Record<CellId, PlayerSeasonAssignment>>,
    usedPlayerIds: Set<string>,
    topology: EdgeTopology,
  ): PlayerSeasonAssignment[] {
    const board: BoardState = { center: base, ...partial };
    const edges = getCellEdges(cellId, topology);
    const constraints = getActiveEdgeConstraints(cellId, board, edges);
    let matchingIndices: number[] | null = null;

    for (const constraint of constraints) {
      const matched = this.indicesMatchingStatConstraint(
        constraint.stat,
        constraint.connection,
        constraint.neighborValue,
      );

      matchingIndices =
        matchingIndices === null
          ? [...matched]
          : this.intersectIndexLists(matchingIndices, matched);

      if (matchingIndices.length === 0) {
        return [];
      }
    }

    const candidates: PlayerSeasonAssignment[] = [];
    const indices =
      matchingIndices === null
        ? this.assignments.map((_, index) => index)
        : matchingIndices.sort((a, b) => a - b);

    for (const index of indices) {
      const assignment = this.assignments[index]!;
      if (
        usedPlayerIds.has(assignment.playerId) ||
        assignment.playerId === base.playerId
      ) {
        continue;
      }

      candidates.push(assignment);
    }

    return candidates;
  }
}

function getActiveEdgeConstraints(
  cellId: CellId,
  board: BoardState,
  cellEdges: Partial<Record<GridDirection, EdgeConnection>>,
): ActiveEdgeConstraint[] {
  const constraints: ActiveEdgeConstraint[] = [];
  const neighbors = NEIGHBOR_BY_DIRECTION[cellId];
  const fromPos = CELL_POSITIONS[cellId];

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

    const toPos = CELL_POSITIONS[neighborId];
    const stat = statForEdge(fromPos, toPos);
    constraints.push({
      stat,
      connection,
      neighborValue: neighborAssignment.stats[stat],
    });
  }

  return constraints;
}

function passesActiveEdgeConstraints(
  assignment: PlayerSeasonAssignment,
  constraints: readonly ActiveEdgeConstraint[],
): boolean {
  for (const { stat, connection, neighborValue } of constraints) {
    const value = assignment.stats[stat];
    if (connection === "tab") {
      if (value < neighborValue) {
        return false;
      }
    } else if (value > neighborValue) {
      return false;
    }
  }

  return true;
}

function findEdgeCandidates(
  searchIndex: AssignmentSearchIndex,
  cellId: CellId,
  base: PlayerSeasonAssignment,
  partial: Partial<Record<CellId, PlayerSeasonAssignment>>,
  usedPlayerIds: Set<string>,
  topology: EdgeTopology,
): PlayerSeasonAssignment[] {
  return searchIndex.findEdgeCandidates(
    cellId,
    base,
    partial,
    usedPlayerIds,
    topology,
  );
}

function buildBaseCandidatePool(
  all: readonly PlayerSeasonAssignment[],
  minGames: number,
): PlayerSeasonAssignment[] {
  return all.filter(
    (assignment) =>
      assignment.stats.games >= minGames &&
      assignment.stats.ppg >= 12 &&
      assignment.stats.ppg <= 35,
  );
}

function buildPuzzleDefinition(
  base: PlayerSeasonAssignment,
  cellCriteria: Partial<Record<CellId, Criterion[]>>,
  topology: EdgeTopology,
): PuzzleDefinition {
  const cells: PuzzleDefinition["cells"] = {};

  for (const cellId of OUTER_CELL_IDS) {
    const criteria = cellCriteria[cellId];
    if (criteria && criteria.length > 0) {
      cells[cellId] = { criteria };
    }
  }

  return { base, cells, edgeOverrides: topology };
}

function toPuzzleFile(
  date: string,
  base: PlayerSeasonAssignment,
  cellCriteria: Partial<Record<CellId, Criterion[]>>,
  topology: EdgeTopology,
): DailyPuzzleFile {
  const cells: DailyPuzzleFile["cells"] = {};

  for (const cellId of OUTER_CELL_IDS) {
    const criteria = cellCriteria[cellId];
    if (!criteria || criteria.length === 0) {
      continue;
    }

    cells[cellId] = {
      criteria,
      labels: criteria.map((criterion) => criterionLabel(criterion)),
    };
  }

  return {
    version: 1,
    sport: "nba",
    date,
    base: toDailyPuzzleBase(base),
    cells,
    edges: topology,
  };
}

function pickDailyCollegeLimit(rng: () => number): 1 | 2 {
  return rng() < 0.5 ? 1 : 2;
}

function selectShellColleges(
  solution: Partial<Record<CellId, PlayerSeasonAssignment>>,
  maxCount: number,
  rng: () => number,
  collegeCounts: ReadonlyMap<string, number>,
): Set<string> {
  const colleges = new Set<string>();

  for (const cellId of OUTER_CELL_IDS) {
    const college = solution[cellId]?.bio.college;
    if (college && isShellEligibleCollege(college, collegeCounts)) {
      colleges.add(college);
    }
  }

  const power4 = [...colleges].filter(isPower4School);
  const other = [...colleges].filter((college) => !isPower4School(college));

  shuffleInPlace(power4, rng);
  shuffleInPlace(other, rng);

  let ordered: string[];
  if (rng() < POWER4_COLLEGE_BIAS && power4.length > 0) {
    ordered = [...power4, ...other];
  } else {
    ordered = shuffleInPlace([...colleges], rng);
  }

  return new Set(ordered.slice(0, Math.min(maxCount, ordered.length)));
}

function assignCellCriteria(
  solution: Partial<Record<CellId, PlayerSeasonAssignment>>,
  rng: () => number,
  collegeCounts: ReadonlyMap<string, number>,
): Partial<Record<CellId, Criterion[]>> | null {
  const collegeLimit = pickDailyCollegeLimit(rng);
  const allowedColleges = selectShellColleges(
    solution,
    Math.min(collegeLimit, MAX_SHELL_COLLEGES),
    rng,
    collegeCounts,
  );

  return assignShellCriteria(solution, allowedColleges, rng, {
    cornerCells: CORNER_CELLS,
    outerCellIds: OUTER_CELL_IDS,
    collegeCounts,
  });
}

function tryGenerateOnce(
  searchIndex: AssignmentSearchIndex,
  basePool: readonly PlayerSeasonAssignment[],
  date: string,
  rng: () => number,
  collegeCounts: ReadonlyMap<string, number>,
  topology: EdgeTopology,
): GeneratedDailyPuzzle | null {
  const baseCandidates = [...basePool];
  shuffleInPlace(baseCandidates, rng);

  for (const base of baseCandidates.slice(0, 80)) {
    const solution: Partial<Record<CellId, PlayerSeasonAssignment>> = {};
    const usedPlayerIds = new Set<string>([base.playerId]);

    let failed = false;

    for (const cellId of GENERATION_ORDER) {
      const candidates = findEdgeCandidates(
        searchIndex,
        cellId,
        base,
        solution,
        usedPlayerIds,
        topology,
      );

      if (candidates.length === 0) {
        failed = true;
        break;
      }

      shuffleInPlace(candidates, rng);
      const chosen = candidates[0];
      solution[cellId] = chosen;
      usedPlayerIds.add(chosen.playerId);
    }

    if (failed) {
      continue;
    }

    const cellCriteria = assignCellCriteria(solution, rng, collegeCounts);

    if (!cellCriteria) {
      continue;
    }

    const definition = buildPuzzleDefinition(base, cellCriteria, topology);

    if (!isPuzzleComplete(definition, solution)) {
      continue;
    }

    return {
      puzzle: toPuzzleFile(date, base, cellCriteria, topology),
      definition,
      solution,
    };
  }

  return null;
}

export function generateDailyPuzzle(
  db: NbaDatabase,
  date: string,
  options: GenerateDailyPuzzleOptions = {},
): GeneratedDailyPuzzle {
  const maxAttempts = options.maxAttempts ?? 40;
  const minBaseGames = options.minBaseGames ?? 20;
  const seed = hashStringToSeed(`puzzling-sports-nba-${date}`);
  const topology = dailyEdgeTopology(date, "nba");
  const allAssignments = db.getAllAssignments();
  const basePool = buildBaseCandidatePool(allAssignments, minBaseGames);
  const searchIndex = new AssignmentSearchIndex(allAssignments);
  const collegeCounts = buildCollegePlayerCountMap(db.bios);

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const rng = createSeededRng(seed + attempt);
    const generated = tryGenerateOnce(
      searchIndex,
      basePool,
      date,
      rng,
      collegeCounts,
      topology,
    );
    if (generated) {
      return generated;
    }
  }

  throw new PuzzleGenerationError(
    `Could not generate a solvable puzzle for ${date} after ${maxAttempts} attempts`,
  );
}

/** Count how many assignments satisfy a cell's criteria + edges vs filled board. */
export function countValidAnswersForCell(
  db: NbaDatabase,
  definition: PuzzleDefinition,
  board: BoardState,
  cellId: CellId,
): number {
  const cellConfig = definition.cells[cellId];
  if (!cellConfig) {
    return 0;
  }

  const fullBoard: BoardState = { center: definition.base, ...board };
  const edges = getCellEdges(cellId, definition.edgeOverrides);
  const mergedEdges = { ...edges, ...cellConfig.edges };
  const constraints = getActiveEdgeConstraints(cellId, fullBoard, mergedEdges);
  let count = 0;

  for (const assignment of db.getAllAssignments()) {
    const criteriaOk = cellConfig.criteria.every((criterion) =>
      matchesCriterion(assignment, criterion),
    );
    if (!criteriaOk) {
      continue;
    }

    if (passesActiveEdgeConstraints(assignment, constraints)) {
      count += 1;
    }
  }

  return count;
}
