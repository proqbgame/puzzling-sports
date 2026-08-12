/**
 * Test edge comparisons and full guess validation.
 *
 * Run: npm run test:validate
 */

import { loadNbaDataFromFiles } from "../src/data/loadNbaData.js";
import {
  compareEdge,
  Criteria,
  validateGuess,
  type BoardState,
  type PuzzleDefinition,
} from "../src/rules/index.js";

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

async function main(): Promise<void> {
  const db = await loadNbaDataFromFiles();

  const lebron = db.getAssignmentByName("LeBron James", "2012-13");
  assert(lebron !== undefined, "LeBron 2012-13 missing");

  const nash = db.getAssignmentByName("Steve Nash", "2005-06");
  assert(nash !== undefined, "Steve Nash 2005-06 missing");

  // Top-middle socket vs center tab → PPG must be <= LeBron
  assert(
    compareEdge(nash!, lebron!, "top-middle", "center", "socket"),
    "Nash PPG should be <= LeBron on top-middle socket edge",
  );

  // Middle-left tab vs center socket → RPG must be >= LeBron
  const dwight = db.getAssignmentByName("Dwight Howard", "2010-11");
  assert(dwight !== undefined, "Dwight Howard 2010-11 missing");

  assert(
    compareEdge(dwight!, lebron!, "middle-left", "center", "tab"),
    "Dwight RPG should be >= LeBron on middle-left tab edge",
  );

  const puzzle: PuzzleDefinition = {
    base: lebron!,
    cells: {
      "top-middle": {
        criteria: [Criteria.mvp()],
      },
      "middle-left": {
        criteria: [Criteria.college("Kentucky")],
      },
    },
  };

  const board: BoardState = {};

  // Easy mode: MVP + PPG socket edge vs LeBron (need PPG <= LeBron)
  const nashEasy = validateGuess(db, puzzle, board, "easy", {
    cellId: "top-middle",
    playerName: "Steve Nash",
  });
  assert(nashEasy.valid, "Nash should work for MVP + PPG socket edge (easy)");
  assert(
    nashEasy.assignment?.season === "2005-06",
    "Should pick most recent valid MVP season",
  );

  const rondoFail = validateGuess(db, puzzle, board, "easy", {
    cellId: "top-middle",
    playerName: "Rajon Rondo",
  });
  assert(!rondoFail.valid, "Rondo should not satisfy MVP criteria");

  const jordanFail = validateGuess(db, puzzle, board, "easy", {
    cellId: "top-middle",
    playerName: "Michael Jordan",
  });
  assert(!jordanFail.valid, "Jordan MVP should fail PPG socket edge vs LeBron");

  const hardNeedSeason = validateGuess(db, puzzle, board, "hard", {
    cellId: "top-middle",
    playerName: "Steve Nash",
  });
  assert(!hardNeedSeason.valid, "Hard mode should require season");

  const hardNash = validateGuess(db, puzzle, board, "hard", {
    cellId: "top-middle",
    playerName: "Steve Nash",
    season: "2005-06",
  });
  assert(hardNash.valid, "Nash 2005-06 MVP should pass hard mode");

  const boardWithTm: BoardState = {
    "top-middle": nashEasy.assignment!,
  };

  const mlFail = validateGuess(db, puzzle, boardWithTm, "easy", {
    cellId: "middle-left",
    playerName: "LeBron James",
  });
  assert(!mlFail.valid, "LeBron did not go to Kentucky");

  console.log("Validation tests passed.");
  console.log("  Edge: Nash PPG <= LeBron (top-middle socket)");
  console.log("  Edge: Dwight RPG >= LeBron (middle-left tab)");
  console.log("  Easy: Steve Nash MVP (auto season)");
  console.log("  Hard: Steve Nash 2005-06 MVP");
  console.log("Rules engine (edges + validate) OK.");
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
