import type { MlbDatabase } from "../../data/MlbDatabase.js";
import type { Criterion } from "../../rules/mlb/criteria.js";
import { criterionLabel } from "../../rules/mlb/criteria.js";
import {
  CELL_POSITIONS,
  NEIGHBOR_BY_DIRECTION,
  OUTER_CELL_IDS,
  type CellId,
  type EdgeConnection,
  type GridDirection,
} from "../../rules/grid.js";
import { getCellEdges, type EdgeTopology } from "../../rules/topology.js";
import { matchesCriterion } from "../../rules/mlb/matchesCriterion.js";
import { getStatConfig, statForEdge, type MlbStatKey, isLowerBetterStat, valueSatisfiesEdge } from "../../rules/mlb/statConfig.js";
import {
  isPuzzleComplete,
  type BoardState,
  type PuzzleDefinition,
} from "../../rules/mlb/validateGuess.js";
import type { PlayerSeasonAssignment } from "../../types/mlb.js";
import type {
  DailyMlbPuzzleFile,
  GeneratedDailyMlbPuzzle,
  MlbPuzzlePosition,
} from "./types.js";
import { mlbRowPosition, toDailyMlbPuzzleBase } from "./types.js";
import {
  assignShellCriteria,
  POWER4_COLLEGE_BIAS,
} from "./criteriaPool.js";
import {
  buildCollegePlayerCountMap,
  isShellEligibleCollege,
} from "../collegeEligibility.js";
import { isPower4School } from "../power4Schools.js";
import { dailyEdgeTopology } from "../edgeTopology.js";
import {
  createSeededRng,
  hashStringToSeed,
  shuffleInPlace,
} from "../seededRng.js";

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

export interface GenerateDailyMlbPuzzleOptions {
  /** Max attempts to find a full puzzle before failing. */
  maxAttempts?: number;
  /** Minimum games played for base player season. */
  minBaseGames?: number;
  /** Position scope — pitcher or hitter. */
  position?: MlbPuzzlePosition;
}

export class MlbPuzzleGenerationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MlbPuzzleGenerationError";
  }
}

interface ActiveEdgeConstraint {
  stat: MlbStatKey;
  connection: EdgeConnection;
  neighborValue: number;
}

class AssignmentSearchIndex {
  readonly assignments: readonly PlayerSeasonAssignment[];
  readonly position: MlbPuzzlePosition;

  private readonly indicesByStatAsc: Partial<
    Record<MlbStatKey, readonly number[]>
  >;

  constructor(
    assignments: readonly PlayerSeasonAssignment[],
    position: MlbPuzzlePosition,
  ) {
    this.assignments = assignments;
    this.position = position;
    const config = getStatConfig(position);
    const keys = Object.values(config.byDirection) as MlbStatKey[];
    this.indicesByStatAsc = {};
    for (const key of keys) {
      this.indicesByStatAsc[key] = this.buildSortedIndices(key);
    }
  }

  private buildSortedIndices(stat: MlbStatKey): number[] {
    const indices = this.assignments.map((_, index) => index);
    indices.sort(
      (a, b) =>
        Number(this.assignments[a]!.stats[stat as keyof PlayerSeasonAssignment["stats"]] ?? 0) -
        Number(this.assignments[b]!.stats[stat as keyof PlayerSeasonAssignment["stats"]] ?? 0),
    );
    return indices;
  }

  private getStatValue(
    assignment: PlayerSeasonAssignment,
    stat: MlbStatKey,
  ): number {
    return Number(
      assignment.stats[stat as keyof PlayerSeasonAssignment["stats"]] ?? 0,
    );
  }

