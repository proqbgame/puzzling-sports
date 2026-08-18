/**
 * MLB interior/edge stat layouts.
 *
 * Hitter: Up HR | Down RBI | Left AVG | Right SB
 * Pitcher: Up SO | Down W | Left IP | Right ERA
 *
 * ERA is lower-is-better; tab/socket comparisons are inverted for that edge.
 */

import type { CellPosition, EdgeConnection, GridDirection } from "../grid.js";

export type MlbHitterStatKey = "hr" | "rbi" | "avg" | "sb";
export type MlbPitcherStatKey = "so" | "w" | "ip" | "era";
export type MlbStatKey = MlbHitterStatKey | MlbPitcherStatKey;
export type MlbStatPosition = "hitter" | "pitcher";

export interface SportStatConfig {
  sport: "mlb-hitter" | "mlb-pitcher";
  byDirection: Record<GridDirection, MlbStatKey>;
  labels: Record<string, string>;
}

export const MLB_HITTER_STAT_CONFIG: SportStatConfig = {
  sport: "mlb-hitter",
  byDirection: {
    up: "hr",
    down: "rbi",
    left: "avg",
    right: "sb",
  },
  labels: {
    hr: "HR",
    rbi: "RBI",
    avg: "AVG",
    sb: "SB",
  },
};

export const MLB_PITCHER_STAT_CONFIG: SportStatConfig = {
  sport: "mlb-pitcher",
  byDirection: {
    up: "so",
    down: "w",
    left: "ip",
    right: "era",
  },
  labels: {
    so: "SO",
    w: "W",
    ip: "IP",
    era: "ERA",
  },
};

export function normalizeMlbStatPosition(
  position: string | undefined,
): MlbStatPosition {
  const value = (position ?? "hitter").toString().toLowerCase();
  if (value === "p" || value === "pitcher") {
    return "pitcher";
  }
  return "hitter";
}

export function getStatConfig(position?: string): SportStatConfig {
  return normalizeMlbStatPosition(position) === "pitcher"
    ? MLB_PITCHER_STAT_CONFIG
    : MLB_HITTER_STAT_CONFIG;
}

export function statForEdge(
  a: CellPosition,
  b: CellPosition,
  position?: string,
): MlbStatKey {
  const config = getStatConfig(position);

  if (a.row !== b.row) {
    const upper = a.row < b.row ? a : b;
    return upper.row === 0 ? config.byDirection.up : config.byDirection.down;
  }

  if (a.col !== b.col) {
    const left = a.col < b.col ? a : b;
    return left.col === 0 ? config.byDirection.left : config.byDirection.right;
  }

  throw new Error("Cells are not adjacent");
}

export function statLabel(stat: MlbStatKey, position?: string): string {
  const config = getStatConfig(position);
  return config.labels[stat] ?? stat;
}

export function isLowerBetterStat(stat: MlbStatKey): boolean {
  return stat === "era";
}

export function edgeOpForConnection(
  connection: EdgeConnection,
  stat: MlbStatKey,
): "≥" | "≤" {
  const tabMeansGreater = !isLowerBetterStat(stat);
  if (connection === "tab") {
    return tabMeansGreater ? "≥" : "≤";
  }
  return tabMeansGreater ? "≤" : "≥";
}

export function valueSatisfiesEdge(
  value: number,
  neighborValue: number,
  connection: EdgeConnection,
  stat: MlbStatKey,
): boolean {
  if (isLowerBetterStat(stat)) {
    return connection === "tab"
      ? value <= neighborValue
      : value >= neighborValue;
  }
  return connection === "tab" ? value >= neighborValue : value <= neighborValue;
}
