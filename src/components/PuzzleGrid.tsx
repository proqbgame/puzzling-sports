import { useMemo, useState } from "react";
import type { DailyPuzzleFile } from "../puzzle/types.js";
import type { DailyNflPuzzleFile } from "../puzzle/nfl/types.js";
import type { DailyMlbPuzzleFile } from "../puzzle/mlb/types.js";
import type { CellId, EdgeConnection } from "../rules/grid.js";
import { resolveEdgeTopology } from "../rules/topology.js";
import { compareEdge as compareNbaEdge } from "../rules/compareEdge.js";
import { compareEdge as compareNflEdge } from "../rules/nfl/compareEdge.js";
import { compareEdge as compareMlbEdge } from "../rules/mlb/compareEdge.js";
import type {
  BoardState as NbaBoardState,
  PuzzleDefinition as NbaPuzzleDefinition,
} from "../rules/validateGuess.js";
import type {
  BoardState as NflBoardState,
  PuzzleDefinition as NflPuzzleDefinition,
} from "../rules/nfl/validateGuess.js";
import type { PlayerSeasonAssignment as NbaAssignment } from "../types/nba.js";
import type { PlayerSeasonAssignment as NflAssignment } from "../types/nfl.js";
import type { PlayerSeasonAssignment as MlbAssignment } from "../types/mlb.js";
import type {
  BoardState as MlbBoardState,
  PuzzleDefinition as MlbPuzzleDefinition,
} from "../rules/mlb/validateGuess.js";
import { PuzzleCell } from "./PuzzleCell.js";
import { ShellLabels } from "./ShellLabels.js";
import {
  BOARD,
  FILL_RENDER_ORDER,
  PAD,
  BOARD_VIEW_BOX,
  getBoardOuterPath,
  getBoardPiecePath,
  getInteriorEdgeSegments,
  type InteriorEdgeSegment,
} from "./puzzlePiecePath.js";

type AnyPuzzleFile = DailyPuzzleFile | DailyNflPuzzleFile | DailyMlbPuzzleFile;
type AnyBoardState = NbaBoardState | NflBoardState | MlbBoardState;
type AnyPuzzleDefinition = NbaPuzzleDefinition | NflPuzzleDefinition | MlbPuzzleDefinition;
type AnyAssignment = NbaAssignment | NflAssignment | MlbAssignment;

interface PuzzleGridProps {
  puzzle: AnyPuzzleFile;
  definition: AnyPuzzleDefinition;
  board: AnyBoardState;
  selectedCell: CellId | null;
  onSelectCell: (cellId: CellId) => void;
  sport?: "nba" | "nfl" | "mlb";
  /** Pass A: board geometry only — no labels or cell text */
  boardOnly?: boolean;
}

const VIEW_SIZE = BOARD + PAD * 2;

const OVERLAY_INSET = `${(PAD / VIEW_SIZE) * 100}%`;

const OVERLAY_SIZE = `${(BOARD / VIEW_SIZE) * 100}%`;

type EdgeGlow = "pending" | "correct" | "incorrect";

function pieceFillClass(
  isCenter: boolean,
  filled: boolean,
  hovered: boolean,
): string {
  return [
    "piece-fill",
    isCenter ? "center-fill" : "",
    filled && !isCenter ? "filled-fill" : "",
    hovered ? "hover-fill" : "",
  ]
    .filter(Boolean)
    .join(" ");
}

function assignmentForCell(
  cellId: CellId,
  board: AnyBoardState,
  base: AnyAssignment,
): AnyAssignment | undefined {
  if (cellId === "center") {
    return base;
  }
  return board[cellId];
}

