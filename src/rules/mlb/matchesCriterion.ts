import type { PlayerSeasonAssignment } from "../../types/mlb.js";
import { type Criterion, criterionLabel } from "./criteria.js";

function normalizeText(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/\s+/g, " ");
}

function collegeMatches(bioCollege: string | null, school: string): boolean {
  if (!bioCollege) {
    return false;
  }
  const a = normalizeText(bioCollege);
  const b = normalizeText(school);
  return a === b || a.includes(b) || b.includes(a);
}

function isValidDraftPick(pick: number | null): pick is number {
  return pick !== null && pick > 0;
}

export function matchesCriterion(
  assignment: PlayerSeasonAssignment,
  criterion: Criterion,
): boolean {
  const { bio, stats } = assignment;

  switch (criterion.type) {
    case "mvp":
      return stats.honors.mvp;
    case "allStar":
      return stats.honors.allStar;
    case "cyYoung":
      return stats.honors.cyYoung;
    case "silverSlugger":
      return stats.honors.silverSlugger;
    case "goldGlove":
      return stats.honors.goldGlove;
    case "wsMvp":
      return stats.honors.wsMvp;
    case "champion":
      return stats.honors.champion;
    case "everMvp":
      return bio.everMvp;
    case "everAllStar":
      return bio.everAllStar;
    case "everCyYoung":
      return bio.everCyYoung;
    case "everSilverSlugger":
      return bio.everSilverSlugger;
    case "everGoldGlove":
      return bio.everGoldGlove;
    case "everWsMvp":
      return bio.everWsMvp;
    case "everChampion":
      return bio.everChampion;
    case "college":
      return collegeMatches(bio.college, criterion.school);
    case "draftPick":
      return isValidDraftPick(bio.draftPick) && bio.draftPick === criterion.pick;
    case "topDraftPick":
      return (
        isValidDraftPick(bio.draftPick) &&
        bio.draftPick >= 1 &&
        bio.draftPick <= criterion.maxPick
      );
    case "draftRound":
      return bio.draftRound === criterion.round;
    case "undrafted":
      return bio.undrafted;
    case "seasonsPlayed":
      return bio.seasonsPlayed >= criterion.min;
    case "hrAtLeast":
      return stats.hr >= criterion.min;
    case "rbiAtLeast":
      return stats.rbi >= criterion.min;
    case "avgAtLeast":
      return stats.avg >= criterion.min;
    case "sbAtLeast":
      return stats.sb >= criterion.min;
    case "soAtLeast":
      return stats.so >= criterion.min;
    case "wAtLeast":
      return stats.w >= criterion.min;
    case "ipAtLeast":
      return stats.ip >= criterion.min;
    case "eraAtMost":
      return stats.era > 0 && stats.era <= criterion.max;
    default: {
      const _exhaustive: never = criterion;
      return _exhaustive;
    }
  }
}

export function matchesAllCriteria(
  assignment: PlayerSeasonAssignment,
  criteria: readonly Criterion[],
): boolean {
  return criteria.every((criterion) => matchesCriterion(assignment, criterion));
}

export interface CriterionFailure {
  criterion: Criterion;
  label: string;
}

export function getFailedCriteria(
  assignment: PlayerSeasonAssignment,
  criteria: readonly Criterion[],
): CriterionFailure[] {
  return criteria
    .filter((criterion) => !matchesCriterion(assignment, criterion))
    .map((criterion) => ({
      criterion,
      label: criterionLabel(criterion),
    }));
}
