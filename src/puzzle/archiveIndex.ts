/**
 * Puzzle archive index — lists available daily dates per grid.
 * Written to public/data/puzzles/index.json by sync / generate:daily.
 */

export type PuzzleGridKey = "nba" | "nfl-qb" | "nfl-wr" | "nfl-rb";

export interface PuzzleArchiveIndex {
  version: 1;
  timezone: "America/New_York";
  generatedAt: string;
  grids: Record<PuzzleGridKey, string[]>;
}

export function emptyPuzzleArchiveIndex(
  generatedAt: string = new Date().toISOString(),
): PuzzleArchiveIndex {
  return {
    version: 1,
    timezone: "America/New_York",
    generatedAt,
    grids: {
      nba: [],
      "nfl-qb": [],
      "nfl-wr": [],
      "nfl-rb": [],
    },
  };
}

export function gridKeyForSport(
  sport: "nba" | "nfl",
  position?: "qb" | "wr" | "rb",
): PuzzleGridKey {
  if (sport === "nba") {
    return "nba";
  }
  return `nfl-${position ?? "qb"}`;
}
