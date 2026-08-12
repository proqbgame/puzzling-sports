export {
  NFL_QB_STAT_CONFIG,
  NFL_WR_STAT_CONFIG,
  NFL_RB_STAT_CONFIG,
  getStatConfig,
  normalizeNflStatPosition,
  statForEdge,
  statLabel,
  type NflStatKey,
  type NflStatPosition,
  type SportStatConfig,
} from "./statConfig.js";
export {
  type BioCriterion,
  type CareerHonorCriterion,
  type Criterion,
  type CriterionType,
  CRITERION_DISPLAY,
  Criteria,
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
