/**
 * Date-seeded jigsaw topology so each daily puzzle gets a unique piece layout.
 */

import {
  generateEdgeTopology,
  type EdgeTopology,
} from "../rules/topology.js";
import { createSeededRng, hashStringToSeed } from "./seededRng.js";

/**
 * @param date - ISO date YYYY-MM-DD
 * @param variant - e.g. "nba", "nfl-qb", "nfl-wr", "nfl-rb"
 */
export function dailyEdgeTopology(
  date: string,
  variant: string,
): EdgeTopology {
  const seed = hashStringToSeed(
    `puzzling-sports-topology-${variant}-${date}`,
  );
  return generateEdgeTopology(createSeededRng(seed));
}
