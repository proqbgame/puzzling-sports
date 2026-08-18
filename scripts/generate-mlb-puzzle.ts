/**
 * Generate a daily MLB puzzle (pitcher or hitter).
 *
 *   npm run generate:mlb-puzzle
 *   npm run generate:mlb-puzzle -- 2026-08-17 hitter
 *   npm run generate:mlb-puzzle -- 2026-08-17 pitcher
 */

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { loadMlbDataFromFiles } from "../src/data/loadMlbData.js";
import { generateDailyMlbPuzzle } from "../src/puzzle/mlb/generateDailyMlbPuzzle.js";
import type {
  DailyMlbPuzzleSolutionFile,
  MlbPuzzlePosition,
} from "../src/puzzle/mlb/types.js";
import type { CellId } from "../src/rules/grid.js";
import type { PlayerSeasonAssignment } from "../src/types/mlb.js";
import { easternTodayIso } from "../src/utils/easternDate.js";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function parsePosition(raw: string | undefined): MlbPuzzlePosition {
  const value = (raw ?? "hitter").toLowerCase();
  if (value === "pitcher" || value === "hitter") {
    return value;
  }
  throw new Error(`Unsupported MLB position "${raw}" — use pitcher or hitter`);
}

function serializeSolution(
  solution: Partial<Record<CellId, PlayerSeasonAssignment>>,
): DailyMlbPuzzleSolutionFile["solution"] {
  const output: DailyMlbPuzzleSolutionFile["solution"] = {};
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

function formatBaseStats(position: MlbPuzzlePosition, stats: Record<string, number>): string {
  if (position === "pitcher") {
    return `${stats.so} SO / ${stats.w} W / ${stats.ip} IP / ${stats.era} ERA`;
  }
  return `${stats.hr} HR / ${stats.rbi} RBI / ${stats.avg} AVG / ${stats.sb} SB`;
}

async function main(): Promise<void> {
  const date = process.argv[2] ?? easternTodayIso();
  const position = parsePosition(process.argv[3]);
  const puzzleDir = path.join(rootDir, "data", "puzzles", "mlb", position);

  console.log(`Generating daily MLB ${position} puzzle for ${date}...`);
  const db = await loadMlbDataFromFiles();
  const generated = generateDailyMlbPuzzle(db, date, { position });

  await mkdir(puzzleDir, { recursive: true });
  const puzzlePath = path.join(puzzleDir, `${date}.json`);
  const solutionPath = path.join(puzzleDir, `${date}.solution.json`);

  const solutionFile: DailyMlbPuzzleSolutionFile = {
    date,
    sport: "mlb",
    position,
    solution: serializeSolution(generated.solution),
  };

  await writeFile(puzzlePath, JSON.stringify(generated.puzzle, null, 2), "utf8");
  await writeFile(solutionPath, JSON.stringify(solutionFile, null, 2), "utf8");

  const { base } = generated.puzzle;
  console.log();
  console.log("Done.");
  console.log(`  Base: ${base.playerName} (${base.season})`);
  console.log(`  Stats: ${formatBaseStats(position, base.stats as Record<string, number>)}`);
  console.log(`  Puzzle:   ${puzzlePath}`);
  console.log(`  Solution: ${solutionPath}`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
