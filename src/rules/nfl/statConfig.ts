/**

 * NFL interior/edge stat layouts (mirrors NBA cross topology).

 *

 * QB:

 *   Up: Pass yards | Down: Pass TD | Left: Comp % | Right: INT

 *

 * WR:

 *   Up: Rec yards | Down: Rec TD | Left: Receptions | Right: Targets

 *

 * RB:

 *   Up: Rush yards | Down: Rush TD | Left: Rec yards | Right: Rec TD

 */



import type { CellPosition, GridDirection } from "../grid.js";



export type NflQbStatKey = "passYds" | "passTd" | "compPct" | "interceptions";

export type NflWrStatKey = "recYds" | "recTd" | "receptions" | "targets";

export type NflRbStatKey = "rushYds" | "rushTd" | "recYds" | "recTd";

export type NflStatKey = NflQbStatKey | NflWrStatKey | NflRbStatKey;

export type NflStatPosition = "qb" | "wr" | "rb";



export interface SportStatConfig {

  sport: "nfl-qb" | "nfl-wr" | "nfl-rb";

  byDirection: Record<GridDirection, NflStatKey>;

  labels: Record<string, string>;

}



export const NFL_QB_STAT_CONFIG: SportStatConfig = {

  sport: "nfl-qb",

  byDirection: {

    up: "passYds",

    down: "passTd",

    left: "compPct",

    right: "interceptions",

  },

  labels: {

    passYds: "PASS YDS",

    passTd: "PASS TD",

    compPct: "%",

    interceptions: "INT",

  },

};



export const NFL_WR_STAT_CONFIG: SportStatConfig = {

  sport: "nfl-wr",

  byDirection: {

    up: "recYds",

    down: "recTd",

    left: "receptions",

    right: "targets",

  },

  labels: {

    recYds: "REC YDS",

    recTd: "REC TD",

    receptions: "REC",

    targets: "TGT",

  },

};



export const NFL_RB_STAT_CONFIG: SportStatConfig = {

  sport: "nfl-rb",

  byDirection: {

    up: "rushYds",

    down: "rushTd",

    left: "recYds",

    right: "recTd",

  },

  labels: {

    rushYds: "RUSH YDS",

    rushTd: "RUSH TD",

    recYds: "REC YDS",

    recTd: "REC TD",

  },

};



export function normalizeNflStatPosition(

  position: string | undefined,

): NflStatPosition {

  const value = (position ?? "qb").toString().toLowerCase();

  if (value === "wr") {

    return "wr";

  }

  if (value === "rb") {

    return "rb";

  }

  return "qb";

}



export function getStatConfig(position?: string): SportStatConfig {

  const normalized = normalizeNflStatPosition(position);

  if (normalized === "wr") {

    return NFL_WR_STAT_CONFIG;

  }

  if (normalized === "rb") {

    return NFL_RB_STAT_CONFIG;

  }

  return NFL_QB_STAT_CONFIG;

}



/**

 * Stat used on the shared edge between two adjacent cells.

 */

export function statForEdge(

  a: CellPosition,

  b: CellPosition,

  position?: string,

): NflStatKey {

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



export function statLabel(stat: NflStatKey, position?: string): string {

  const config = getStatConfig(position);

  return config.labels[stat] ?? stat;

}

