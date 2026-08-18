import type { Criterion } from "../../rules/mlb/criteria.js";
import type { CellId } from "../../rules/grid.js";
import type { EdgeTopology } from "../../rules/topology.js";
import type { PuzzleDefinition } from "../../rules/mlb/validateGuess.js";
import type { MlbPosition, PlayerSeasonAssignment } from "../../types/mlb.js";

export type MlbPuzzlePosition = "pitcher" | "hitter";

export type DailyMlbHitterBaseStats = {
  hr: number;
  rbi: number;
  avg: number;
  sb: number;
};

export type DailyMlbPitcherBaseStats = {
  so: number;
  w: number;
  ip: number;
  era: number;
};

export type DailyMlbPuzzleBaseStats =
  | DailyMlbHitterBaseStats
  | DailyMlbPitcherBaseStats;

export interface DailyMlbPuzzleBase {
  playerId: string;
  playerName: string;
  season: string;
  stats: DailyMlbPuzzleBaseStats;
}

export interface DailyMlbPuzzleCell {
  criteria: Criterion[];
  labels: string[];
}

export interface DailyMlbPuzzleFile {
  version: 1;
  sport: "mlb";
  position: MlbPuzzlePosition;
  date: string;
  base: DailyMlbPuzzleBase;
  cells: Partial<Record<CellId, DailyMlbPuzzleCell>>;
  edges?: EdgeTopology;
}

export interface DailyMlbPuzzleSolutionFile {
  date: string;
  sport: "mlb";
  position: MlbPuzzlePosition;
  solution: Partial<
    Record<CellId, { playerId: string; playerName: string; season: string }>
  >;
}

export interface GeneratedDailyMlbPuzzle {
  puzzle: DailyMlbPuzzleFile;
  definition: PuzzleDefinition;
  solution: Partial<Record<CellId, PlayerSeasonAssignment>>;
}

export function mlbRowPosition(position: MlbPuzzlePosition): MlbPosition {
  return position === "pitcher" ? "P" : "H";
}

export function toDailyMlbPuzzleBase(
  assignment: PlayerSeasonAssignment,
): DailyMlbPuzzleBase {
  if (assignment.stats.position === "P") {
    return {
      playerId: assignment.playerId,
      playerName: assignment.playerName,
      season: assignment.season,
      stats: {
        so: assignment.stats.so,
        w: assignment.stats.w,
        ip: assignment.stats.ip,
        era: assignment.stats.era,
      },
    };
  }

  return {
    playerId: assignment.playerId,
    playerName: assignment.playerName,
    season: assignment.season,
    stats: {
      hr: assignment.stats.hr,
      rbi: assignment.stats.rbi,
      avg: assignment.stats.avg,
      sb: assignment.stats.sb,
    },
  };
}
