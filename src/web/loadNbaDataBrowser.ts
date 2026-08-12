import { loadNbaDataFromJson } from "../data/loadNbaDataFromJson.js";
import type { NbaDatabase } from "../data/NbaDatabase.js";
import type { DailyPuzzleFile } from "../puzzle/types.js";
import type {
  NbaMetadata,
  PlayerBioMap,
  PlayerSeason,
} from "../types/nba.js";
import { easternTodayIso } from "../utils/easternDate.js";

const NBA_DATA_BASE = "/data/nba";
const PUZZLE_DATA_BASE = "/data/puzzles/nba";

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load ${url} (${response.status})`);
  }
  return response.json() as Promise<T>;
}

export async function loadNbaDataBrowser(): Promise<NbaDatabase> {
  const [bios, seasons, metadata] = await Promise.all([
    fetchJson<PlayerBioMap>(`${NBA_DATA_BASE}/bios.json`),
    fetchJson<PlayerSeason[]>(`${NBA_DATA_BASE}/seasons.json`),
    fetchJson<NbaMetadata>(`${NBA_DATA_BASE}/metadata.json`),
  ]);

  return loadNbaDataFromJson(bios, seasons, metadata);
}

export async function loadDailyPuzzleBrowser(
  date: string,
): Promise<DailyPuzzleFile> {
  const url = `${PUZZLE_DATA_BASE}/${date}.json`;
  const response = await fetch(url);
  const contentType = response.headers.get("content-type") ?? "";

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error(
        `No NBA puzzle found for ${date}. Generate one with \`npm run generate:puzzle -- ${date}\`, then \`npm run sync:data\`. Or try: ?sport=nba&date=2026-06-30 — for NFL QB: ?sport=nfl&position=qb&date=${date}`,
      );
    }
    throw new Error(`Failed to load NBA puzzle (${response.status})`);
  }

  if (!contentType.includes("application/json")) {
    throw new Error(
      `No NBA puzzle found for ${date}. Generate one with \`npm run generate:puzzle -- ${date}\`, then \`npm run sync:data\`. Or try: ?sport=nba&date=2026-06-30 — for NFL QB: ?sport=nfl&position=qb&date=${date}`,
    );
  }

  return response.json() as Promise<DailyPuzzleFile>;
}

export function getPuzzleDateFromUrl(): string {
  const params = new URLSearchParams(window.location.search);
  const fromQuery = params.get("date");
  if (fromQuery) {
    return fromQuery;
  }

  return easternTodayIso();
}
