import type { PlayerSeasonAssignment } from "../types/nba.js";
import type { CellId } from "../rules/grid.js";
import type { Criterion, CriterionType } from "../rules/criteria.js";
import { matchesCriterion } from "../rules/matchesCriterion.js";
import { isShellEligibleCollege } from "./collegeEligibility.js";

/** Minimum outer-shell quotas for daily puzzle criteria. */
export const MIN_SHELL_AWARDS = 3;
export const MIN_SHELL_ALL_NBA = 1;
export const MIN_SHELL_COLLEGES = 1;

/** Probability of preferring Power 4 schools when selecting shell colleges. */
export const POWER4_COLLEGE_BIAS = 0.75;

const SEASON_AWARD_CRITERION_TYPES: ReadonlySet<CriterionType> = new Set([
  "mvp",
  "allStar",
  "allNba",
  "allDefensive",
  "finalsMvp",
  "dpoy",
  "sixthMan",
  "mostImproved",
  "champion",
]);

/** Harder season honors preferred on the outer shell. */
const ELITE_SEASON_AWARD_TYPES: ReadonlySet<CriterionType> = new Set([
  "mvp",
  "allNba",
  "allDefensive",
  "finalsMvp",
  "dpoy",
  "champion",
  "sixthMan",
  "mostImproved",
]);

const CAREER_AWARD_CRITERION_TYPES: ReadonlySet<CriterionType> = new Set([
  "everMvp",
  "everAllStar",
  "everChampion",
  "everDpoy",
  "everSixthMan",
  "everMostImproved",
  "everFinalsMvp",
  "everAllNba",
  "everAllDefensive",
]);

const AWARD_CRITERION_TYPES: ReadonlySet<CriterionType> = new Set([
  ...SEASON_AWARD_CRITERION_TYPES,
  ...CAREER_AWARD_CRITERION_TYPES,
]);

/** Bio criteria that are too broad for outer-shell filler when season honors exist. */
const SHELL_DEPRIORITIZED_TYPES: ReadonlySet<CriterionType> = new Set([
  "undrafted",
  "seasonsPlayed",
  "allStar",
  "everAllStar",
]);

/** Minimum PPG threshold when synthesizing a stat fallback criterion. */
export const MIN_SHELL_PPG_FALLBACK = 15;

const HONOR_CRITERIA: Criterion[] = [
  { type: "mvp" },
  { type: "allStar" },
  { type: "allNba" },
  { type: "allDefensive" },
  { type: "finalsMvp" },
  { type: "dpoy" },
  { type: "sixthMan" },
  { type: "mostImproved" },
  { type: "champion" },
];

const CAREER_CRITERIA: Criterion[] = [
  { type: "everMvp" },
  { type: "everAllStar" },
  { type: "everChampion" },
  { type: "everDpoy" },
  { type: "everSixthMan" },
  { type: "everMostImproved" },
  { type: "everFinalsMvp" },
  { type: "everAllNba" },
  { type: "everAllDefensive" },
];

function statThreshold(value: number, step: number): number {
  return Math.max(0, Math.floor(value / step) * step);
}

export interface BuildMatchingCriteriaOptions {
  collegeCounts?: ReadonlyMap<string, number>;
}

/** All criteria that this player+season assignment satisfies. */
export function buildMatchingCriteria(
  assignment: PlayerSeasonAssignment,
  options?: BuildMatchingCriteriaOptions,
): Criterion[] {
  const matches: Criterion[] = [];
  const { bio, stats } = assignment;

  for (const criterion of HONOR_CRITERIA) {
    if (matchesCriterion(assignment, criterion)) {
      matches.push(criterion);
    }
  }

  for (const criterion of CAREER_CRITERIA) {
    if (matchesCriterion(assignment, criterion)) {
      matches.push(criterion);
    }
  }

  if (bio.college) {
    const collegeCounts = options?.collegeCounts;
    if (
      !collegeCounts ||
      isShellEligibleCollege(bio.college, collegeCounts)
    ) {
      matches.push({ type: "college", school: bio.college });
    }
  }

  if (bio.draftPick === 1) {
    matches.push({ type: "draftPick", pick: 1 });
  } else if (bio.draftPick !== null && bio.draftPick > 0 && bio.draftPick <= 5) {
    matches.push({ type: "topDraftPick", maxPick: 5 });
  }

  if (bio.undrafted) {
    matches.push({ type: "undrafted" });
  }

  if (bio.seasonsPlayed >= 15) {
    matches.push({ type: "seasonsPlayed", min: 15 });
  } else if (bio.seasonsPlayed >= 10) {
    matches.push({ type: "seasonsPlayed", min: 10 });
  } else if (bio.seasonsPlayed >= 5) {
    matches.push({ type: "seasonsPlayed", min: 5 });
  }

  const ppgFloor = statThreshold(stats.ppg, 5);
  if (ppgFloor >= 15) {
    matches.push({ type: "ppgAtLeast", min: ppgFloor });
  }

  const rpgFloor = statThreshold(stats.rpg, 3);
  if (rpgFloor >= 8) {
    matches.push({ type: "rpgAtLeast", min: rpgFloor });
  }

  const apgFloor = statThreshold(stats.apg, 3);
  if (apgFloor >= 7) {
    matches.push({ type: "apgAtLeast", min: apgFloor });
  }

  const blkFloor = statThreshold(stats.blk, 1);
  if (blkFloor >= 2) {
    matches.push({ type: "blkAtLeast", min: blkFloor });
  }

  return dedupeCriteria(matches);
}

