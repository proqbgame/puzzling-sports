/**
 * Match puzzle perimeter criteria against a player + season assignment.
 */

import type { PlayerSeasonAssignment } from "../types/nba.js";
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
    case "allStar":
      return stats.honors.allStar;
    case "allNba":
      return stats.honors.allNba;
    case "allDefensive":
      return stats.honors.allDefensive;
    case "finalsMvp":
      return stats.honors.finalsMvp;
    case "dpoy":
      return stats.honors.dpoy;
    case "sixthMan":
      return stats.honors.sixthMan;
    case "mostImproved":
      return stats.honors.mostImproved;
    case "champion":
      return stats.honors.champion;
    case "notAllStarSeason":
      return !stats.honors.allStar;

    // --- Career honors ---
    case "everMvp":
      return bio.everMvp;
    case "everAllStar":
      return bio.everAllStar;
    case "everChampion":
      return bio.everChampion;
    case "everDpoy":
      return bio.everDpoy;
    case "everSixthMan":
      return bio.everSixthMan;
    case "everMostImproved":
      return bio.everMostImproved;
    case "everFinalsMvp":
      return bio.everFinalsMvp;
    case "everAllNba":
      return bio.everAllNba;
    case "everAllDefensive":
      return bio.everAllDefensive;
    case "notAllStar":
      return !bio.everAllStar;

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
    case "ppgAtLeast":
      return stats.ppg >= criterion.min;
    case "rpgAtLeast":
      return stats.rpg >= criterion.min;
    case "apgAtLeast":
      return stats.apg >= criterion.min;
    case "blkAtLeast":
      return stats.blk >= criterion.min;

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
