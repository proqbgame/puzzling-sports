/**
 * TypeScript types matching NFL data-pipeline output (QB + WR + RB).
 * Use when building the game rules engine.
 */

export type NflPosition = "QB" | "WR" | "RB";

export type NflHonorKey = "mvp" | "proBowl" | "allPro" | "sbMvp" | "champion";

export type NflSeasonHonors = Record<NflHonorKey, boolean>;

export interface NflPlayerBio {
  id: string;
  name: string;
  /** ESPN athlete id for headshots; null when nflverse has no mapping. */
  espnId: string | null;
  college: string | null;
  draftPick: number | null;
  draftRound: number | null;
  draftYear: number | null;
  undrafted: boolean;
  seasonsPlayed: number;
  everProBowl: boolean;
  everMvp: boolean;
  everAllPro: boolean;
  everSbMvp: boolean;
  everChampion: boolean;
}

export interface NflPlayerSeason {
  playerId: string;
  /** NFL season year label, e.g. "2023" */
  season: string;
  team: string;
  /** Roster/stat position for this season row */
  position: NflPosition;
  games: number;
  passYds: number;
  passTd: number;
  interceptions: number;
  completions: number;
  attempts: number;
  rushYds: number;
  rushTd: number;
  receptions?: number;
  targets?: number;
  recYds?: number;
  recTd?: number;
  passYpg?: number;
  rushYpg?: number;
  recYpg?: number;
  completionPct?: number;
  honors: NflSeasonHonors;
}

export type NflPlayerBioMap = Record<string, NflPlayerBio>;

export interface NflMetadata {
  sport: "nfl";
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
    superBowlEraFrom: string;
    awardsNotYetLoaded?: boolean;
    awardsSources?: string;
    allProDefinition?: string;
    proBowlDefinition?: string;
    championDefinition?: string;
    multiTeamSeasons?: string;
    positionScope?: string;
  };
  generatedAt: string;
}
