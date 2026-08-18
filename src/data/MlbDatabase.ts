import type {
  MlbMetadata,
  MlbPosition,
  PlayerBio,
  PlayerBioMap,
  PlayerSeason,
  PlayerSeasonAssignment,
} from "../types/mlb.js";
import { formatPlayerNameInput, normalizePlayerName } from "./normalizeName.js";

function seasonKey(playerId: string, season: string, position: MlbPosition): string {
  return `${playerId}|${season}|${position}`;
}

export class MlbDatabase {
  readonly metadata: MlbMetadata;
  readonly bios: PlayerBioMap;
  readonly seasons: readonly PlayerSeason[];

  private readonly biosById = new Map<string, PlayerBio>();
  private readonly idsByNormalizedName = new Map<string, string[]>();
  private readonly seasonsByPlayerId = new Map<string, PlayerSeason[]>();
  private readonly seasonByPlayerYearPosition = new Map<string, PlayerSeason>();
  private allAssignmentsCache: readonly PlayerSeasonAssignment[] | undefined;

  constructor(
    metadata: MlbMetadata,
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
      this.seasonByPlayerYearPosition.set(
        seasonKey(row.playerId, row.season, row.position),
        row,
      );
    }

    for (const rows of this.seasonsByPlayerId.values()) {
      rows.sort((a, b) => a.season.localeCompare(b.season));
    }
  }

  getBioById(playerId: string): PlayerBio | undefined {
    return this.biosById.get(playerId);
  }

  findPlayerIdsByName(name: string): string[] {
    const formatted = formatPlayerNameInput(name);
    return [...(this.idsByNormalizedName.get(normalizePlayerName(formatted)) ?? [])];
  }

  getSeason(
    playerId: string,
    season: string,
    position?: MlbPosition,
  ): PlayerSeason | undefined {
    if (position) {
      return this.seasonByPlayerYearPosition.get(
        seasonKey(playerId, season, position),
      );
    }
    return (
      this.seasonByPlayerYearPosition.get(seasonKey(playerId, season, "H")) ??
      this.seasonByPlayerYearPosition.get(seasonKey(playerId, season, "P"))
    );
  }

  getSeasonsForPlayer(
    playerId: string,
    position?: MlbPosition,
  ): readonly PlayerSeason[] {
    const rows = this.seasonsByPlayerId.get(playerId) ?? [];
    if (!position) {
      return rows;
    }
    return rows.filter((row) => row.position === position);
  }

  normalizeSeasonInput(input: string): string | undefined {
    const trimmed = input.trim();

    const yearOnly = trimmed.match(/^(\d{4})$/);
    if (yearOnly) {
      const candidate = yearOnly[1];
      return this.metadata.seasons.includes(candidate) ? candidate : undefined;
    }

    const fullMatch = trimmed.match(/^(\d{4})-(\d{2}|\d{4})$/);
    if (fullMatch) {
      const startYear = fullMatch[1];
      return this.metadata.seasons.includes(startYear) ? startYear : undefined;
    }

    return undefined;
  }

  getAssignment(
    playerId: string,
    season: string,
    position?: MlbPosition,
  ): PlayerSeasonAssignment | undefined {
    const bio = this.getBioById(playerId);
    const stats = this.getSeason(playerId, season, position);
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

  getAllAssignments(): readonly PlayerSeasonAssignment[] {
    if (this.allAssignmentsCache) {
      return this.allAssignmentsCache;
    }

    const assignments: PlayerSeasonAssignment[] = [];
    for (const row of this.seasons) {
      const assignment = this.getAssignment(row.playerId, row.season, row.position);
      if (assignment) {
        assignments.push(assignment);
      }
    }

    this.allAssignmentsCache = assignments;
    return assignments;
  }

  getHitterAssignments(): readonly PlayerSeasonAssignment[] {
    return this.getAllAssignments().filter(
      (assignment) => assignment.stats.position === "H",
    );
  }

  getPitcherAssignments(): readonly PlayerSeasonAssignment[] {
    return this.getAllAssignments().filter(
      (assignment) => assignment.stats.position === "P",
    );
  }
}
