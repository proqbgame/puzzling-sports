export {
  MLB_HITTER_STAT_CONFIG,
  MLB_PITCHER_STAT_CONFIG,
  getStatConfig,
  normalizeMlbStatPosition,
  statForEdge,
  statLabel,
  type MlbStatKey,
  type MlbStatPosition,
  type SportStatConfig,
} from "./statConfig.js";
export {
  type BioCriterion,
  type CareerHonorCriterion,
  type Criterion,
  type CriterionType,
  CRITERION_DISPLAY,
  criterionLabel,
  type SeasonHonorCriterion,
  type StatCriterion,
} from "./criteria.js";
export {
  getFailedCriteria,
  matchesAllCriteria,
  matchesCriterion,
  type CriterionFailure,
} from "./matchesCriterion.js";
export {
  compareEdge,
  describeEdgeComparison,
  edgeFailureMessage,
  validateEdgesForCell,
  type EdgeComparisonDetail,
} from "./compareEdge.js";
export {
  formatCriteriaList,
  isPuzzleComplete,
  type BoardState,
  type GameMode,
  type GuessInput,
  type GuessValidationResult,
  type PuzzleCellConfig,
  type PuzzleDefinition,
  type ValidationFailure,
  validateGuess,
} from "./validateGuess.js";
