import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { loadNbaDataFromJson } from "./loadNbaDataFromJson.js";
import type { NbaDatabase } from "./NbaDatabase.js";
import type {
  NbaMetadata,
  PlayerBioMap,
  PlayerSeason,
} from "../types/nba.js";

export interface NbaDataPaths {
  biosPath: string;
  seasonsPath: string;
  metadataPath: string;
}

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
export const DEFAULT_NBA_DATA_DIR = path.resolve(moduleDir, "../../data/nba");

export function defaultNbaDataPaths(
  dataDir: string = DEFAULT_NBA_DATA_DIR,
): NbaDataPaths {
  return {
    biosPath: path.join(dataDir, "bios.json"),
    seasonsPath: path.join(dataDir, "seasons.json"),
    metadataPath: path.join(dataDir, "metadata.json"),
  };
}

export async function loadNbaDataFromFiles(
  paths: NbaDataPaths = defaultNbaDataPaths(),
): Promise<NbaDatabase> {
  const [biosRaw, seasonsRaw, metadataRaw] = await Promise.all([
    readFile(paths.biosPath, "utf8"),
    readFile(paths.seasonsPath, "utf8"),
    readFile(paths.metadataPath, "utf8"),
  ]);

  return loadNbaDataFromJson(
    JSON.parse(biosRaw) as PlayerBioMap,
    JSON.parse(seasonsRaw) as PlayerSeason[],
    JSON.parse(metadataRaw) as NbaMetadata,
  );
}
