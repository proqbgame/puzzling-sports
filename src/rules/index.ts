export {
  CELL_POSITIONS,
  directionBetween,
  NEIGHBOR_BY_DIRECTION,
  oppositeDirection,
  OUTER_CELL_IDS,
  statForEdge,
  statLabel,
  type CellId,
  type CellPosition,
  type EdgeConnection,
  type GridDirection,
  type StatKey,
} from "./grid.js";
export {
  generateEdgeTopology,
  getCellEdges,
  isCompleteEdgeTopology,
  resolveEdgeTopology,
  STANDARD_CELL_EDGES,
  type CellEdgeMap,
  type EdgeTopology,
} from "./topology.js";
export {
  compareEdge,
  describeEdgeComparison,
  edgeFailureMessage,
  validateEdgesForCell,
  type EdgeComparisonDetail,
} from "./compareEdge.js";
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
