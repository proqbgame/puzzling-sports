import { NbaDatabase } from "./NbaDatabase.js";
import type {
  NbaMetadata,
  PlayerBioMap,
  PlayerSeason,
} from "../types/nba.js";

export function loadNbaDataFromJson(
  bios: PlayerBioMap,
  seasons: PlayerSeason[],
  metadata: NbaMetadata,
): NbaDatabase {
  return new NbaDatabase(metadata, bios, seasons);
}
