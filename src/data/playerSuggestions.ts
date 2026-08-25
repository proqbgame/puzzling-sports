import { formatPlayerNameInput, normalizePlayerName } from "./normalizeName.js";

export interface PlayerSuggestion {
  playerId: string;
  playerName: string;
  firstYear: number;
  lastYear: number;
}

type Rank = 0 | 1 | 2;

function matchRank(normalizedName: string, query: string): Rank | null {
  if (normalizedName.startsWith(query)) {
    return 0;
  }
  const words = normalizedName.split(" ");
  if (words.some((word) => word.startsWith(query))) {
    return 1;
  }
  if (normalizedName.includes(query)) {
    return 2;
  }
  return null;
}

function seasonStartYear(season: string): number {
  return Number(season.slice(0, 4));
}

/**
 * Ranked substring search over player bios (HoopGrids-style typeahead).
 * Prefers full-name prefix, then word prefix, then substring.
 */
export function rankPlayerNameMatches<T extends { id: string; name: string }>(
  bios: Iterable<T>,
  query: string,
  getSeasons: (playerId: string) => readonly { season: string }[],
  limit = 8,
): PlayerSuggestion[] {
  const normalizedQuery = normalizePlayerName(formatPlayerNameInput(query));
  if (normalizedQuery.length < 2) {
    return [];
  }

  const scored: Array<PlayerSuggestion & { rank: Rank }> = [];

  for (const bio of bios) {
    const normalizedName = normalizePlayerName(bio.name);
    const rank = matchRank(normalizedName, normalizedQuery);
    if (rank === null) {
      continue;
    }

    const seasons = getSeasons(bio.id);
    if (seasons.length === 0) {
      continue;
    }

    scored.push({
      playerId: bio.id,
      playerName: bio.name,
      firstYear: seasonStartYear(seasons[0].season),
      lastYear: seasonStartYear(seasons[seasons.length - 1].season),
      rank,
    });
  }

  scored.sort((a, b) => {
    if (a.rank !== b.rank) {
      return a.rank - b.rank;
    }
    return a.playerName.localeCompare(b.playerName);
  });

  return scored.slice(0, limit).map(({ rank: _rank, ...suggestion }) => suggestion);
}