function dedupeCriteria(criteria: Criterion[]): Criterion[] {
  const seen = new Set<string>();
  const unique: Criterion[] = [];

  for (const criterion of criteria) {
    const key = JSON.stringify(criterion);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    unique.push(criterion);
  }

  return unique;
}

export function isSeasonAwardCriterion(criterion: Criterion): boolean {
  return SEASON_AWARD_CRITERION_TYPES.has(criterion.type);
}

export function isCareerAwardCriterion(criterion: Criterion): boolean {
  return CAREER_AWARD_CRITERION_TYPES.has(criterion.type);
}

export function isAwardCriterion(criterion: Criterion): boolean {
  return AWARD_CRITERION_TYPES.has(criterion.type);
}

export function isSeasonAllNbaCriterion(criterion: Criterion): boolean {
  return criterion.type === "allNba";
}

export function isEliteSeasonAwardCriterion(criterion: Criterion): boolean {
  return ELITE_SEASON_AWARD_TYPES.has(criterion.type);
}

function isStatCriterion(criterion: Criterion): boolean {
  return (
    criterion.type === "ppgAtLeast" ||
    criterion.type === "rpgAtLeast" ||
    criterion.type === "apgAtLeast" ||
    criterion.type === "blkAtLeast"
  );
}

function isDraftCriterion(criterion: Criterion): boolean {
  return (
    criterion.type === "draftPick" ||
    criterion.type === "topDraftPick" ||
    criterion.type === "draftRound"
  );
}

function isShellDeprioritizedCriterion(criterion: Criterion): boolean {
  return SHELL_DEPRIORITIZED_TYPES.has(criterion.type);
}

function ppgFallbackCriterion(
  assignment: PlayerSeasonAssignment,
): Criterion | null {
  const min = statThreshold(assignment.stats.ppg, 5);
  if (min >= MIN_SHELL_PPG_FALLBACK) {
    return { type: "ppgAtLeast", min };
  }
  return null;
}

/** Whether any outer-shell player has a season honor available for clues. */
export function solutionHasSeasonHonor(
  solution: Partial<Record<CellId, PlayerSeasonAssignment>>,
  outerCellIds: readonly CellId[],
): boolean {
  for (const cellId of outerCellIds) {
    const assignment = solution[cellId];
    if (!assignment) {
      continue;
    }

    if (buildMatchingCriteria(assignment).some(isSeasonAwardCriterion)) {
      return true;
    }
  }

  return false;
}

function buildShellCriteriaPool(
  assignment: PlayerSeasonAssignment,
  allowedColleges: Set<string> | undefined,
  allowCareerHonors: boolean,
  collegeCounts?: ReadonlyMap<string, number>,
): Criterion[] {
  const pool = filterPool(
    buildMatchingCriteria(assignment, { collegeCounts }),
    allowedColleges,
    collegeCounts,
  );

  return pool.filter(
    (criterion) => allowCareerHonors || !isCareerAwardCriterion(criterion),
  );
}

const SHELL_FILLER_TIERS: ReadonlyArray<(criterion: Criterion) => boolean> = [
  isEliteSeasonAwardCriterion,
  isStatCriterion,
  isDraftCriterion,
  isSeasonAwardCriterion,
  isCollegeCriterion,
  isCareerAwardCriterion,
  isShellDeprioritizedCriterion,
];

