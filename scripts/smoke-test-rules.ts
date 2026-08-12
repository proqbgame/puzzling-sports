/**
 * Test perimeter criteria matching.
 *
 * Run: npm run test:rules
 */

import { loadNbaDataFromFiles } from "../src/data/loadNbaData.js";
import { Criteria, matchesAllCriteria, matchesCriterion } from "../src/rules/index.js";

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

async function main(): Promise<void> {
  const db = await loadNbaDataFromFiles();

  const wilt6162 = db.getAssignmentByName("Wilt Chamberlain", "1961-62");
  assert(wilt6162 !== undefined, "Wilt 1961-62 should exist");

  const lebron1213 = db.getAssignmentByName("LeBron James", "2012-13");
  assert(lebron1213 !== undefined, "LeBron 2012-13 should exist");

  const jokic2324 = db.getAssignmentByName("Nikola Jokic", "2023-24");
  assert(jokic2324 !== undefined, "Jokic 2023-24 should exist");

  // Wilt: Kansas, 50+ PPG, not DPOY that season
  assert(
    matchesAllCriteria(wilt6162!, [
      Criteria.college("Kansas"),
      Criteria.ppgAtLeast(50),
    ]),
    "Wilt 1961-62 should match Kansas + 50+ PPG",
  );
  assert(
    !matchesCriterion(wilt6162!, Criteria.college("Duke")),
    "Wilt should not match Duke",
  );
  assert(
    !matchesCriterion(wilt6162!, { type: "dpoy" }),
    "Wilt 1961-62 should not be DPOY that season",
  );

  // LeBron 2012-13: MVP + champion
  assert(
    matchesAllCriteria(lebron1213!, [Criteria.mvp(), Criteria.champion()]),
    "LeBron 2012-13 should be MVP and champion",
  );

  // Jokic 2023-24: MVP, not 1st pick
  assert(matchesCriterion(jokic2324!, Criteria.mvp()), "Jokic 2023-24 MVP");
  assert(
    !matchesCriterion(jokic2324!, Criteria.firstPick()),
    "Jokic was not the 1st pick",
  );

  // Career criteria
  assert(matchesCriterion(wilt6162!, { type: "everMvp" }), "Wilt ever MVP");
  assert(
    !matchesCriterion(wilt6162!, Criteria.notAllStar()),
    "Wilt was an all-star at some point",
  );

  console.log("Criteria tests passed.");
  console.log("  Wilt 1961-62: Kansas + 50+ PPG");
  console.log("  LeBron 2012-13: MVP + Champion");
  console.log("  Jokic 2023-24: MVP, not 1st pick");
  console.log("Rules engine (criteria) OK.");
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
