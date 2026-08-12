/**
 * Perimeter criteria for NFL QB puzzle cells.
 */

/** Season honor flags (that season only). */
export type SeasonHonorCriterion =
  | { type: "mvp" }
  | { type: "proBowl" }
  | { type: "allPro" }
  | { type: "sbMvp" }
  | { type: "champion" };

/** Career honor flags (ever, across all seasons). */
export type CareerHonorCriterion =
  | { type: "everMvp" }
  | { type: "everProBowl" }
  | { type: "everAllPro" }
  | { type: "everSbMvp" }
  | { type: "everChampion" };

export type BioCriterion =
  | { type: "college"; school: string }
  | { type: "draftPick"; pick: number }
  | { type: "topDraftPick"; maxPick: number }
  | { type: "draftRound"; round: number }
  | { type: "undrafted" }
  | { type: "seasonsPlayed"; min: number };

/** Stat thresholds — AtLeast for counting/rate stats (matches NBA edge fill pattern). */
export type StatCriterion =
  | { type: "passYdsAtLeast"; min: number }
  | { type: "passTdAtLeast"; min: number }
  | { type: "interceptionsAtLeast"; min: number }
  | { type: "compPctAtLeast"; min: number }
  | { type: "recYdsAtLeast"; min: number }
  | { type: "recTdAtLeast"; min: number }
  | { type: "receptionsAtLeast"; min: number }
  | { type: "targetsAtLeast"; min: number }
  | { type: "rushYdsAtLeast"; min: number }
  | { type: "rushTdAtLeast"; min: number };

export type Criterion =
  | SeasonHonorCriterion
  | CareerHonorCriterion
  | BioCriterion
  | StatCriterion;

export type CriterionType = Criterion["type"];

export const CRITERION_DISPLAY: Partial<Record<CriterionType, string>> = {
  mvp: "MVP",
  proBowl: "Pro Bowl",
  allPro: "All-Pro",
  sbMvp: "SB MVP",
  champion: "Super Bowl Champion",
  everMvp: "MVP (career)",
  everProBowl: "Pro Bowl (career)",
  everAllPro: "All-Pro (career)",
  everSbMvp: "SB MVP (career)",
  everChampion: "Super Bowl Champion (career)",
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
    case "passYdsAtLeast":
      return `${criterion.min}+ PASS YDS`;
    case "passTdAtLeast":
      return `${criterion.min}+ PASS TD`;
    case "interceptionsAtLeast":
      return `${criterion.min}+ INT`;
    case "compPctAtLeast":
      return `${criterion.min}%+`;
    case "recYdsAtLeast":
      return `${criterion.min}+ REC YDS`;
    case "recTdAtLeast":
      return `${criterion.min}+ REC TD`;
    case "receptionsAtLeast":
      return `${criterion.min}+ REC`;
    case "targetsAtLeast":
      return `${criterion.min}+ TGT`;
    case "rushYdsAtLeast":
      return `${criterion.min}+ RUSH YDS`;
    case "rushTdAtLeast":
      return `${criterion.min}+ RUSH TD`;
    default:
      return CRITERION_DISPLAY[criterion.type] ?? criterion.type;
  }
}

/** Shorthand builders for puzzles and tests. */
export const Criteria = {
  college: (school: string): Criterion => ({ type: "college", school }),
  firstPick: (): Criterion => ({ type: "draftPick", pick: 1 }),
  mvp: (): Criterion => ({ type: "mvp" }),
  proBowl: (): Criterion => ({ type: "proBowl" }),
  allPro: (): Criterion => ({ type: "allPro" }),
  sbMvp: (): Criterion => ({ type: "sbMvp" }),
  champion: (): Criterion => ({ type: "champion" }),
  seasonsPlayed: (min: number): Criterion => ({ type: "seasonsPlayed", min }),
  passYdsAtLeast: (min: number): Criterion => ({ type: "passYdsAtLeast", min }),
  passTdAtLeast: (min: number): Criterion => ({ type: "passTdAtLeast", min }),
  interceptionsAtLeast: (min: number): Criterion => ({
    type: "interceptionsAtLeast",
    min,
  }),
  compPctAtLeast: (min: number): Criterion => ({ type: "compPctAtLeast", min }),
  recYdsAtLeast: (min: number): Criterion => ({ type: "recYdsAtLeast", min }),
  recTdAtLeast: (min: number): Criterion => ({ type: "recTdAtLeast", min }),
  receptionsAtLeast: (min: number): Criterion => ({
    type: "receptionsAtLeast",
    min,
  }),
  targetsAtLeast: (min: number): Criterion => ({ type: "targetsAtLeast", min }),
  rushYdsAtLeast: (min: number): Criterion => ({ type: "rushYdsAtLeast", min }),
  rushTdAtLeast: (min: number): Criterion => ({ type: "rushTdAtLeast", min }),
} as const;
