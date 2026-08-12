import type { CellId, EdgeConnection, GridDirection } from "../rules/grid.js";
import {
  resolveEdgeTopology,
  type EdgeTopology,
} from "../rules/topology.js";

export const CELL = 100;
export const PAD = 40;
export const BOARD = CELL * 3;
export const CORNER_R = 12;

const KNOB_DEPTH = CELL * 0.148;

type EdgeShape = "flat" | EdgeConnection;

const CELL_ORIGIN: Record<CellId, { col: number; row: number }> = {
  "top-left": { col: 0, row: 0 },
  "top-middle": { col: 1, row: 0 },
  "top-right": { col: 2, row: 0 },
  "middle-left": { col: 0, row: 1 },
  center: { col: 1, row: 1 },
  "middle-right": { col: 2, row: 1 },
  "bottom-left": { col: 0, row: 2 },
  "bottom-middle": { col: 1, row: 2 },
  "bottom-right": { col: 2, row: 2 },
};

export const FILL_RENDER_ORDER: CellId[] = [
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

export const BOARD_VIEW_BOX = `${-PAD} ${-PAD} ${BOARD + PAD * 2} ${BOARD + PAD * 2}`;

export const ALL_CELL_IDS: CellId[] = [
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

function edgeShape(
  cellId: CellId,
  direction: GridDirection,
  topology: EdgeTopology,
): EdgeShape {
  return topology[cellId][direction] ?? "flat";
}

function f(n: number): string {
  return (Math.round(n * 100) / 100).toString();
}

function connectorMetrics(span: number) {
  return {
    neck: span * 0.048,
    head: span * 0.158,
    flatInset: span * 0.158 * 0.22,
  };
}

function cellBounds(cellId: CellId) {
  const { col, row } = CELL_ORIGIN[cellId];
  return {
    x0: col * CELL,
    y0: row * CELL,
    x1: (col + 1) * CELL,
    y1: (row + 1) * CELL,
    col,
    row,
  };
}

const CELL_GRID: CellId[][] = [
  ["top-left", "top-middle", "top-right"],
  ["middle-left", "center", "middle-right"],
  ["bottom-left", "bottom-middle", "bottom-right"],
];

function cellAt(col: number, row: number): CellId {
  return CELL_GRID[row][col];
}

/**
 * Mushroom arc only (nL → nR around peak). No straight edge runs through the neck.
 */
function horizontalBumpArc(
  y: number,
  xStart: number,
  xEnd: number,
  kind: EdgeConnection,
  outward: 1 | -1,
): string {
  const left = Math.min(xStart, xEnd);
  const right = Math.max(xStart, xEnd);
  const mid = (left + right) / 2;
  const span = right - left;
  const { neck, head, flatInset } = connectorMetrics(span);

  const sign = kind === "tab" ? outward : -outward;
  const peakY = y + sign * KNOB_DEPTH;

  const nL = mid - neck;
  const nR = mid + neck;
  const hL = mid - head;
  const hR = mid + head;

  return [
    `L ${f(nL)} ${f(y)}`,
    `C ${f(nL)} ${f(y + sign * KNOB_DEPTH * 0.3)}, ${f(hL)} ${f(peakY)}, ${f(hL + flatInset)} ${f(peakY)}`,
    `L ${f(hR - flatInset)} ${f(peakY)}`,
    `C ${f(hR)} ${f(peakY)}, ${f(nR)} ${f(y + sign * KNOB_DEPTH * 0.3)}, ${f(nR)} ${f(y)}`,
  ].join(" ");
}

function verticalBumpArc(
  x: number,
  yStart: number,
  yEnd: number,
  kind: EdgeConnection,
  outward: 1 | -1,
): string {
  const top = Math.min(yStart, yEnd);
  const bottom = Math.max(yStart, yEnd);
  const mid = (top + bottom) / 2;
  const span = bottom - top;
  const { neck, head, flatInset } = connectorMetrics(span);

  const sign = kind === "tab" ? outward : -outward;
  const peakX = x + sign * KNOB_DEPTH;

  const nT = mid - neck;
  const nB = mid + neck;
  const hT = mid - head;
  const hB = mid + head;

  return [
    `L ${f(x)} ${f(nT)}`,
    `C ${f(x + sign * KNOB_DEPTH * 0.3)} ${f(nT)}, ${f(peakX)} ${f(hT)}, ${f(peakX)} ${f(hT + flatInset)}`,
    `L ${f(peakX)} ${f(hB - flatInset)}`,
    `C ${f(peakX)} ${f(hB)}, ${f(x + sign * KNOB_DEPTH * 0.3)} ${f(nB)}, ${f(x)} ${f(nB)}`,
  ].join(" ");
}

/**
 * Mushroom connector along a horizontal edge from xStart → xEnd.
 * outward: -1 = north edge (positive y is down), +1 = south edge.
 */
function horizontalBump(
  y: number,
  xStart: number,
  xEnd: number,
  kind: EdgeConnection,
  outward: 1 | -1,
): string {
  const left = Math.min(xStart, xEnd);
  const right = Math.max(xStart, xEnd);
  const mid = (left + right) / 2;
  const span = right - left;
  const { neck, head, flatInset } = connectorMetrics(span);

  const sign = kind === "tab" ? outward : -outward;
  const peakY = y + sign * KNOB_DEPTH;

  const nL = mid - neck;
  const nR = mid + neck;
  const hL = mid - head;
  const hR = mid + head;

  return [
    `L ${f(nL)} ${f(y)}`,
    `C ${f(nL)} ${f(y + sign * KNOB_DEPTH * 0.3)}, ${f(hL)} ${f(peakY)}, ${f(hL + flatInset)} ${f(peakY)}`,
    `L ${f(hR - flatInset)} ${f(peakY)}`,
    `C ${f(hR)} ${f(peakY)}, ${f(nR)} ${f(y + sign * KNOB_DEPTH * 0.3)}, ${f(nR)} ${f(y)}`,
    `L ${f(xEnd)} ${f(y)}`,
  ].join(" ");
}

/**
 * Mushroom connector along a vertical edge from yStart → yEnd.
 * outward: -1 = west edge, +1 = east edge.
 */
function verticalBump(
  x: number,
  yStart: number,
  yEnd: number,
  kind: EdgeConnection,
  outward: 1 | -1,
): string {
  const top = Math.min(yStart, yEnd);
  const bottom = Math.max(yStart, yEnd);
  const mid = (top + bottom) / 2;
  const span = bottom - top;
  const { neck, head, flatInset } = connectorMetrics(span);

  const sign = kind === "tab" ? outward : -outward;
  const peakX = x + sign * KNOB_DEPTH;

  const nT = mid - neck;
  const nB = mid + neck;
  const hT = mid - head;
  const hB = mid + head;

  return [
    `L ${f(x)} ${f(nT)}`,
    `C ${f(x + sign * KNOB_DEPTH * 0.3)} ${f(nT)}, ${f(peakX)} ${f(hT)}, ${f(peakX)} ${f(hT + flatInset)}`,
    `L ${f(peakX)} ${f(hB - flatInset)}`,
    `C ${f(peakX)} ${f(hB)}, ${f(x + sign * KNOB_DEPTH * 0.3)} ${f(nB)}, ${f(x)} ${f(nB)}`,
    `L ${f(x)} ${f(yEnd)}`,
  ].join(" ");
}

function buildFillPath(cellId: CellId, topology: EdgeTopology): string {
  const { x0, y0, x1, y1, col, row } = cellBounds(cellId);
  const top = edgeShape(cellId, "up", topology);
  const right = edgeShape(cellId, "right", topology);
  const bottom = edgeShape(cellId, "down", topology);
  const left = edgeShape(cellId, "left", topology);

  const isTL = col === 0 && row === 0;
  const isTR = col === 2 && row === 0;
  const isBR = col === 2 && row === 2;
  const isBL = col === 0 && row === 2;

  const parts: string[] = [];

  if (isTL && top === "flat" && left === "flat") {
    parts.push(
      `M ${f(x0)} ${f(y0 + CORNER_R)}`,
      `Q ${f(x0)} ${f(y0)} ${f(x0 + CORNER_R)} ${f(y0)}`,
    );
  } else {
    parts.push(`M ${f(x0)} ${f(y0)}`);
  }

  const topStartX = isTL && left === "flat" ? x0 + CORNER_R : x0;
  const topEndX = isTR && right === "flat" ? x1 - CORNER_R : x1;

  if (top === "flat") {
    parts.push(`L ${f(topEndX)} ${f(y0)}`);
    if (isTR && right === "flat") {
      parts.push(`Q ${f(x1)} ${f(y0)} ${f(x1)} ${f(y0 + CORNER_R)}`);
    }
  } else {
    parts.push(`L ${f(topStartX)} ${f(y0)}`);
    parts.push(horizontalBump(y0, topStartX, topEndX, top, -1));
  }

  const rightStartY = isTR && top === "flat" ? y0 + CORNER_R : y0;
  const rightEndY = isBR && bottom === "flat" ? y1 - CORNER_R : y1;

  if (right === "flat") {
    if (!(isTR && top === "flat")) {
      parts.push(`L ${f(x1)} ${f(rightStartY)}`);
    }
    parts.push(`L ${f(x1)} ${f(rightEndY)}`);
    if (isBR && bottom === "flat") {
      parts.push(`Q ${f(x1)} ${f(y1)} ${f(x1 - CORNER_R)} ${f(y1)}`);
    }
  } else {
    if (!(isTR && top === "flat")) {
      parts.push(`L ${f(x1)} ${f(rightStartY)}`);
    }
    parts.push(verticalBump(x1, rightStartY, rightEndY, right, 1));
  }

  const bottomStartX = isBR && right === "flat" ? x1 - CORNER_R : x1;
  const bottomEndX = isBL && left === "flat" ? x0 + CORNER_R : x0;

  if (bottom === "flat") {
    if (!(isBR && right === "flat")) {
      parts.push(`L ${f(bottomStartX)} ${f(y1)}`);
    }
    parts.push(`L ${f(bottomEndX)} ${f(y1)}`);
    if (isBL && left === "flat") {
      parts.push(`Q ${f(x0)} ${f(y1)} ${f(x0)} ${f(y1 - CORNER_R)}`);
    }
  } else {
    if (!(isBR && right === "flat")) {
      parts.push(`L ${f(bottomStartX)} ${f(y1)}`);
    }
    parts.push(horizontalBump(y1, bottomStartX, bottomEndX, bottom, 1));
  }

  const leftStartY = isBL && bottom === "flat" ? y1 - CORNER_R : y1;
  const leftEndY = isTL && top === "flat" ? y0 + CORNER_R : y0;

  if (left === "flat") {
    if (!(isBL && bottom === "flat")) {
      parts.push(`L ${f(x0)} ${f(leftStartY)}`);
    }
    parts.push(`L ${f(x0)} ${f(leftEndY)}`);
  } else {
    if (!(isBL && bottom === "flat")) {
      parts.push(`L ${f(x0)} ${f(leftStartY)}`);
    }
    parts.push(verticalBump(x0, leftStartY, leftEndY, left, -1));
  }

  parts.push("Z");
  return parts.join(" ");
}

/** One continuous outer border with all four rounded corners. */
function buildOuterPerimeterPath(): string {
  const b = BOARD;
  const r = CORNER_R;
  return [
    `M 0 ${f(r)}`,
    `Q 0 0 ${f(r)} 0`,
    `L ${f(b - r)} 0`,
    `Q ${f(b)} 0 ${f(b)} ${f(r)}`,
    `L ${f(b)} ${f(b - r)}`,
    `Q ${f(b)} ${f(b)} ${f(b - r)} ${f(b)}`,
    `L ${f(r)} ${f(b)}`,
    `Q 0 ${f(b)} 0 ${f(b - r)}`,
    `L 0 ${f(r)}`,
  ].join(" ");
}

/** One continuous stroke for an internal horizontal divider (left → right). */
function buildInternalHorizontalStroke(
  y: number,
  rowAbove: number,
  topology: EdgeTopology,
): string {
  const parts: string[] = [`M 0 ${f(y)}`];

  for (let col = 0; col < 3; col++) {
    const cellId = cellAt(col, rowAbove);
    const kind = edgeShape(cellId, "down", topology);
    if (kind === "flat") {
      continue;
    }

    const segLeft = col * CELL;
    const segRight = col === 2 ? BOARD : (col + 1) * CELL;

    if (col > 0) {
      parts.push(`L ${f(segLeft)} ${f(y)}`);
    }
    parts.push(horizontalBumpArc(y, segLeft, segRight, kind, 1));
    parts.push(`L ${f(segRight)} ${f(y)}`);
  }

  return parts.join(" ");
}

/** One continuous stroke for an internal vertical divider (top → bottom). */
function buildInternalVerticalStroke(
  x: number,
  colLeft: number,
  topology: EdgeTopology,
): string {
  const parts: string[] = [`M ${f(x)} 0`];

  for (let row = 0; row < 3; row++) {
    const cellId = cellAt(colLeft, row);
    const kind = edgeShape(cellId, "right", topology);
    if (kind === "flat") {
      continue;
    }

    const segTop = row * CELL;
    const segBottom = row === 2 ? BOARD : (row + 1) * CELL;

    if (row > 0) {
      parts.push(`L ${f(x)} ${f(segTop)}`);
    }
    parts.push(verticalBumpArc(x, segTop, segBottom, kind, 1));
    parts.push(`L ${f(x)} ${f(segBottom)}`);
  }

  return parts.join(" ");
}

export function getBoardPiecePath(
  cellId: CellId,
  topology?: EdgeTopology | null,
): string {
  return buildFillPath(cellId, resolveEdgeTopology(topology));
}

export interface InteriorEdgeSegment {
  key: string;
  path: string;
  fromCellId: CellId;
  toCellId: CellId;
  connectionOnFrom: EdgeConnection;
}

function buildHorizontalSegmentPath(
  y: number,
  col: number,
  kind: EdgeConnection,
): string {
  const segLeft = col * CELL;
  const segRight = (col + 1) * CELL;
  return [
    `M ${f(segLeft)} ${f(y)}`,
    horizontalBumpArc(y, segLeft, segRight, kind, 1),
    `L ${f(segRight)} ${f(y)}`,
  ].join(" ");
}

function buildVerticalSegmentPath(
  x: number,
  row: number,
  kind: EdgeConnection,
): string {
  const segTop = row * CELL;
  const segBottom = (row + 1) * CELL;
  return [
    `M ${f(x)} ${f(segTop)}`,
    verticalBumpArc(x, segTop, segBottom, kind, 1),
    `L ${f(x)} ${f(segBottom)}`,
  ].join(" ");
}

/** One SVG path per interior shared edge (for correct/incorrect glow). */
export function getInteriorEdgeSegments(
  topology?: EdgeTopology | null,
): InteriorEdgeSegment[] {
  const edges = resolveEdgeTopology(topology);
  const segments: InteriorEdgeSegment[] = [];

  for (let rowAbove = 0; rowAbove < 2; rowAbove += 1) {
    const y = (rowAbove + 1) * CELL;
    for (let col = 0; col < 3; col += 1) {
      const fromCellId = cellAt(col, rowAbove);
      const toCellId = cellAt(col, rowAbove + 1);
      const kind = edgeShape(fromCellId, "down", edges);
      if (kind === "flat") {
        continue;
      }
      segments.push({
        key: `${fromCellId}->${toCellId}`,
        path: buildHorizontalSegmentPath(y, col, kind),
        fromCellId,
        toCellId,
        connectionOnFrom: kind,
      });
    }
  }

  for (let colLeft = 0; colLeft < 2; colLeft += 1) {
    const x = (colLeft + 1) * CELL;
    for (let row = 0; row < 3; row += 1) {
      const fromCellId = cellAt(colLeft, row);
      const toCellId = cellAt(colLeft + 1, row);
      const kind = edgeShape(fromCellId, "right", edges);
      if (kind === "flat") {
        continue;
      }
      segments.push({
        key: `${fromCellId}->${toCellId}`,
        path: buildVerticalSegmentPath(x, row, kind),
        fromCellId,
        toCellId,
        connectionOnFrom: kind,
      });
    }
  }

  return segments;
}

export function getBoardOutlinePaths(
  topology?: EdgeTopology | null,
): string[] {
  const edges = resolveEdgeTopology(topology);
  return [
    buildOuterPerimeterPath(),
    buildInternalHorizontalStroke(CELL, 0, edges),
    buildInternalHorizontalStroke(CELL * 2, 1, edges),
    buildInternalVerticalStroke(CELL, 0, edges),
    buildInternalVerticalStroke(CELL * 2, 1, edges),
  ];
}

/** Outer board frame only (interior edges rendered separately for status glow). */
export function getBoardOuterPath(): string {
  return buildOuterPerimeterPath();
}

export function cellContentInset(
  cellId: CellId,
  topology?: EdgeTopology | null,
): string {
  const edges = resolveEdgeTopology(topology);
  const inset = (direction: GridDirection): string =>
    edgeShape(cellId, direction, edges) === "flat" ? "14%" : "24%";
  return `${inset("up")} ${inset("right")} ${inset("down")} ${inset("left")}`;
}

export function labelInset(
  cellId: CellId,
  direction: GridDirection,
  topology?: EdgeTopology | null,
): string {
  const edges = resolveEdgeTopology(topology);
  return edgeShape(cellId, direction, edges) === "flat" ? "6%" : "14%";
}

/** Distance outside the board border for criterion labels (board units). */
export const SHELL_LABEL_OUTSET = 30;

export interface ShellLabelPlacement {
  cellId: CellId;
  direction: GridDirection;
  text: string;
  x: number;
  y: number;
}

const SHELL_LABEL_SIDES: Partial<Record<CellId, GridDirection[]>> = {
  "top-left": ["up", "left"],
  "top-middle": ["up"],
  "top-right": ["up", "right"],
  "middle-left": ["left"],
  "middle-right": ["right"],
  "bottom-left": ["down", "left"],
  "bottom-middle": ["down"],
  "bottom-right": ["down", "right"],
};

/** Criterion labels anchored to outer shell edges in board coordinates. */
export function getShellLabelPlacements(
  cells: Partial<Record<CellId, { labels?: string[] }>>,
): ShellLabelPlacement[] {
  const placements: ShellLabelPlacement[] = [];

  for (const cellId of ALL_CELL_IDS) {
    const sides = SHELL_LABEL_SIDES[cellId];
    if (!sides) {
      continue;
    }

    const labels = cells[cellId]?.labels ?? [];
    const { x0, y0, x1, y1 } = cellBounds(cellId);
    const cx = (x0 + x1) / 2;
    const cy = (y0 + y1) / 2;

    sides.forEach((direction, index) => {
      const text = labels[index];
      if (!text) {
        return;
      }

      let x = cx;
      let y = cy;

      switch (direction) {
        case "up":
          y = -SHELL_LABEL_OUTSET;
          break;
        case "down":
          y = BOARD + SHELL_LABEL_OUTSET;
          break;
        case "left":
          x = -SHELL_LABEL_OUTSET;
          break;
        case "right":
          x = BOARD + SHELL_LABEL_OUTSET;
          break;
      }

      placements.push({ cellId, direction, text, x, y });
    });
  }

  return placements;
}
