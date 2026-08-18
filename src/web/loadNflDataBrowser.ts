import { loadNflDataFromJson } from "../data/loadNflDataFromJson.js";
import type { NflDatabase } from "../data/NflDatabase.js";
import type {
  DailyNflPuzzleFile,
  NflPuzzlePosition,
} from "../puzzle/nfl/types.js";
import type {
  NflMetadata,
  PlayerBioMap,
  RawPlayerSeason,
} from "../types/nfl.js";

const NFL_DATA_BASE = "/data/nfl";

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load ${url} (${response.status})`);
  }
  return response.json() as Promise<T>;
}

export async function loadNflDataBrowser(): Promise<NflDatabase> {
  const [bios, seasons, metadata] = await Promise.all([
    fetchJson<PlayerBioMap>(`${NFL_DATA_BASE}/bios.json`),
    fetchJson<RawPlayerSeason[]>(`${NFL_DATA_BASE}/seasons.json`),
    fetchJson<NflMetadata>(`${NFL_DATA_BASE}/metadata.json`),
  ]);

  return loadNflDataFromJson(bios, seasons, metadata);
}

export async function loadDailyNflPuzzleBrowser(
  date: string,
  position: NflPuzzlePosition = "qb",
): Promise<DailyNflPuzzleFile> {
  const url = `/data/puzzles/nfl/${position}/${date}.json`;
  const response = await fetch(url);
  const contentType = response.headers.get("content-type") ?? "";

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error(
        `No NFL ${position.toUpperCase()} puzzle found for ${date}. Generate one with \`npm run generate:nfl-puzzle -- ${date} ${position}\`, then \`npm run sync:data\`. Or try: ?sport=nfl&position=${position}&date=${date}`,
      );
    }
    throw new Error(`Failed to load NFL puzzle (${response.status})`);
  }

  if (!contentType.includes("application/json")) {
    throw new Error(
      `No NFL ${position.toUpperCase()} puzzle found for ${date}. Generate one with \`npm run generate:nfl-puzzle -- ${date} ${position}\`, then \`npm run sync:data\`.`,
    );
  }

  return response.json() as Promise<DailyNflPuzzleFile>;
}

export function getSportFromUrl(): "nba" | "nfl" | "mlb" | null {
  const params = new URLSearchParams(window.location.search);
  const sport = params.get("sport")?.toLowerCase();
  if (sport === "nfl") {
    return "nfl";
  }
  if (sport === "nba") {
    return "nba";
  }
  if (sport === "mlb") {
    return "mlb";
  }
  return null;
}

export function getNflPositionFromUrl(): NflPuzzlePosition {
  const params = new URLSearchParams(window.location.search);
  const position = params.get("position")?.toLowerCase();
  if (position === "wr") {
    return "wr";
  }
  if (position === "rb") {
    return "rb";
  }
  if (position && position !== "qb") {
    console.warn(`Unsupported NFL position "${position}", defaulting to qb`);
  }
  return "qb";
}