function edgeGlowForSegment(
  segment: InteriorEdgeSegment,
  board: AnyBoardState,
  base: AnyAssignment,
  sport: "nba" | "nfl" | "mlb",
): EdgeGlow {
  const from = assignmentForCell(segment.fromCellId, board, base);
  const to = assignmentForCell(segment.toCellId, board, base);
  if (!from || !to) {
    return "pending";
  }

  const connection = segment.connectionOnFrom as EdgeConnection;
  const valid =
    sport === "mlb"
      ? compareMlbEdge(
          from as MlbAssignment,
          to as MlbAssignment,
          segment.fromCellId,
          segment.toCellId,
          connection,
        )
      : sport === "nfl"
      ? compareNflEdge(
          from as NflAssignment,
          to as NflAssignment,
          segment.fromCellId,
          segment.toCellId,
          connection,
        )
      : compareNbaEdge(
          from as NbaAssignment,
          to as NbaAssignment,
          segment.fromCellId,
          segment.toCellId,
          connection,
        );

  return valid ? "correct" : "incorrect";
}

export function PuzzleGrid({
  puzzle,
  definition,
  board,
  selectedCell,
  onSelectCell,
  sport = "nba",
  boardOnly = false,
}: PuzzleGridProps) {
  const [hoveredCell, setHoveredCell] = useState<CellId | null>(null);
  const topology = resolveEdgeTopology(puzzle.edges);
  const outerPath = getBoardOuterPath();
  const interiorEdges = useMemo(
    () => getInteriorEdgeSegments(topology),
    [topology],
  );

  return (
    <section
      className={["puzzle-grid-wrap", boardOnly ? "board-pass-a" : ""]
        .filter(Boolean)
        .join(" ")}
      aria-label="Puzzle board"
    >
      <div className="puzzle-board">
        <svg
          className="puzzle-board-svg"
          viewBox={BOARD_VIEW_BOX}
          preserveAspectRatio="xMidYMid meet"
          aria-hidden="true"
        >
          <g className="piece-fills">
            {FILL_RENDER_ORDER.map((cellId) => {
              const isCenter = cellId === "center";
              const filled = isCenter || Boolean(board[cellId]);

              return (
                <path
                  key={cellId}
                  data-cell={cellId}
                  d={getBoardPiecePath(cellId, topology)}
                  className={pieceFillClass(
                    isCenter,
                    filled,
                    hoveredCell === cellId && !filled && !isCenter,
                  )}
                />
              );
            })}
          </g>
          <g className="piece-strokes">
            <path
              d={outerPath}
              className={[
                "piece-stroke",
                "piece-stroke-outer",
                selectedCell ? "has-selection" : "",
              ].join(" ")}
            />
            {interiorEdges.map((segment) => {
              const glow = edgeGlowForSegment(
                segment,
                board,
                definition.base,
                sport,
              );
              return (
                <path
                  key={segment.key}
                  d={segment.path}
                  className={[
                    "piece-stroke",
                    "piece-stroke-interior",
                    glow === "correct" ? "edge-correct" : "",
                    glow === "incorrect" ? "edge-incorrect" : "",
                    selectedCell ? "has-selection" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                />
              );
            })}
          </g>
        </svg>

        <div
          className="puzzle-overlays"
          style={{
            top: OVERLAY_INSET,
            left: OVERLAY_INSET,
            width: OVERLAY_SIZE,
            height: OVERLAY_SIZE,
          }}
        >
          {ALL_CELL_IDS.map((cellId) => {
            const isCenter = cellId === "center";
            const assignment = isCenter ? definition.base : board[cellId];

            return (
              <PuzzleCell
                key={cellId}
                cellId={cellId}
                isCenter={isCenter}
                sport={sport}
                topology={topology}
                baseStats={isCenter ? puzzle.base.stats : undefined}
                assignment={assignment}
                selected={selectedCell === cellId}
                locked={!isCenter && Boolean(board[cellId])}
                onHoverChange={(hovered) => {
                  setHoveredCell(hovered ? cellId : null);
                }}
                onSelect={() => {
                  if (!isCenter && !board[cellId]) {
                    onSelectCell(cellId);
                  }
                }}
              />
            );
          })}
        </div>

        {!boardOnly ? (
          <div className="shell-labels-wrap">
            <ShellLabels puzzle={puzzle} />
          </div>
        ) : null}
      </div>
    </section>
  );
}

const ALL_CELL_IDS: CellId[] = [
  "top-left",
  "top-middle",
  "top-right",
  "middle-left",
  "center",
  "middle-right",
  "bottom-left",
  "bottom-middle",
  "bottom-right",
];
