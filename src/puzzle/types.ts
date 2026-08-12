import type { Criterion } from "../rules/criteria.js";
import type { CellId } from "../rules/grid.js";
import type { EdgeTopology } from "../rules/topology.js";
import type { PuzzleDefinition } from "../rules/validateGuess.js";
import type { PlayerSeasonAssignment } from "../types/nba.js";

export interface DailyPuzzleBase {
  playerId: string;
  playerName: string;
  season: string;
  stats: {
    ppg: number;
    rpg: number;
    apg: number;
    blk: number;
  };
}

export interface DailyPuzzleCell {
  criteria: Criterion[];
  labels: string[];
}

/** Public puzzle file — no solution included. */
export interface DailyPuzzleFile {
  version: 1;
  sport: "nba";
  date: string;
  base: DailyPuzzleBase;
  cells: Partial<Record<CellId, DailyPuzzleCell>>;
  /** Tab/socket layout for this day (legacy files omit → standard layout). */
  edges?: EdgeTopology;
}

export interface DailyPuzzleSolutionFile {
  date: string;
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

export interface GeneratedDailyPuzzle {
  puzzle: DailyPuzzleFile;
  definition: PuzzleDefinition;
  solution: Partial<Record<CellId, PlayerSeasonAssignment>>;
}

export function toDailyPuzzleBase(
  assignment: PlayerSeasonAssignment,
): DailyPuzzleBase {
  return {
    playerId: assignment.playerId,
    playerName: assignment.playerName,
    season: assignment.season,
    stats: {
      ppg: assignment.stats.ppg,
      rpg: assignment.stats.rpg,
      apg: assignment.stats.apg,
      blk: assignment.stats.blk,
    },
  };
}