  private indicesMatchingStatConstraint(
    stat: MlbStatKey,
    connection: EdgeConnection,
    neighborValue: number,
  ): readonly number[] {
    const sorted = this.indicesByStatAsc[stat];
    if (!sorted) {
      return this.assignments.map((_, index) => index);
    }

    const effectiveConnection = isLowerBetterStat(stat)
      ? connection === "tab"
        ? "socket"
        : "tab"
      : connection;

    if (effectiveConnection === "socket") {
      let lo = 0;
      let hi = sorted.length;
      while (lo < hi) {
        const mid = (lo + hi) >>> 1;
        if (this.getStatValue(this.assignments[sorted[mid]!]!, stat) <= neighborValue) {
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
      if (this.getStatValue(this.assignments[sorted[mid]!]!, stat) < neighborValue) {
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
    const constraints = getActiveEdgeConstraints(
      cellId,
      board,
      edges,
      this.position,
    );
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
  position: MlbPuzzlePosition,
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
    const stat = statForEdge(fromPos, toPos, position);
    constraints.push({
      stat,
      connection,
      neighborValue: Number(
        neighborAssignment.stats[
          stat as keyof PlayerSeasonAssignment["stats"]
        ] ?? 0,
      ),
    });
  }

  return constraints;
}

function passesActiveEdgeConstraints(
  assignment: PlayerSeasonAssignment,
  constraints: readonly ActiveEdgeConstraint[],
): boolean {
  for (const { stat, connection, neighborValue } of constraints) {
    const value = Number(
      assignment.stats[stat as keyof PlayerSeasonAssignment["stats"]] ?? 0,
    );
    if (!valueSatisfiesEdge(value, neighborValue, connection, stat)) {
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
  position: MlbPuzzlePosition,
): PlayerSeasonAssignment[] {
  if (position === "pitcher") {
    return all.filter(
      (assignment) =>
        assignment.stats.games >= minGames &&
        assignment.stats.ip >= 140 &&
        assignment.stats.so >= 140 &&
        assignment.stats.so <= 350,
    );
  }

  return all.filter(
    (assignment) =>
      assignment.stats.games >= minGames &&
      assignment.stats.hr >= 15 &&
      assignment.stats.hr <= 55,
  );
}

function assignmentsForPosition(
  db: MlbDatabase,
  position: MlbPuzzlePosition,
): readonly PlayerSeasonAssignment[] {
  return position === "pitcher"
    ? db.getPitcherAssignments()
    : db.getHitterAssignments();
}

function basePoolRangeHint(position: MlbPuzzlePosition): string {
  return position === "pitcher"
    ? "140–350 strikeouts and ≥140 IP"
    : "15–55 home runs";
}

function buildPuzzleDefinition(
  base: PlayerSeasonAssignment,
  cellCriteria: Partial<Record<CellId, Criterion[]>>,
  topology: EdgeTopology,
  position: MlbPuzzlePosition,
): PuzzleDefinition {
  const cells: PuzzleDefinition["cells"] = {};

  for (const cellId of OUTER_CELL_IDS) {
    const criteria = cellCriteria[cellId];
    if (criteria && criteria.length > 0) {
      cells[cellId] = { criteria };
    }
  }

  return { base, cells, edgeOverrides: topology, position: mlbRowPosition(position) };
}

function toPuzzleFile(
  date: string,
  position: MlbPuzzlePosition,
  base: PlayerSeasonAssignment,
  cellCriteria: Partial<Record<CellId, Criterion[]>>,
  topology: EdgeTopology,
): DailyMlbPuzzleFile {
  const cells: DailyMlbPuzzleFile["cells"] = {};

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
    sport: "mlb",
    position,
    date,
    base: toDailyMlbPuzzleBase(base),
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
  position: MlbPuzzlePosition,
  rng: () => number,
  collegeCounts: ReadonlyMap<string, number>,
  topology: EdgeTopology,
): GeneratedDailyMlbPuzzle | null {
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

    const definition = buildPuzzleDefinition(base, cellCriteria, topology, position);

    if (!isPuzzleComplete(definition, solution)) {
      continue;
    }

    return {
      puzzle: toPuzzleFile(date, position, base, cellCriteria, topology),
      definition,
      solution,
    };
  }

  return null;
}

export function generateDailyMlbPuzzle(
  db: MlbDatabase,
  date: string,
  options: GenerateDailyMlbPuzzleOptions = {},
): GeneratedDailyMlbPuzzle {
  const position = options.position ?? "hitter";
  if (position !== "hitter" && position !== "pitcher") {
    throw new MlbPuzzleGenerationError(
      `Unsupported MLB position "${position}" — only pitcher and hitter are implemented`,
    );
  }

  const maxAttempts = options.maxAttempts ?? 40;
  const minBaseGames = options.minBaseGames ?? (position === "pitcher" ? 20 : 100);
  const seed = hashStringToSeed(`puzzling-sports-mlb-${position}-${date}`);
  const topology = dailyEdgeTopology(date, `mlb-${position}`);
  const allAssignments = assignmentsForPosition(db, position);
  const basePool = buildBaseCandidatePool(
    allAssignments,
    minBaseGames,
    position,
  );
  const searchIndex = new AssignmentSearchIndex(allAssignments, position);
  const collegeCounts = buildCollegePlayerCountMap(db.bios);

  if (basePool.length === 0) {
    throw new MlbPuzzleGenerationError(
      `No ${position.toUpperCase()} base candidates for ${date} (need ≥${minBaseGames} games and ${basePoolRangeHint(position)})`,
    );
  }

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const rng = createSeededRng(seed + attempt);
    const generated = tryGenerateOnce(
      searchIndex,
      basePool,
      date,
      position,
      rng,
      collegeCounts,
      topology,
    );
    if (generated) {
      return generated;
    }
  }

  throw new MlbPuzzleGenerationError(
    `Could not generate a solvable MLB ${position.toUpperCase()} puzzle for ${date} after ${maxAttempts} attempts`,
  );
}

/** Count how many assignments satisfy a cell's criteria + edges vs filled board. */
export function countValidAnswersForCell(
  db: MlbDatabase,
  definition: PuzzleDefinition,
  board: BoardState,
  cellId: CellId,
  position: MlbPuzzlePosition = "hitter",
): number {
  const cellConfig = definition.cells[cellId];
  if (!cellConfig) {
    return 0;
  }

  const fullBoard: BoardState = { center: definition.base, ...board };
  const edges = getCellEdges(cellId, definition.edgeOverrides);
  const mergedEdges = { ...edges, ...cellConfig.edges };
  const constraints = getActiveEdgeConstraints(
    cellId,
    fullBoard,
    mergedEdges,
    position,
  );
  let count = 0;

  const pool = assignmentsForPosition(db, position);

  for (const assignment of pool) {
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
