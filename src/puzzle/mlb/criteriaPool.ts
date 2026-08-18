import type { PlayerSeasonAssignment } from "../../types/mlb.js";
import type { CellId } from "../../rules/grid.js";
import type { Criterion, CriterionType } from "../../rules/mlb/criteria.js";
import { matchesCriterion } from "../../rules/mlb/matchesCriterion.js";
import { isShellEligibleCollege } from "../collegeEligibility.js";

export const MIN_SHELL_AWARDS = 3;
export const MIN_SHELL_POS_AWARD = 1;
export const MIN_SHELL_COLLEGES = 0;
export const POWER4_COLLEGE_BIAS = 0.75;

const SEASON_AWARD_CRITERION_TYPES: ReadonlySet<CriterionType> = new Set([
  "mvp",
  "allStar",
  "cyYoung",
  "silverSlugger",
  "goldGlove",
  "wsMvp",
  "champion",
]);

const ELITE_SEASON_AWARD_TYPES: ReadonlySet<CriterionType> = new Set([
  "mvp",
  "cyYoung",
  "silverSlugger",
  "wsMvp",
  "champion",
]);

const CAREER_AWARD_CRITERION_TYPES: ReadonlySet<CriterionType> = new Set([
  "everMvp",
  "everAllStar",
  "everCyYoung",
  "everSilverSlugger",
  "everGoldGlove",
  "everWsMvp",
  "everChampion",
]);

const AWARD_CRITERION_TYPES: ReadonlySet<CriterionType> = new Set([
  ...SEASON_AWARD_CRITERION_TYPES,
  ...CAREER_AWARD_CRITERION_TYPES,
]);

const SHELL_DEPRIORITIZED_TYPES: ReadonlySet<CriterionType> = new Set([
  "undrafted",
  "seasonsPlayed",
  "allStar",
  "everAllStar",
]);

export const MIN_SHELL_HR_FALLBACK = 20;
export const MIN_SHELL_SO_FALLBACK = 150;

const HONOR_CRITERIA: Criterion[] = [
  { type: "mvp" },
  { type: "allStar" },
  { type: "cyYoung" },
  { type: "silverSlugger" },
  { type: "goldGlove" },
  { type: "wsMvp" },
  { type: "champion" },
];

const CAREER_CRITERIA: Criterion[] = [
  { type: "everMvp" },
  { type: "everAllStar" },
  { type: "everCyYoung" },
  { type: "everSilverSlugger" },
  { type: "everGoldGlove" },
  { type: "everWsMvp" },
  { type: "everChampion" },
];

function statThreshold(value: number, step: number): number {
  return Math.max(0, Math.floor(value / step) * step);
}

function eraCeiling(value: number): number {
  return Math.ceil(value * 4) / 4;
}

function avgThreshold(value: number): number {
  return Math.floor(value * 1000) / 1000;
}

export interface BuildMatchingCriteriaOptions {
  collegeCounts?: ReadonlyMap<string, number>;
}

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
    if (!collegeCounts || isShellEligibleCollege(bio.college, collegeCounts)) {
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

  if (stats.position === "P") {
    const soFloor = statThreshold(stats.so, 25);
    if (soFloor >= 150) {
      matches.push({ type: "soAtLeast", min: soFloor });
    }
    const wFloor = statThreshold(stats.w, 2);
    if (wFloor >= 12) {
      matches.push({ type: "wAtLeast", min: wFloor });
    }
    const ipFloor = statThreshold(stats.ip, 10);
    if (ipFloor >= 160) {
      matches.push({ type: "ipAtLeast", min: ipFloor });
    }
    const eraMax = eraCeiling(stats.era);
    if (stats.era > 0 && eraMax <= 3.5) {
      matches.push({ type: "eraAtMost", max: eraMax });
    }
  } else {
    const hrFloor = statThreshold(stats.hr, 5);
    if (hrFloor >= 20) {
      matches.push({ type: "hrAtLeast", min: hrFloor });
    }
    const rbiFloor = statThreshold(stats.rbi, 10);
    if (rbiFloor >= 80) {
      matches.push({ type: "rbiAtLeast", min: rbiFloor });
    }
    const avgFloor = avgThreshold(stats.avg);
    if (avgFloor >= 0.28 && stats.ab >= 300) {
      matches.push({ type: "avgAtLeast", min: avgFloor });
    }
    const sbFloor = statThreshold(stats.sb, 5);
    if (sbFloor >= 20) {
      matches.push({ type: "sbAtLeast", min: sbFloor });
    }
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

export function isSeasonPosAwardCriterion(criterion: Criterion): boolean {
  return (
    criterion.type === "silverSlugger" ||
    criterion.type === "cyYoung" ||
    criterion.type === "goldGlove" ||
    criterion.type === "mvp"
  );
}

export function isEliteSeasonAwardCriterion(criterion: Criterion): boolean {
  return ELITE_SEASON_AWARD_TYPES.has(criterion.type);
}

function isStatCriterion(criterion: Criterion): boolean {
  return (
    criterion.type === "hrAtLeast" ||
    criterion.type === "rbiAtLeast" ||
    criterion.type === "avgAtLeast" ||
    criterion.type === "sbAtLeast" ||
    criterion.type === "soAtLeast" ||
    criterion.type === "wAtLeast" ||
    criterion.type === "ipAtLeast" ||
    criterion.type === "eraAtMost"
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

function statFallbackCriterion(
  assignment: PlayerSeasonAssignment,
): Criterion | null {
  if (assignment.stats.position === "P") {
    const min = statThreshold(assignment.stats.so, 25);
    if (min >= MIN_SHELL_SO_FALLBACK) {
      return { type: "soAtLeast", min };
    }
    return null;
  }
  const min = statThreshold(assignment.stats.hr, 5);
  if (min >= MIN_SHELL_HR_FALLBACK) {
    return { type: "hrAtLeast", min };
  }
  return null;
}

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
  return statFallbackCriterion(assignment);
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
    if (collegeCounts && !isShellEligibleCollege(criterion.school, collegeCounts)) {
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
    countShellCriteria(cellCriteria, isSeasonPosAwardCriterion) >=
      MIN_SHELL_POS_AWARD &&
    countShellCriteria(cellCriteria, isCollegeCriterion) >= MIN_SHELL_COLLEGES
  );
}

export interface AssignShellCriteriaOptions {
  cornerCells: ReadonlySet<CellId>;
  outerCellIds: readonly CellId[];
  maxAssignmentAttempts?: number;
  collegeCounts?: ReadonlyMap<string, number>;
}

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
    slotCounts.set(cellId, options.cornerCells.has(cellId) ? 2 : 1);
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

    if (!placeRequired(isSeasonPosAwardCriterion)) {
      continue;
    }
    if (allowedColleges.size > 0 && !placeRequired(isCollegeCriterion)) {
      continue;
    }
    if (
      !placeRequired(isEliteSeasonAwardCriterion) &&
      !placeRequired(awardPredicate)
    ) {
      continue;
    }
    while (countShellCriteria(cellCriteria, awardPredicate) < MIN_SHELL_AWARDS) {
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
