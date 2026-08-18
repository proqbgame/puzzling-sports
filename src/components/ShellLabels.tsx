import type { CSSProperties } from "react";
import type { DailyPuzzleFile } from "../puzzle/types.js";
import type { DailyNflPuzzleFile } from "../puzzle/nfl/types.js";
import type { DailyMlbPuzzleFile } from "../puzzle/mlb/types.js";
import type { GridDirection } from "../rules/grid.js";
import {
  BOARD,
  PAD,
  getShellLabelPlacements,
  type ShellLabelPlacement,
} from "./puzzlePiecePath.js";

const VIEW_SIZE = BOARD + PAD * 2;

interface ShellLabelsProps {
  puzzle: DailyPuzzleFile | DailyNflPuzzleFile | DailyMlbPuzzleFile;
}

function labelTransform(direction: GridDirection): string {
  switch (direction) {
    case "up":
    case "down":
    case "left":
    case "right":
      return "translate(-50%, -50%)";
  }
}

function placementStyle(placement: ShellLabelPlacement): CSSProperties {
  return {
    left: `${((PAD + placement.x) / VIEW_SIZE) * 100}%`,
    top: `${((PAD + placement.y) / VIEW_SIZE) * 100}%`,
    transform: labelTransform(placement.direction),
  };
}

export function ShellLabels({ puzzle }: ShellLabelsProps) {
  const placements = getShellLabelPlacements(puzzle.cells);

  return (
    <div className="shell-labels" aria-hidden="true">
      {placements.map((placement) => (
        <span
          key={`${placement.cellId}-${placement.direction}`}
          className={`perimeter-label label-${placement.direction}`}
          style={placementStyle(placement)}
        >
          {placement.text}
        </span>
      ))}
    </div>
  );
}
