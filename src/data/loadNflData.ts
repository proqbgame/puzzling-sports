import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { loadNflDataFromJson } from "./loadNflDataFromJson.js";
import type { NflDatabase } from "./NflDatabase.js";
import type {
  NflMetadata,
  PlayerBioMap,
  RawPlayerSeason,
} from "../types/nfl.js";

export interface NflDataPaths {
  biosPath: string;
  seasonsPath: string;
  metadataPath: string;
}

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
export const DEFAULT_NFL_DATA_DIR = path.resolve(moduleDir, "../../data/nfl");

export function defaultNflDataPaths(
  dataDir: string = DEFAULT_NFL_DATA_DIR,
): NflDataPaths {
  return {
    biosPath: path.join(dataDir, "bios.json"),
    seasonsPath: path.join(dataDir, "seasons.json"),
    metadataPath: path.join(dataDir, "metadata.json"),
  };
}

export async function loadNflDataFromFiles(
  paths: NflDataPaths = defaultNflDataPaths(),
): Promise<NflDatabase> {
  const [biosRaw, seasonsRaw, metadataRaw] = await Promise.all([
    readFile(paths.biosPath, "utf8"),
    readFile(paths.seasonsPath, "utf8"),
    readFile(paths.metadataPath, "utf8"),
  ]);

  return loadNflDataFromJson(
    JSON.parse(biosRaw) as PlayerBioMap,
    JSON.parse(seasonsRaw) as RawPlayerSeason[],
    JSON.parse(metadataRaw) as NflMetadata,
  );
}
