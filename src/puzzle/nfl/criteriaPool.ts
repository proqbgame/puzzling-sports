import type { PlayerSeasonAssignment } from "../../types/nfl.js";
import type { CellId } from "../../rules/grid.js";
import type { Criterion, CriterionType } from "../../rules/nfl/criteria.js";
import { matchesCriterion } from "../../rules/nfl/matchesCriterion.js";
import { isShellEligibleCollege } from "../collegeEligibility.js";

/** Minimum outer-shell quotas for daily NFL puzzle criteria. */
export const MIN_SHELL_AWARDS = 3;
export const MIN_SHELL_ALL_PRO = 1;
export const MIN_SHELL_COLLEGES = 1;

/** Probability of preferring Power 4 schools when selecting shell colleges. */
export const POWER4_COLLEGE_BIAS = 0.75;

const SEASON_AWARD_CRITERION_TYPES: ReadonlySet<CriterionType> = new Set([
  "mvp",
  "proBowl",
  "allPro",
  "sbMvp",
  "champion",
]);

/** Harder season honors preferred on the outer shell. */
const ELITE_SEASON_AWARD_TYPES: ReadonlySet<CriterionType> = new Set([
  "mvp",
  "allPro",
  "sbMvp",
  "champion",
]);

const CAREER_AWARD_CRITERION_TYPES: ReadonlySet<CriterionType> = new Set([
  "everMvp",
  "everProBowl",
  "everAllPro",
  "everSbMvp",
  "everChampion",
]);

const AWARD_CRITERION_TYPES: ReadonlySet<CriterionType> = new Set([
  ...SEASON_AWARD_CRITERION_TYPES,
  ...CAREER_AWARD_CRITERION_TYPES,
]);

/** Bio criteria that are too broad for outer-shell filler when season honors exist. */
const SHELL_DEPRIORITIZED_TYPES: ReadonlySet<CriterionType> = new Set([
  "undrafted",
  "seasonsPlayed",
  "proBowl",
  "everProBowl",
]);

/** Minimum pass yards when synthesizing a QB stat fallback criterion. */
export const MIN_SHELL_PASS_YDS_FALLBACK = 3000;

/** Minimum receiving yards when synthesizing a WR stat fallback criterion. */
export const MIN_SHELL_REC_YDS_FALLBACK = 1000;

/** Minimum rushing yards when synthesizing an RB stat fallback criterion. */
export const MIN_SHELL_RUSH_YDS_FALLBACK = 1000;

const HONOR_CRITERIA: Criterion[] = [
  { type: "mvp" },
  { type: "proBowl" },
  { type: "allPro" },
  { type: "sbMvp" },
  { type: "champion" },
];

