/**
 * Test daily puzzle generation.
 *
 * Run: npm run test:puzzle
 */

import { loadNbaDataFromFiles } from "../src/data/loadNbaData.js";
import {
  countValidAnswersForCell,
  generateDailyPuzzle,
} from "../src/puzzle/generateDailyPuzzle.js";
import { countUniqueCollegesOnShell } from "../src/puzzle/criteriaPool.js";
import {
  buildCollegePlayerCountMap,
  isShellEligibleCollege,
} from "../src/puzzle/collegeEligibility.js";
import { isPuzzleComplete } from "../src/rules/validateGuess.js";
import { OUTER_CELL_IDS } from "../src/rules/grid.js";

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

async function main(): Promise<void> {
  const db = await loadNbaDataFromFiles();
  const collegeCounts = buildCollegePlayerCountMap(db.bios);
  const testDates = ["2026-06-28", "2026-06-29", "2026-06-30"];

  for (const date of testDates) {
    const generated = generateDailyPuzzle(db, date);

    assert(
      generated.puzzle.date === date,
      `Puzzle date should be ${date}`,
    );
    assert(
      isPuzzleComplete(generated.definition, generated.solution),
      `Generated puzzle for ${date} should be complete`,
    );

    for (const cellId of OUTER_CELL_IDS) {
      const answerCount = countValidAnswersForCell(
        db,
        generated.definition,
        generated.solution,
        cellId,
      );
      assert(answerCount >= 1, `${cellId} should have at least one valid answer`);
    }

    const collegeCount = countUniqueCollegesOnShell(generated.definition.cells);
    assert(
      collegeCount <= 2,
      `${date} should have at most 2 colleges on the outer shell (got ${collegeCount})`,
    );

    for (const cellId of OUTER_CELL_IDS) {
      const criteria = generated.definition.cells[cellId]?.criteria ?? [];
      for (const criterion of criteria) {
        if (criterion.type === "college") {
          assert(
            isShellEligibleCollege(criterion.school, collegeCounts),
            `${date} ${cellId} uses ineligible shell college: ${criterion.school}`,
          );
        }
      }
    }

    console.log(
      `${date}: ${generated.puzzle.base.playerName} (${generated.puzzle.base.season}) — ${collegeCount} college(s) on shell`,
    );
  }

  console.log("Daily puzzle generator OK.");
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
