/**
 * Test daily NFL puzzle generation (QB / WR / RB).
 *
 * Run: npm run test:nfl-puzzle
 */

import { loadNflDataFromFiles } from "../src/data/loadNflData.js";
import {
  countValidAnswersForCell,
  generateDailyNflPuzzle,
} from "../src/puzzle/nfl/generateDailyNflPuzzle.js";
import {
  countUniqueCollegesOnShell,
  isSeasonAllProCriterion,
  isAwardCriterion,
  isCollegeCriterion,
  isSeasonAwardCriterion,
  meetsOuterShellConstraints,
  MIN_SHELL_ALL_PRO,
  MIN_SHELL_AWARDS,
  MIN_SHELL_COLLEGES,
} from "../src/puzzle/nfl/criteriaPool.js";
import {
  buildCollegePlayerCountMap,
  isShellEligibleCollege,
} from "../src/puzzle/collegeEligibility.js";
import { isPuzzleComplete } from "../src/rules/nfl/validateGuess.js";
import { OUTER_CELL_IDS } from "../src/rules/grid.js";
import type { Criterion } from "../src/rules/nfl/criteria.js";
import type { NflPuzzlePosition } from "../src/puzzle/nfl/types.js";

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

function countCriteria(
  cells: Partial<Record<string, { criteria?: Criterion[] }>>,
  predicate: (criterion: Criterion) => boolean,
): number {
  let count = 0;
  for (const cell of Object.values(cells)) {
    for (const criterion of cell?.criteria ?? []) {
      if (predicate(criterion)) {
        count += 1;
      }
    }
  }
  return count;
}

async function main(): Promise<void> {
  const db = await loadNflDataFromFiles();
  const collegeCounts = buildCollegePlayerCountMap(db.bios);
  const testCases: Array<{ date: string; position: NflPuzzlePosition }> = [
    { date: "2026-07-16", position: "qb" },
    { date: "2026-07-17", position: "qb" },
    { date: "2026-07-20", position: "wr" },
    { date: "2026-07-21", position: "rb" },
  ];

  for (const { date, position } of testCases) {
    const generated = generateDailyNflPuzzle(db, date, { position });

    assert(
      generated.puzzle.date === date,
      `Puzzle date should be ${date}`,
    );
    assert(generated.puzzle.sport === "nfl", `${date} sport should be nfl`);
    assert(
      generated.puzzle.position === position,
      `${date} position should be ${position}`,
    );
    assert(
      isPuzzleComplete(generated.definition, generated.solution),
      `Generated puzzle for ${date} ${position} should be complete`,
    );

    for (const cellId of OUTER_CELL_IDS) {
      const answerCount = countValidAnswersForCell(
        db,
        generated.definition,
        generated.solution,
        cellId,
        position,
      );
      assert(answerCount >= 1, `${cellId} should have at least one valid answer`);
    }

    const collegeCount = countUniqueCollegesOnShell(generated.definition.cells);
    assert(
      collegeCount <= 2,
      `${date} should have at most 2 colleges on the outer shell (got ${collegeCount})`,
    );
    assert(
      collegeCount >= MIN_SHELL_COLLEGES,
      `${date} should have at least ${MIN_SHELL_COLLEGES} college on shell`,
    );

    const shellCriteria: Partial<Record<string, Criterion[]>> = {};
    for (const cellId of OUTER_CELL_IDS) {
      const criteria = generated.definition.cells[cellId]?.criteria;
      if (criteria) {
        shellCriteria[cellId] = criteria;
      }
    }

    assert(
      meetsOuterShellConstraints(shellCriteria),
      `${date} should meet outer-shell award/All-Pro/college quotas`,
    );

    const awardCount = countCriteria(
      generated.definition.cells,
      (c) => isSeasonAwardCriterion(c) || isAwardCriterion(c),
    );
    assert(
      awardCount >= MIN_SHELL_AWARDS,
      `${date} should have ≥${MIN_SHELL_AWARDS} awards (got ${awardCount})`,
    );
    assert(
      countCriteria(generated.definition.cells, isSeasonAllProCriterion) >=
        MIN_SHELL_ALL_PRO,
      `${date} should have ≥${MIN_SHELL_ALL_PRO} All-Pro criteria`,
    );
    assert(
      countCriteria(generated.definition.cells, isCollegeCriterion) >=
        MIN_SHELL_COLLEGES,
      `${date} should have ≥${MIN_SHELL_COLLEGES} college criteria`,
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
      `${date} ${position}: ${generated.puzzle.base.playerName} (${generated.puzzle.base.season}) — ${collegeCount} college(s) on shell`,
    );
  }

  console.log("NFL daily puzzle generator OK.");
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
