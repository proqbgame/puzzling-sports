/**
 * TypeScript types matching data-pipeline output.
 * Use when building the game rules engine.
 */

export type HonorKey =
  | "mvp"
  | "allStar"
  | "allNba"
  | "allDefensive"
  | "finalsMvp"
  | "dpoy"
  | "sixthMan"
  | "mostImproved"
  | "champion";

export type SeasonHonors = Record<HonorKey, boolean>;

export interface PlayerBio {
  id: string;
  name: string;
  college: string | null;
  draftPick: number | null;
  draftRound: number | null;
  draftYear: number | null;
  undrafted: boolean;
  seasonsPlayed: number;
  everAllStar: boolean;
  everMvp: boolean;
  everChampion: boolean;
  everDpoy: boolean;
  everSixthMan: boolean;
  everMostImproved: boolean;
  everFinalsMvp: boolean;
  everAllNba: boolean;
  everAllDefensive: boolean;
}

export interface PlayerSeason {
  playerId: string;
  season: string;
  team: string;
  games: number;
  ppg: number;
  rpg: number;
  apg: number;
  blk: number;
  honors: SeasonHonors;
}

export type PlayerBioMap = Record<string, PlayerBio>;

export interface NbaMetadata {
  sport: "nba";
  firstSeasonYear: number;
  lastSeasonYear: number;
  seasonCount: number;
  historicalSeasonCount?: number;
  modernSeasonCount?: number;
  playerCount: number;
  seasonRowCount: number;
  seasons: string[];
  historicalSeasons?: string[];
  modernSeasons?: string[];
  statsNotes?: {
    modernBulkStatsFrom: string;
    historicalStatsSource: string;
    blocksTrackedFrom: string;
    blocksBefore1974MayBeZero: boolean;
  };
  generatedAt: string;
}
