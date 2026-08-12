import { NflDatabase } from "./NflDatabase.js";
import type {
  NflMetadata,
  PlayerBioMap,
  PlayerSeason,
  RawPlayerSeason,
} from "../types/nfl.js";

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

/** Ensure compPct exists; prefer stored value, else completions/attempts. */
export function normalizePlayerSeason(row: RawPlayerSeason): PlayerSeason {
  const stored = row.compPct ?? row.completionPct;
  const computed =
    row.attempts > 0 ? round1((row.completions / row.attempts) * 100) : 0;
  const compPct = stored !== undefined && Number.isFinite(stored) ? stored : computed;

  return {
    playerId: row.playerId,
    season: row.season,
    team: row.team,
    position: row.position ?? "QB",
    games: row.games,
    passYds: row.passYds,
    passTd: row.passTd,
    interceptions: row.interceptions,
    completions: row.completions,
    attempts: row.attempts,
    compPct,
    rushYds: row.rushYds,
    rushTd: row.rushTd,
    receptions: row.receptions ?? 0,
    targets: row.targets ?? 0,
    recYds: row.recYds ?? 0,
    recTd: row.recTd ?? 0,
    passYpg: row.passYpg,
    rushYpg: row.rushYpg,
    recYpg: row.recYpg,
    honors: row.honors,
  };
}

export function loadNflDataFromJson(
  bios: PlayerBioMap,
  seasons: RawPlayerSeason[],
  metadata: NflMetadata,
): NflDatabase {
  return new NflDatabase(
    metadata,
    bios,
    seasons.map(normalizePlayerSeason),
  );
}
