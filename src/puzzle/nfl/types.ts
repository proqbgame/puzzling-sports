import type { Criterion } from "../../rules/nfl/criteria.js";

import type { CellId } from "../../rules/grid.js";

import type { EdgeTopology } from "../../rules/topology.js";

import type { PuzzleDefinition } from "../../rules/nfl/validateGuess.js";

import type { PlayerSeasonAssignment } from "../../types/nfl.js";



export type NflPuzzlePosition = "qb" | "wr" | "rb";



export type DailyNflQbBaseStats = {

  passYds: number;

  passTd: number;

  compPct: number;

  interceptions: number;

};



export type DailyNflWrBaseStats = {

  recYds: number;

  recTd: number;

  receptions: number;

  targets: number;

};



export type DailyNflRbBaseStats = {

  rushYds: number;

  rushTd: number;

  recYds: number;

  recTd: number;

};



export type DailyNflPuzzleBaseStats =

  | DailyNflQbBaseStats

  | DailyNflWrBaseStats

  | DailyNflRbBaseStats;



export interface DailyNflPuzzleBase {

  playerId: string;

  playerName: string;

  season: string;

  stats: DailyNflPuzzleBaseStats;

}



export interface DailyNflPuzzleCell {

  criteria: Criterion[];

  labels: string[];

}



/** Public NFL puzzle file — no solution included. */

export interface DailyNflPuzzleFile {

  version: 1;

  sport: "nfl";

  position: NflPuzzlePosition;

  date: string;

  base: DailyNflPuzzleBase;

  cells: Partial<Record<CellId, DailyNflPuzzleCell>>;

  /** Tab/socket layout for this day (legacy files omit → standard layout). */

  edges?: EdgeTopology;

}



export interface DailyNflPuzzleSolutionFile {

  date: string;

  sport: "nfl";

  position: NflPuzzlePosition;

  solution: Partial<

    Record<

      CellId,

      {

        playerId: string;

        playerName: string;

        season: string;

      }

    >

  >;

}



export interface GeneratedDailyNflPuzzle {

  puzzle: DailyNflPuzzleFile;

  definition: PuzzleDefinition;

  solution: Partial<Record<CellId, PlayerSeasonAssignment>>;

}



export function toDailyNflPuzzleBase(

  assignment: PlayerSeasonAssignment,

): DailyNflPuzzleBase {

  if (assignment.stats.position === "WR") {

    return {

      playerId: assignment.playerId,

      playerName: assignment.playerName,

      season: assignment.season,

      stats: {

        recYds: assignment.stats.recYds,

        recTd: assignment.stats.recTd,

        receptions: assignment.stats.receptions,

        targets: assignment.stats.targets,

      },

    };

  }



  if (assignment.stats.position === "RB") {

    return {

      playerId: assignment.playerId,

      playerName: assignment.playerName,

      season: assignment.season,

      stats: {

        rushYds: assignment.stats.rushYds ?? 0,

        rushTd: assignment.stats.rushTd ?? 0,

        recYds: assignment.stats.recYds,

        recTd: assignment.stats.recTd,

      },

    };

  }



  return {

    playerId: assignment.playerId,

    playerName: assignment.playerName,

    season: assignment.season,

    stats: {

      passYds: assignment.stats.passYds,

      passTd: assignment.stats.passTd,

      compPct: assignment.stats.compPct,

      interceptions: assignment.stats.interceptions,

    },

  };

}

