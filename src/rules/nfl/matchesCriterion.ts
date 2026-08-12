/**
 * Match puzzle perimeter criteria against an NFL player + season assignment.
 */

import type { PlayerSeasonAssignment } from "../../types/nfl.js";
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
    // --- Season honors ---
    case "mvp":
      return stats.honors.mvp;
    case "proBowl":
      return stats.honors.proBowl;
    case "allPro":
      return stats.honors.allPro;
    case "sbMvp":
      return stats.honors.sbMvp;
    case "champion":
      return stats.honors.champion;

    // --- Career honors ---
    case "everMvp":
      return bio.everMvp;
    case "everProBowl":
      return bio.everProBowl;
    case "everAllPro":
      return bio.everAllPro;
    case "everSbMvp":
      return bio.everSbMvp;
    case "everChampion":
      return bio.everChampion;

    // --- Bio ---
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

    // --- Season stats ---
    case "passYdsAtLeast":
      return stats.passYds >= criterion.min;
    case "passTdAtLeast":
      return stats.passTd >= criterion.min;
    case "interceptionsAtLeast":
      return stats.interceptions >= criterion.min;
    case "compPctAtLeast":
      return stats.compPct >= criterion.min;
    case "recYdsAtLeast":
      return stats.recYds >= criterion.min;
    case "recTdAtLeast":
      return stats.recTd >= criterion.min;
    case "receptionsAtLeast":
      return stats.receptions >= criterion.min;
    case "targetsAtLeast":
      return stats.targets >= criterion.min;
    case "rushYdsAtLeast":
      return (stats.rushYds ?? 0) >= criterion.min;
    case "rushTdAtLeast":
      return (stats.rushTd ?? 0) >= criterion.min;

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
