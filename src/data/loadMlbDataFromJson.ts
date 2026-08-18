import { MlbDatabase } from "./MlbDatabase.js";
import type { MlbMetadata, PlayerBioMap, PlayerSeason } from "../types/mlb.js";

export function loadMlbDataFromJson(
  bios: PlayerBioMap,
  seasons: PlayerSeason[],
  metadata: MlbMetadata,
): MlbDatabase {
  return new MlbDatabase(metadata, bios, seasons);
}
