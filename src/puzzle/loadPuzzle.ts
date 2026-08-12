import type { NbaDatabase } from "../data/NbaDatabase.js";
import type { CellId } from "../rules/grid.js";
import { resolveEdgeTopology } from "../rules/topology.js";
import type { PuzzleDefinition } from "../rules/validateGuess.js";
import type { DailyPuzzleFile } from "./types.js";

/** Rebuild a PuzzleDefinition from a saved daily puzzle file. */
export function puzzleDefinitionFromFile(
  file: DailyPuzzleFile,
  db: NbaDatabase,
): PuzzleDefinition | null {
  const base = db.getAssignment(file.base.playerId, file.base.season);
  if (!base) {
    return null;
  }

  const cells: PuzzleDefinition["cells"] = {};

  for (const [cellId, config] of Object.entries(file.cells)) {
    if (config) {
      cells[cellId as CellId] = {
        criteria: config.criteria,
      };
    }
  }

  return {
    base,
    cells,
    edgeOverrides: resolveEdgeTopology(file.edges),
  };
}
