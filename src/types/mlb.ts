/**
 * Types matching MLB data-pipeline JSON output (pitcher + hitter app layer).
 */

export type MlbPosition = "P" | "H";

export type HonorKey =
  | "mvp"
  | "allStar"
  | "cyYoung"
  | "silverSlugger"
  | "goldGlove"
  | "wsMvp"
  | "champion";

export type SeasonHonors = Record<HonorKey, boolean>;

export interface PlayerBio {
  id: string;
  name: string;
  /** MLB Advanced Media id for official headshots. */
  mlbamId: string | null;
  espnId: string | null;
  college: string | null;
  draftPick: number | null;
  draftRound: number | null;
  draftYear: number | null;
  undrafted: boolean;
  seasonsPlayed: number;
  everMvp: boolean;
  everAllStar: boolean;
  everCyYoung: boolean;
  everSilverSlugger: boolean;
  everGoldGlove: boolean;
  everWsMvp: boolean;
  everChampion: boolean;
}

export interface PlayerSeason {
  playerId: string;
  /** MLB season year label, e.g. "2019" */
  season: string;
  team: string;
  position: MlbPosition;
  games: number;
  ab: number;
  hits: number;
  hr: number;
  rbi: number;
  sb: number;
  /** Batting average on 0–1 scale, e.g. 0.312 */
  avg: number;
  so: number;
  w: number;
  ip: number;
  /** Earned run average, e.g. 2.31. Lower is better. */
  era: number;
  honors: SeasonHonors;
}

export type PlayerBioMap = Record<string, PlayerBio>;

export interface MlbMetadata {
  sport: "mlb";
  firstSeasonYear: number;
  lastSeasonYear: number;
  seasonCount: number;
  playerCount: number;
  seasonRowCount: number;
  seasons: string[];
  hitterSeasonCount?: number;
  pitcherSeasonCount?: number;
  statsNotes?: Record<string, string>;
  generatedAt: string;
}

export interface PlayerSeasonAssignment {
  playerId: string;
  playerName: string;
  season: string;
  bio: PlayerBio;
  stats: PlayerSeason;
}
