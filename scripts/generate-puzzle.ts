/**
 * Generate today's (or a specific date's) daily NBA puzzle.
 *
 * Run:
 *   npm run generate:puzzle
 *   npm run generate:puzzle -- 2026-06-30
 */

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { loadNbaDataFromFiles } from "../src/data/loadNbaData.js";
import { generateDailyPuzzle } from "../src/puzzle/generateDailyPuzzle.js";
import type { DailyPuzzleSolutionFile } from "../src/puzzle/types.js";
import type { CellId } from "../src/rules/grid.js";
import type { PlayerSeasonAssignment } from "../src/types/nba.js";
import { easternTodayIso } from "../src/utils/easternDate.js";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const puzzleDir = path.join(rootDir, "data", "puzzles", "nba");

function todayIsoDate(): string {
  return easternTodayIso();
}

function serializeSolution(
  solution: Partial<Record<CellId, PlayerSeasonAssignment>>,
): DailyPuzzleSolutionFile["solution"] {
  const output: DailyPuzzleSolutionFile["solution"] = {};

  for (const [cellId, assignment] of Object.entries(solution)) {
    if (!assignment) {
      continue;
    }

    output[cellId as CellId] = {
      playerId: assignment.playerId,
      playerName: assignment.playerName,
      season: assignment.season,
    };
  }

  return output;
}

async function main(): Promise<void> {
  const date = process.argv[2] ?? todayIsoDate();

  console.log(`Generating daily puzzle for ${date}...`);
  console.log("Loading NBA data...");

  const db = await loadNbaDataFromFiles();
  const generated = generateDailyPuzzle(db, date);

  await mkdir(puzzleDir, { recursive: true });

  const puzzlePath = path.join(puzzleDir, `${date}.json`);
  const solutionPath = path.join(puzzleDir, `${date}.solution.json`);

  const solutionFile: DailyPuzzleSolutionFile = {
    date,
    solution: serializeSolution(generated.solution),
  };

  await writeFile(puzzlePath, JSON.stringify(generated.puzzle, null, 2), "utf8");
  await writeFile(solutionPath, JSON.stringify(solutionFile, null, 2), "utf8");

  console.log();
  console.log("Done.");
  console.log(`  Base: ${generated.puzzle.base.playerName} (${generated.puzzle.base.season})`);
  console.log(
    `  Stats: ${generated.puzzle.base.stats.ppg} PPG / ${generated.puzzle.base.stats.rpg} RPG / ${generated.puzzle.base.stats.apg} AST / ${generated.puzzle.base.stats.blk} BLK`,
  );
  console.log(`  Puzzle:   ${puzzlePath}`);
  console.log(`  Solution: ${solutionPath}`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