function pickShellFillerCriterion(
  pool: Criterion[],
  usedKeys: Set<string>,
  assignment: PlayerSeasonAssignment,
  rng: () => number,
): Criterion | null {
  const available = pool.filter(
    (criterion) => !usedKeys.has(criterionKey(criterion)),
  );

  for (const tier of SHELL_FILLER_TIERS) {
    const tierCandidates = shuffleCriteria(available.filter(tier), rng);
    if (tierCandidates[0]) {
      return tierCandidates[0];
    }
  }

  return ppgFallbackCriterion(assignment);
}

export function isCollegeCriterion(
  criterion: Criterion,
): criterion is Extract<Criterion, { type: "college" }> {
  return criterion.type === "college";
}

function criterionKey(criterion: Criterion): string {
  return JSON.stringify(criterion);
}

function filterPool(
  pool: Criterion[],
  allowedColleges?: Set<string>,
  collegeCounts?: ReadonlyMap<string, number>,
): Criterion[] {
  return pool.filter((criterion) => {
    if (criterion.type !== "college") {
      return true;
    }

    if (allowedColleges && !allowedColleges.has(criterion.school)) {
      return false;
    }

    if (
      collegeCounts &&
      !isShellEligibleCollege(criterion.school, collegeCounts)
    ) {
      return false;
    }

    return true;
  });
}