const CAREER_CRITERIA: Criterion[] = [
  { type: "everMvp" },
  { type: "everProBowl" },
  { type: "everAllPro" },
  { type: "everSbMvp" },
  { type: "everChampion" },
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

  if (stats.position === "WR") {
    const recYdsFloor = statThreshold(stats.recYds, 100);
    if (recYdsFloor >= 1000) {
      matches.push({ type: "recYdsAtLeast", min: recYdsFloor });
    }

    const recTdFloor = statThreshold(stats.recTd, 2);
    if (recTdFloor >= 8) {
      matches.push({ type: "recTdAtLeast", min: recTdFloor });
    }

    const receptionsFloor = statThreshold(stats.receptions, 10);
    if (receptionsFloor >= 80) {
      matches.push({ type: "receptionsAtLeast", min: receptionsFloor });
    }

    const targetsFloor = statThreshold(stats.targets, 10);
    if (targetsFloor >= 120) {
      matches.push({ type: "targetsAtLeast", min: targetsFloor });
    }
  } else if (stats.position === "RB") {
    const rushYdsFloor = statThreshold(stats.rushYds ?? 0, 100);
    if (rushYdsFloor >= 1000) {
      matches.push({ type: "rushYdsAtLeast", min: rushYdsFloor });
    }

    const rushTdFloor = statThreshold(stats.rushTd ?? 0, 2);
    if (rushTdFloor >= 8) {
      matches.push({ type: "rushTdAtLeast", min: rushTdFloor });
    }

    const recYdsFloor = statThreshold(stats.recYds, 50);
    if (recYdsFloor >= 400) {
      matches.push({ type: "recYdsAtLeast", min: recYdsFloor });
    }

    const recTdFloor = statThreshold(stats.recTd, 1);
    if (recTdFloor >= 3) {
      matches.push({ type: "recTdAtLeast", min: recTdFloor });
    }
  } else {
    const passYdsFloor = statThreshold(stats.passYds, 500);
    if (passYdsFloor >= 3000) {
      matches.push({ type: "passYdsAtLeast", min: passYdsFloor });
    }

    const passTdFloor = statThreshold(stats.passTd, 5);
    if (passTdFloor >= 25) {
      matches.push({ type: "passTdAtLeast", min: passTdFloor });
    }

    const compPctFloor = statThreshold(stats.compPct, 2);
    if (compPctFloor >= 65 && stats.attempts >= 200) {
      matches.push({ type: "compPctAtLeast", min: compPctFloor });
    }

    const intFloor = statThreshold(stats.interceptions, 5);
    if (intFloor >= 10) {
      matches.push({ type: "interceptionsAtLeast", min: intFloor });
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

export function isSeasonAllProCriterion(criterion: Criterion): boolean {
  return criterion.type === "allPro";
}

export function isEliteSeasonAwardCriterion(criterion: Criterion): boolean {
  return ELITE_SEASON_AWARD_TYPES.has(criterion.type);
}

function isStatCriterion(criterion: Criterion): boolean {
  return (
    criterion.type === "passYdsAtLeast" ||
    criterion.type === "passTdAtLeast" ||
    criterion.type === "compPctAtLeast" ||
    criterion.type === "interceptionsAtLeast" ||
    criterion.type === "recYdsAtLeast" ||
    criterion.type === "recTdAtLeast" ||
    criterion.type === "receptionsAtLeast" ||
    criterion.type === "targetsAtLeast" ||
    criterion.type === "rushYdsAtLeast" ||
    criterion.type === "rushTdAtLeast"
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

function passYdsFallbackCriterion(
  assignment: PlayerSeasonAssignment,
): Criterion | null {
  const min = statThreshold(assignment.stats.passYds, 500);
  if (min >= MIN_SHELL_PASS_YDS_FALLBACK) {
    return { type: "passYdsAtLeast", min };
  }
  return null;
}

function recYdsFallbackCriterion(
  assignment: PlayerSeasonAssignment,
): Criterion | null {
  const min = statThreshold(assignment.stats.recYds, 100);
  if (min >= MIN_SHELL_REC_YDS_FALLBACK) {
    return { type: "recYdsAtLeast", min };
  }
  return null;
}

function rushYdsFallbackCriterion(
  assignment: PlayerSeasonAssignment,
): Criterion | null {
  const min = statThreshold(assignment.stats.rushYds ?? 0, 100);
  if (min >= MIN_SHELL_RUSH_YDS_FALLBACK) {
    return { type: "rushYdsAtLeast", min };
  }
  return null;
}

function statFallbackCriterion(
  assignment: PlayerSeasonAssignment,
): Criterion | null {
  if (assignment.stats.position === "WR") {
    return recYdsFallbackCriterion(assignment);
  }
  if (assignment.stats.position === "RB") {
    return rushYdsFallbackCriterion(assignment);
  }
  return passYdsFallbackCriterion(assignment);
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
      [statFallbackCriterion(assignment)].filter(
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
    countShellCriteria(cellCriteria, isSeasonAllProCriterion) >=
      MIN_SHELL_ALL_PRO &&
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
 * Assign criteria to outer shell cells, steering toward award / All-Pro / college quotas.
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

    if (!placeRequired(isSeasonAllProCriterion)) {
      continue;
    }
    if (!placeRequired(isCollegeCriterion)) {
      continue;
    }
    // Prefer elite honors (All-Pro, MVP, SB MVP, champion) before Pro Bowl.
    if (
      !placeRequired(isEliteSeasonAwardCriterion) &&
      !placeRequired(awardPredicate)
    ) {
      continue;
    }
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
