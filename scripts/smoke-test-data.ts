/**
 * Quick check that NBA data loads and lookups work.
 *
 * Run: npm run test:data
 */

import { loadNbaDataFromFiles } from "../src/data/loadNbaData.js";

async function main(): Promise<void> {
  console.log("Loading NBA data...");
  const db = await loadNbaDataFromFiles();

  console.log(`  Players:     ${db.metadata.playerCount}`);
  console.log(`  Season rows: ${db.metadata.seasonRowCount}`);
  console.log(
    `  Seasons:     ${db.metadata.seasons[0]} .. ${db.metadata.seasons.at(-1)}`,
  );
  console.log();

  const wiltIds = db.findPlayerIdsByName("Wilt Chamberlain");
  const wilt = db.getAssignment(wiltIds[0], "1961-62");

  if (!wilt) {
    throw new Error("Expected to find Wilt Chamberlain 1961-62");
  }

  console.log("Lookup: Wilt Chamberlain 1961-62");
  console.log(`  College: ${wilt.bio.college}`);
  console.log(`  PPG: ${wilt.stats.ppg}  RPG: ${wilt.stats.rpg}`);
  console.log(`  MVP that season: ${wilt.stats.honors.mvp}`);
  console.log();

  const lebron = db.getAssignmentByName("LeBron James", "2012-13");
  if (!lebron) {
    throw new Error("Expected to find LeBron James 2012-13");
  }

  console.log("Lookup: LeBron James 2012-13");
  console.log(`  PPG: ${lebron.stats.ppg}  Champion: ${lebron.stats.honors.champion}`);
  console.log();

  console.log("Season input normalize '2023' ->", db.normalizeSeasonInput("2023"));
  console.log("Data loader OK.");
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
