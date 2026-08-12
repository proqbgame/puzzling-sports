/**
 * Smoke test NFL QB rules foundation (data + criteria + edges).
 *
 * Run: npm run test:nfl-rules
 */

import { loadNflDataFromFiles } from "../src/data/loadNflData.js";
import { CELL_POSITIONS } from "../src/rules/grid.js";
import {
  compareEdge,
  Criteria,
  matchesAllCriteria,
  matchesCriterion,
  statForEdge,
} from "../src/rules/nfl/index.js";

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

async function main(): Promise<void> {
  const db = await loadNflDataFromFiles();

  assert(db.metadata.sport === "nfl", "metadata.sport should be nfl");
  assert(db.metadata.playerCount >= 400, "expected ~420 QBs loaded");

  const mahomes2022 = db.getAssignmentByName("Patrick Mahomes", "2022");
  assert(mahomes2022 !== undefined, "Mahomes 2022 should exist");

  const { stats, bio } = mahomes2022!;

  assert(stats.passYds === 5250, `Mahomes 2022 passYds expected 5250, got ${stats.passYds}`);
  assert(stats.passTd === 41, `Mahomes 2022 passTd expected 41, got ${stats.passTd}`);
  assert(
    stats.interceptions === 12,
    `Mahomes 2022 INT expected 12, got ${stats.interceptions}`,
  );
  assert(
    Math.abs(stats.compPct - 67.1) < 0.15,
    `Mahomes 2022 compPct expected ~67.1, got ${stats.compPct}`,
  );
  assert(stats.completions === 435, "Mahomes 2022 completions");
  assert(stats.attempts === 648, "Mahomes 2022 attempts");

  // Season honors
  assert(matchesCriterion(mahomes2022!, Criteria.mvp()), "Mahomes 2022 MVP");
  assert(matchesCriterion(mahomes2022!, Criteria.champion()), "Mahomes 2022 champion");
  assert(matchesCriterion(mahomes2022!, Criteria.proBowl()), "Mahomes 2022 Pro Bowl");
  assert(matchesCriterion(mahomes2022!, Criteria.allPro()), "Mahomes 2022 All-Pro");
  assert(matchesCriterion(mahomes2022!, Criteria.sbMvp()), "Mahomes 2022 SB MVP");

  // Career / bio
  assert(matchesCriterion(mahomes2022!, { type: "everMvp" }), "ever MVP");
  assert(
    matchesCriterion(mahomes2022!, Criteria.college("Texas Tech")),
    "Texas Tech",
  );
  assert(bio.draftPick === 10, "draft pick 10");

  const mahomes2023 = db.getAssignmentByName("Patrick Mahomes", "2023");
  assert(mahomes2023 !== undefined, "Mahomes 2023 should exist");
  assert(
    matchesAllCriteria(mahomes2023!, [
      Criteria.champion(),
      Criteria.proBowl(),
      Criteria.sbMvp(),
    ]),
    "Mahomes 2023 champion + Pro Bowl + SB MVP",
  );
  assert(
    !matchesCriterion(mahomes2023!, Criteria.mvp()),
    "Mahomes 2023 was not MVP",
  );

  // Season normalize: "2022" and "2022-23" → "2022"
  assert(db.normalizeSeasonInput("2022") === "2022", "normalize 2022");
  assert(db.normalizeSeasonInput("2022-23") === "2022", "normalize 2022-23");

  // Edge layout: up/down/left/right map correctly
  const center = CELL_POSITIONS.center;
  const topMiddle = CELL_POSITIONS["top-middle"];
  const bottomMiddle = CELL_POSITIONS["bottom-middle"];
  const middleLeft = CELL_POSITIONS["middle-left"];
  const middleRight = CELL_POSITIONS["middle-right"];

  assert(statForEdge(center, topMiddle) === "passYds", "up edge = passYds");
  assert(statForEdge(center, bottomMiddle) === "passTd", "down edge = passTd");
  assert(statForEdge(center, middleLeft) === "compPct", "left edge = compPct");
  assert(
    statForEdge(center, middleRight) === "interceptions",
    "right edge = interceptions",
  );

  assert(
    statForEdge(center, topMiddle, "wr") === "recYds",
    "WR up edge = recYds",
  );
  assert(
    statForEdge(center, bottomMiddle, "wr") === "recTd",
    "WR down edge = recTd",
  );
  assert(
    statForEdge(center, middleLeft, "wr") === "receptions",
    "WR left edge = receptions",
  );
  assert(
    statForEdge(center, middleRight, "wr") === "targets",
    "WR right edge = targets",
  );

  assert(
    statForEdge(center, topMiddle, "rb") === "rushYds",
    "RB up edge = rushYds",
  );
  assert(
    statForEdge(center, bottomMiddle, "rb") === "rushTd",
    "RB down edge = rushTd",
  );
  assert(
    statForEdge(center, middleLeft, "rb") === "recYds",
    "RB left edge = recYds",
  );
  assert(
    statForEdge(center, middleRight, "rb") === "recTd",
    "RB right edge = recTd",
  );

  // Edge compare: higher passYds satisfies center tab ≥ top-middle
  const lowerYards = db
    .getAllAssignments()
    .find(
      (a) =>
        a.playerId !== mahomes2022!.playerId &&
        a.stats.passYds > 3000 &&
        a.stats.passYds < mahomes2022!.stats.passYds,
    );
  assert(lowerYards !== undefined, "need a lower-yards assignment for edge test");

  assert(
    compareEdge(mahomes2022!, lowerYards!, "center", "top-middle", "tab"),
    "Mahomes higher passYds should satisfy center tab >= top-middle",
  );
  assert(
    compareEdge(lowerYards!, mahomes2022!, "top-middle", "center", "socket"),
    "Lower yards on top-middle socket should satisfy <= center",
  );
  assert(
    !compareEdge(lowerYards!, mahomes2022!, "center", "top-middle", "tab"),
    "Lower yards as center tab should fail vs Mahomes",
  );

  console.log("NFL rules smoke tests passed.");
  console.log(
    `  Mahomes 2022: ${stats.passYds} YDS / ${stats.passTd} TD / ${stats.interceptions} INT / ${stats.compPct}%`,
  );
  console.log("  Honors: MVP + Champion + Pro Bowl + All-Pro + SB MVP");
  console.log(
    `  Edge: passYds tab ${mahomes2022!.stats.passYds} >= ${lowerYards!.playerName} ${lowerYards!.stats.passYds}`,
  );
  console.log("NFL QB rules foundation OK.");
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
