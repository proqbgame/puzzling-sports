import type { NflDatabase } from "../../data/NflDatabase.js";
import type { CellId } from "../../rules/grid.js";
import { resolveEdgeTopology } from "../../rules/topology.js";
import type { PuzzleDefinition } from "../../rules/nfl/validateGuess.js";
import type { DailyNflPuzzleFile } from "./types.js";

/** Rebuild a PuzzleDefinition from a saved daily NFL puzzle file. */
export function puzzleDefinitionFromNflFile(
  file: DailyNflPuzzleFile,
  db: NflDatabase,
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
