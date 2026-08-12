/**
 * Types matching NFL data-pipeline JSON output (QB + WR + RB app layer).
 *
 * Pipeline may store completionPct; the app normalizes to compPct.
 */

export type NflPosition = "QB" | "WR" | "RB";

export type HonorKey =
  | "mvp"
  | "proBowl"
  | "allPro"
  | "sbMvp"
  | "champion";

export type SeasonHonors = Record<HonorKey, boolean>;

export interface PlayerBio {
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

export interface PlayerSeason {
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
  /** Completion percentage (0–100 scale). */
  compPct: number;
  rushYds?: number;
  rushTd?: number;
  receptions: number;
  targets: number;
  recYds: number;
  recTd: number;
  passYpg?: number;
  rushYpg?: number;
  recYpg?: number;
  honors: SeasonHonors;
}

/** Shape as stored in data/nfl/seasons.json before app normalization. */
export interface RawPlayerSeason {
  playerId: string;
  season: string;
  team: string;
  position?: NflPosition;
  games: number;
  passYds: number;
  passTd: number;
  interceptions: number;
  completions: number;
  attempts: number;
  rushYds?: number;
  rushTd?: number;
  receptions?: number;
  targets?: number;
  recYds?: number;
  recTd?: number;
  passYpg?: number;
  rushYpg?: number;
  recYpg?: number;
  completionPct?: number;
  compPct?: number;
  honors: SeasonHonors;
}

export type PlayerBioMap = Record<string, PlayerBio>;

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

/** A player plus the season row used for a puzzle cell. */
export interface PlayerSeasonAssignment {
  playerId: string;
  playerName: string;
  season: string;
  bio: PlayerBio;
  stats: PlayerSeason;
}
