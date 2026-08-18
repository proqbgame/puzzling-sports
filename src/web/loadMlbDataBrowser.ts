import { loadMlbDataFromJson } from "../data/loadMlbDataFromJson.js";
import type { MlbDatabase } from "../data/MlbDatabase.js";
import type {
  DailyMlbPuzzleFile,
  MlbPuzzlePosition,
} from "../puzzle/mlb/types.js";
import type { MlbMetadata, PlayerBioMap, PlayerSeason } from "../types/mlb.js";

const MLB_DATA_BASE = "/data/mlb";

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load ${url} (${response.status})`);
  }
  return response.json() as Promise<T>;
}

export async function loadMlbDataBrowser(): Promise<MlbDatabase> {
  const [bios, seasons, metadata] = await Promise.all([
    fetchJson<PlayerBioMap>(`${MLB_DATA_BASE}/bios.json`),
    fetchJson<PlayerSeason[]>(`${MLB_DATA_BASE}/seasons.json`),
    fetchJson<MlbMetadata>(`${MLB_DATA_BASE}/metadata.json`),
  ]);
  return loadMlbDataFromJson(bios, seasons, metadata);
}

export async function loadDailyMlbPuzzleBrowser(
  date: string,
  position: MlbPuzzlePosition = "hitter",
): Promise<DailyMlbPuzzleFile> {
  const url = `/data/puzzles/mlb/${position}/${date}.json`;
  const response = await fetch(url);
  const contentType = response.headers.get("content-type") ?? "";

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error(
        `No MLB ${position} puzzle found for ${date}. Generate one with \`npm run generate:mlb-puzzle -- ${date} ${position}\`, then \`npm run sync:data\`.`,
      );
    }
    throw new Error(`Failed to load MLB puzzle (${response.status})`);
  }

  if (!contentType.includes("application/json")) {
    throw new Error(
      `No MLB ${position} puzzle found for ${date}. Generate one with \`npm run generate:mlb-puzzle -- ${date} ${position}\`, then \`npm run sync:data\`.`,
    );
  }

  return response.json() as Promise<DailyMlbPuzzleFile>;
}

export function getMlbPositionFromUrl(): MlbPuzzlePosition {
  const params = new URLSearchParams(window.location.search);
  const position = params.get("position")?.toLowerCase();
  if (position === "pitcher") {
    return "pitcher";
  }
  if (position && position !== "hitter") {
    console.warn(`Unsupported MLB position "${position}", defaulting to hitter`);
  }
  return "hitter";
}
