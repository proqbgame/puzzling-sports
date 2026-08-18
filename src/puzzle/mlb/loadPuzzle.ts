import type { MlbDatabase } from "../../data/MlbDatabase.js";
import { resolveEdgeTopology } from "../../rules/topology.js";
import type { CellId } from "../../rules/grid.js";
import type { PuzzleDefinition } from "../../rules/mlb/validateGuess.js";
import { mlbRowPosition, type DailyMlbPuzzleFile } from "./types.js";

export function puzzleDefinitionFromMlbFile(
  file: DailyMlbPuzzleFile,
  db: MlbDatabase,
): PuzzleDefinition | null {
  const rowPosition = mlbRowPosition(file.position);
  const base = db.getAssignment(file.base.playerId, file.base.season, rowPosition);
  if (!base) {
    return null;
  }

  const cells: PuzzleDefinition["cells"] = {};
  for (const [cellId, config] of Object.entries(file.cells)) {
    if (config) {
      cells[cellId as CellId] = { criteria: config.criteria };
    }
  }

  return {
    base,
    cells,
    edgeOverrides: resolveEdgeTopology(file.edges),
    position: rowPosition,
  };
}
