/**
 * Perimeter criteria for puzzle cells.
 *
 * Bio criteria use career / draft data (same for any season).
 * Season criteria use honors or stats from the chosen season row.
 */

/** Season honor flags (that season only). */
export type SeasonHonorCriterion =
  | { type: "mvp" }
  | { type: "allStar" }
  | { type: "allNba" }
  | { type: "allDefensive" }
  | { type: "finalsMvp" }
  | { type: "dpoy" }
  | { type: "sixthMan" }
  | { type: "mostImproved" }
  | { type: "champion" }
  | { type: "notAllStarSeason" };

/** Career honor flags (ever, across all seasons). */
export type CareerHonorCriterion =
  | { type: "everMvp" }
  | { type: "everAllStar" }
  | { type: "everChampion" }
  | { type: "everDpoy" }
  | { type: "everSixthMan" }
  | { type: "everMostImproved" }
  | { type: "everFinalsMvp" }
  | { type: "everAllNba" }
  | { type: "everAllDefensive" }
  | { type: "notAllStar" };

export type BioCriterion =
  | { type: "college"; school: string }
  | { type: "draftPick"; pick: number }
  | { type: "topDraftPick"; maxPick: number }
  | { type: "draftRound"; round: number }
  | { type: "undrafted" }
  | { type: "seasonsPlayed"; min: number };

export type StatCriterion =
  | { type: "ppgAtLeast"; min: number }
  | { type: "rpgAtLeast"; min: number }
  | { type: "apgAtLeast"; min: number }
  | { type: "blkAtLeast"; min: number };

export type Criterion =
  | SeasonHonorCriterion
  | CareerHonorCriterion
  | BioCriterion
  | StatCriterion;

export type CriterionType = Criterion["type"];

/** Human-readable labels for daily puzzle UI (examples from your sketch). */
export const CRITERION_DISPLAY: Partial<Record<CriterionType, string>> = {
  mvp: "MVP",
  allStar: "All-Star",
  allNba: "All-NBA",
  allDefensive: "All-Defensive",
  finalsMvp: "Finals MVP",
  dpoy: "DPOY",
  sixthMan: "6th Man of the Year",
  mostImproved: "Most Improved Player",
  champion: "NBA Champion",
  notAllStarSeason: "Not an All-Star",
  notAllStar: "Never an All-Star",
  everMvp: "MVP (career)",
  everAllStar: "All-Star (career)",
  everChampion: "NBA Champion (career)",
  everDpoy: "DPOY (career)",
  everSixthMan: "6th Man of the Year (career)",
  everMostImproved: "Most Improved Player (career)",
  everFinalsMvp: "Finals MVP (career)",
  everAllNba: "All-NBA (career)",
  everAllDefensive: "All-Defensive (career)",
  undrafted: "Undrafted",
};

export function criterionLabel(criterion: Criterion): string {
  switch (criterion.type) {
    case "college":
      return criterion.school;
    case "draftPick":
      return criterion.pick === 1 ? "1st Pick" : `#${criterion.pick} Pick`;
    case "topDraftPick":
      return `Top ${criterion.maxPick} Pick`;
    case "draftRound":
      return `Round ${criterion.round}`;
    case "seasonsPlayed":
      return `${criterion.min}+ Seasons`;
    case "ppgAtLeast":
      return `${criterion.min}+ PPG`;
    case "rpgAtLeast":
      return `${criterion.min}+ RPG`;
    case "apgAtLeast":
      return `${criterion.min}+ APG`;
    case "blkAtLeast":
      return `${criterion.min}+ BLK`;
    default:
      return CRITERION_DISPLAY[criterion.type] ?? criterion.type;
  }
}

/** Shorthand builders for puzzles and tests. */
export const Criteria = {
  college: (school: string): Criterion => ({ type: "college", school }),
  firstPick: (): Criterion => ({ type: "draftPick", pick: 1 }),
  mvp: (): Criterion => ({ type: "mvp" }),
  allStar: (): Criterion => ({ type: "allStar" }),
  champion: (): Criterion => ({ type: "champion" }),
  notAllStar: (): Criterion => ({ type: "notAllStar" }),
  seasonsPlayed: (min: number): Criterion => ({ type: "seasonsPlayed", min }),
  ppgAtLeast: (min: number): Criterion => ({ type: "ppgAtLeast", min }),
} as const;