function shuffleArray<T>(items: T[], rng: () => number): T[] {
  const shuffled = [...items];
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function shuffleCriteria(pool: Criterion[], rng: () => number): Criterion[] {
  return shuffleArray(pool, rng);
}

export function pickCriteriaForCell(
  assignment: PlayerSeasonAssignment,
  count: number,
  rng: () => number,
  allowedColleges?: Set<string>,
  collegeCounts?: ReadonlyMap<string, number>,
): Criterion[] {
  const pool = filterPool(
    buildMatchingCriteria(assignment, { collegeCounts }),
    allowedColleges,
    collegeCounts,
  );

  if (pool.length === 0) {
    return (
      [ppgFallbackCriterion(assignment)].filter(
        (criterion): criterion is Criterion => criterion !== null,
      )
    );
  }

  return shuffleCriteria(pool, rng).slice(0, Math.min(count, pool.length));
}

function pickFromPool(
  pool: Criterion[],
  predicate: (criterion: Criterion) => boolean,
  usedKeys: Set<string>,
  rng: () => number,
): Criterion | null {
  const candidates = shuffleCriteria(
    pool.filter(
      (criterion) => predicate(criterion) && !usedKeys.has(criterionKey(criterion)),
    ),
    rng,
  );
  return candidates[0] ?? null;
}

function countShellCriteria(
  cellCriteria: Partial<Record<CellId, Criterion[]>>,
  predicate: (criterion: Criterion) => boolean,
): number {
  let count = 0;

  for (const criteria of Object.values(cellCriteria)) {
    if (!criteria) {
      continue;
    }

    for (const criterion of criteria) {
      if (predicate(criterion)) {
        count += 1;
      }
    }
  }

  return count;
}

/** Whether every corner shell cell received its full criteria quota. */
export function cornersFullyAssigned(
  cellCriteria: Partial<Record<CellId, Criterion[]>>,
  cornerCells: ReadonlySet<CellId>,
): boolean {
  for (const cellId of cornerCells) {
    const criteria = cellCriteria[cellId];
    if (!criteria || criteria.length < 2) {
      return false;
    }
  }

  return true;
}

/** Whether assigned outer-shell criteria meet daily minimum quotas. */
export function meetsOuterShellConstraints(
  cellCriteria: Partial<Record<CellId, Criterion[]>>,
  options?: { allowCareerAwards?: boolean },
): boolean {
  const awardPredicate =
    options?.allowCareerAwards === false
      ? isSeasonAwardCriterion
      : isAwardCriterion;

  return (
    countShellCriteria(cellCriteria, awardPredicate) >= MIN_SHELL_AWARDS &&
    countShellCriteria(cellCriteria, isSeasonAllNbaCriterion) >=
      MIN_SHELL_ALL_NBA &&
    countShellCriteria(cellCriteria, isCollegeCriterion) >= MIN_SHELL_COLLEGES
  );
}

export interface AssignShellCriteriaOptions {
  cornerCells: ReadonlySet<CellId>;
  outerCellIds: readonly CellId[];
  maxAssignmentAttempts?: number;
  collegeCounts?: ReadonlyMap<string, number>;
}

/**
 * Assign criteria to outer shell cells, steering toward award / All-NBA / college quotas.
 * Returns null when quotas cannot be satisfied for this player solution.
 */
export function assignShellCriteria(
  solution: Partial<Record<CellId, PlayerSeasonAssignment>>,
  allowedColleges: Set<string>,
  rng: () => number,
  options: AssignShellCriteriaOptions,
): Partial<Record<CellId, Criterion[]>> | null {
  const maxAttempts = options.maxAssignmentAttempts ?? 40;
  const slotCounts = new Map<CellId, number>();

  for (const cellId of options.outerCellIds) {
    if (!solution[cellId]) {
      continue;
    }
    slotCounts.set(
      cellId,
      options.cornerCells.has(cellId) ? 2 : 1,
    );
  }

  const allowCareerHonors = !solutionHasSeasonHonor(
    solution,
    options.outerCellIds,
  );

  const pools = new Map<CellId, Criterion[]>();
  for (const cellId of options.outerCellIds) {
    const assignment = solution[cellId];
    if (!assignment) {
      continue;
    }
    pools.set(
      cellId,
      buildShellCriteriaPool(
        assignment,
        allowedColleges,
        allowCareerHonors,
        options.collegeCounts,
      ),
    );
  }

  const awardPredicate = allowCareerHonors
    ? isAwardCriterion
    : isSeasonAwardCriterion;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const cellCriteria: Partial<Record<CellId, Criterion[]>> = {};
    const remainingSlots = new Map(slotCounts);

    const assignToCell = (cellId: CellId, criterion: Criterion): boolean => {
      const slotsLeft = remainingSlots.get(cellId) ?? 0;
      if (slotsLeft <= 0) {
        return false;
      }

      const existing = cellCriteria[cellId] ?? [];
      if (existing.some((entry) => criterionKey(entry) === criterionKey(criterion))) {
        return false;
      }

      cellCriteria[cellId] = [...existing, criterion];
      remainingSlots.set(cellId, slotsLeft - 1);
      return true;
    };

    const placeRequired = (
      predicate: (criterion: Criterion) => boolean,
    ): boolean => {
      const cellOrder = shuffleArray(
        options.outerCellIds.flatMap((cellId) => {
          const slots = remainingSlots.get(cellId) ?? 0;
          return Array.from({ length: slots }, () => cellId);
        }),
        rng,
      );

      for (const cellId of cellOrder) {
        const pool = pools.get(cellId) ?? [];
        const usedKeys = new Set(
          (cellCriteria[cellId] ?? []).map((criterion) => criterionKey(criterion)),
        );
        const picked = pickFromPool(pool, predicate, usedKeys, rng);
        if (picked && assignToCell(cellId, picked)) {
          return true;
        }
      }

      return false;
    };

    if (!placeRequired(isSeasonAllNbaCriterion)) {
      continue;
    }
    if (!placeRequired(isCollegeCriterion)) {
      continue;
    }
    // Prefer elite honors (All-NBA, MVP, DPOY, …) before softer awards like All-Star.
    if (
      !placeRequired(isEliteSeasonAwardCriterion) &&
      !placeRequired(awardPredicate)
    ) {
      continue;
    }
    // Fill remaining award quota with any remaining award slots.
    while (
      countShellCriteria(cellCriteria, awardPredicate) < MIN_SHELL_AWARDS
    ) {
      if (!placeRequired(awardPredicate)) {
        break;
      }
    }

    for (const cellId of options.outerCellIds) {
      let slotsLeft = remainingSlots.get(cellId) ?? 0;
      const pool = pools.get(cellId) ?? [];
      const assignment = solution[cellId]!;

      while (slotsLeft > 0) {
        const usedKeys = new Set(
          (cellCriteria[cellId] ?? []).map((criterion) => criterionKey(criterion)),
        );
        const picked = pickShellFillerCriterion(pool, usedKeys, assignment, rng);

        if (!picked || !assignToCell(cellId, picked)) {
          break;
        }
        slotsLeft = remainingSlots.get(cellId) ?? 0;
      }
    }

    if (
      cornersFullyAssigned(cellCriteria, options.cornerCells) &&
      meetsOuterShellConstraints(cellCriteria, {
        allowCareerAwards: allowCareerHonors,
      })
    ) {
      return cellCriteria;
    }
  }

  return null;
}

/** Count distinct college labels shown on outer puzzle cells. */
export function countUniqueCollegesOnShell(
  cells: Partial<
    Record<string, Criterion[] | { criteria?: Criterion[] } | undefined>
  >,
): number {
  const colleges = new Set<string>();

  for (const cell of Object.values(cells)) {
    if (!cell) {
      continue;
    }

    const criteria = Array.isArray(cell) ? cell : cell.criteria;
    if (!criteria) {
      continue;
    }

    for (const criterion of criteria) {
      if (criterion.type === "college") {
        colleges.add(criterion.school);
      }
    }
  }

  return colleges.size;
}
