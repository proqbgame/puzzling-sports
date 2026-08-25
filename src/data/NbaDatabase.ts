import type {
  NbaMetadata,
  PlayerBio,
  PlayerBioMap,
  PlayerSeason,
  PlayerSeasonAssignment,
} from "../types/nba.js";
import { formatPlayerNameInput, normalizePlayerName } from "./normalizeName.js";
import {
  rankPlayerNameMatches,
  type PlayerSuggestion,
} from "./playerSuggestions.js";

function seasonKey(playerId: string, season: string): string {
  return `${playerId}|${season}`;
}

export class NbaDatabase {
  readonly metadata: NbaMetadata;
  readonly bios: PlayerBioMap;
  readonly seasons: readonly PlayerSeason[];

  private readonly biosById = new Map<string, PlayerBio>();
  private readonly idsByNormalizedName = new Map<string, string[]>();
  private readonly seasonsByPlayerId = new Map<string, PlayerSeason[]>();
  private readonly seasonByPlayerAndYear = new Map<string, PlayerSeason>();
  private allAssignmentsCache: readonly PlayerSeasonAssignment[] | undefined;

  constructor(
    metadata: NbaMetadata,
    bios: PlayerBioMap,
    seasons: PlayerSeason[],
  ) {
    this.metadata = metadata;
    this.bios = bios;
    this.seasons = seasons;

    for (const bio of Object.values(bios)) {
      this.biosById.set(bio.id, bio);

      const key = normalizePlayerName(bio.name);
      const existing = this.idsByNormalizedName.get(key) ?? [];
      if (!existing.includes(bio.id)) {
        existing.push(bio.id);
        this.idsByNormalizedName.set(key, existing);
      }
    }

    for (const row of seasons) {
      const playerSeasons = this.seasonsByPlayerId.get(row.playerId) ?? [];
      playerSeasons.push(row);
      this.seasonsByPlayerId.set(row.playerId, playerSeasons);
      this.seasonByPlayerAndYear.set(seasonKey(row.playerId, row.season), row);
    }

    for (const rows of this.seasonsByPlayerId.values()) {
      rows.sort((a, b) => a.season.localeCompare(b.season));
    }
  }

  getBioById(playerId: string): PlayerBio | undefined {
    return this.biosById.get(playerId);
  }

  /** Exact normalized name match (after formatting "Last, First" inputs). */
  findPlayerIdsByName(name: string): string[] {
    const formatted = formatPlayerNameInput(name);
    return [...(this.idsByNormalizedName.get(normalizePlayerName(formatted)) ?? [])];
  }

  findBiosByName(name: string): PlayerBio[] {
    return this.findPlayerIdsByName(name)
      .map((id) => this.getBioById(id))
      .filter((bio): bio is PlayerBio => bio !== undefined);
  }

  /** Typeahead suggestions as the user types a player name. */
  searchPlayersByName(query: string, limit = 8): PlayerSuggestion[] {
    return rankPlayerNameMatches(
      this.biosById.values(),
      query,
      (playerId) => this.getSeasonsForPlayer(playerId),
      limit,
    );
  }

  getSeason(playerId: string, season: string): PlayerSeason | undefined {
    return this.seasonByPlayerAndYear.get(seasonKey(playerId, season));
  }

  getSeasonsForPlayer(playerId: string): readonly PlayerSeason[] {
    return this.seasonsByPlayerId.get(playerId) ?? [];
  }

  /**
   * Normalize season input like "2023", "2023-24", or "2023-2024".
   */
  normalizeSeasonInput(input: string): string | undefined {
    const trimmed = input.trim();

    const fullMatch = trimmed.match(/^(\d{4})-(\d{2}|\d{4})$/);
    if (fullMatch) {
      const startYear = fullMatch[1];
      const endPart = fullMatch[2];
      const endSuffix = endPart.length === 2 ? endPart : endPart.slice(-2);
      const candidate = `${startYear}-${endSuffix}`;
      return this.metadata.seasons.includes(candidate) ? candidate : undefined;
    }

    const yearOnly = trimmed.match(/^(\d{4})$/);
    if (yearOnly) {
      const startYear = Number(yearOnly[1]);
      const candidate = `${startYear}-${String(startYear + 1).slice(-2)}`;
      return this.metadata.seasons.includes(candidate) ? candidate : undefined;
    }

    return undefined;
  }

  /** Build a player+season assignment if both exist. */
  getAssignment(playerId: string, season: string): PlayerSeasonAssignment | undefined {
    const bio = this.getBioById(playerId);
    const stats = this.getSeason(playerId, season);
    if (!bio || !stats) {
      return undefined;
    }

    return {
      playerId,
      playerName: bio.name,
      season,
      bio,
      stats,
    };
  }

  getAssignmentByName(name: string, season: string): PlayerSeasonAssignment | undefined {
    const ids = this.findPlayerIdsByName(name);
    if (ids.length !== 1) {
      return undefined;
    }
    return this.getAssignment(ids[0], season);
  }

  /** All player-season assignments, built once and cached. */
  getAllAssignments(): readonly PlayerSeasonAssignment[] {
    if (this.allAssignmentsCache) {
      return this.allAssignmentsCache;
    }

    const assignments: PlayerSeasonAssignment[] = [];

    for (const row of this.seasons) {
      const assignment = this.getAssignment(row.playerId, row.season);
      if (assignment) {
        assignments.push(assignment);
      }
    }

    this.allAssignmentsCache = assignments;
    return assignments;
  }
}
