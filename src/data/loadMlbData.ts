import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { loadMlbDataFromJson } from "./loadMlbDataFromJson.js";
import type { MlbDatabase } from "./MlbDatabase.js";
import type { MlbMetadata, PlayerBioMap, PlayerSeason } from "../types/mlb.js";

export interface MlbDataPaths {
  biosPath: string;
  seasonsPath: string;
  metadataPath: string;
}

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
export const DEFAULT_MLB_DATA_DIR = path.resolve(moduleDir, "../../data/mlb");

export function defaultMlbDataPaths(
  dataDir: string = DEFAULT_MLB_DATA_DIR,
): MlbDataPaths {
  return {
    biosPath: path.join(dataDir, "bios.json"),
    seasonsPath: path.join(dataDir, "seasons.json"),
    metadataPath: path.join(dataDir, "metadata.json"),
  };
}

export async function loadMlbDataFromFiles(
  paths: MlbDataPaths = defaultMlbDataPaths(),
): Promise<MlbDatabase> {
  const [biosRaw, seasonsRaw, metadataRaw] = await Promise.all([
    readFile(paths.biosPath, "utf8"),
    readFile(paths.seasonsPath, "utf8"),
    readFile(paths.metadataPath, "utf8"),
  ]);

  return loadMlbDataFromJson(
    JSON.parse(biosRaw) as PlayerBioMap,
    JSON.parse(seasonsRaw) as PlayerSeason[],
    JSON.parse(metadataRaw) as MlbMetadata,
  );
}
