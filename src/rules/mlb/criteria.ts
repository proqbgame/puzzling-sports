/**
 * Perimeter criteria for MLB pitcher / hitter puzzle cells.
 */

export type SeasonHonorCriterion =
  | { type: "mvp" }
  | { type: "allStar" }
  | { type: "cyYoung" }
  | { type: "silverSlugger" }
  | { type: "goldGlove" }
  | { type: "wsMvp" }
  | { type: "champion" };

export type CareerHonorCriterion =
  | { type: "everMvp" }
  | { type: "everAllStar" }
  | { type: "everCyYoung" }
  | { type: "everSilverSlugger" }
  | { type: "everGoldGlove" }
  | { type: "everWsMvp" }
  | { type: "everChampion" };

export type BioCriterion =
  | { type: "college"; school: string }
  | { type: "draftPick"; pick: number }
  | { type: "topDraftPick"; maxPick: number }
  | { type: "draftRound"; round: number }
  | { type: "undrafted" }
  | { type: "seasonsPlayed"; min: number };

export type StatCriterion =
  | { type: "hrAtLeast"; min: number }
  | { type: "rbiAtLeast"; min: number }
  | { type: "avgAtLeast"; min: number }
  | { type: "sbAtLeast"; min: number }
  | { type: "soAtLeast"; min: number }
  | { type: "wAtLeast"; min: number }
  | { type: "ipAtLeast"; min: number }
  | { type: "eraAtMost"; max: number };

export type Criterion =
  | SeasonHonorCriterion
  | CareerHonorCriterion
  | BioCriterion
  | StatCriterion;

export type CriterionType = Criterion["type"];

export const CRITERION_DISPLAY: Partial<Record<CriterionType, string>> = {
  mvp: "MVP",
  allStar: "All-Star",
  cyYoung: "Cy Young",
  silverSlugger: "Silver Slugger",
  goldGlove: "Gold Glove",
  wsMvp: "WS MVP",
  champion: "World Series Champion",
  everMvp: "MVP (career)",
  everAllStar: "All-Star (career)",
  everCyYoung: "Cy Young (career)",
  everSilverSlugger: "Silver Slugger (career)",
  everGoldGlove: "Gold Glove (career)",
  everWsMvp: "WS MVP (career)",
  everChampion: "World Series Champion (career)",
  undrafted: "Undrafted",
};

function formatAvg(min: number): string {
  return min.toFixed(3).replace(/^0/, "");
}

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
    case "hrAtLeast":
      return `${criterion.min}+ HR`;
    case "rbiAtLeast":
      return `${criterion.min}+ RBI`;
    case "avgAtLeast":
      return `${formatAvg(criterion.min)}+ AVG`;
    case "sbAtLeast":
      return `${criterion.min}+ SB`;
    case "soAtLeast":
      return `${criterion.min}+ SO`;
    case "wAtLeast":
      return `${criterion.min}+ W`;
    case "ipAtLeast":
      return `${criterion.min}+ IP`;
    case "eraAtMost":
      return `ERA ≤ ${criterion.max.toFixed(2)}`;
    default:
      return CRITERION_DISPLAY[criterion.type] ?? criterion.type;
  }
}
