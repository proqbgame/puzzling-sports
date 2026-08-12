/**

 * Generate today's (or a specific date's) daily NFL puzzle (QB, WR, or RB).

 *

 * Run:

 *   npm run generate:nfl-puzzle

 *   npm run generate:nfl-puzzle -- 2026-07-20 wr

 *   npm run generate:nfl-puzzle -- 2026-07-21 rb

 *   npm run generate:nfl-puzzle -- 2026-07-20 qb

 */



import { mkdir, writeFile } from "node:fs/promises";

import path from "node:path";

import { fileURLToPath } from "node:url";



import { loadNflDataFromFiles } from "../src/data/loadNflData.js";

import { generateDailyNflPuzzle } from "../src/puzzle/nfl/generateDailyNflPuzzle.js";

import type {

  DailyNflPuzzleSolutionFile,

  NflPuzzlePosition,

} from "../src/puzzle/nfl/types.js";

import type { CellId } from "../src/rules/grid.js";

import type { PlayerSeasonAssignment } from "../src/types/nfl.js";

import { easternTodayIso } from "../src/utils/easternDate.js";



const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");



function todayIsoDate(): string {

  return easternTodayIso();

}



function parsePosition(raw: string | undefined): NflPuzzlePosition {

  const value = (raw ?? "qb").toLowerCase();

  if (value === "qb" || value === "wr" || value === "rb") {

    return value;

  }

  throw new Error(

    `Unsupported NFL position "${raw}" — use qb, wr, or rb`,

  );

}



function serializeSolution(

  solution: Partial<Record<CellId, PlayerSeasonAssignment>>,

): DailyNflPuzzleSolutionFile["solution"] {

  const output: DailyNflPuzzleSolutionFile["solution"] = {};



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



function formatBaseStats(

  position: NflPuzzlePosition,

  stats: Record<string, number>,

): string {

  if (position === "wr") {

    return `${stats.recYds} REC YDS / ${stats.recTd} REC TD / ${stats.receptions} REC / ${stats.targets} TGT`;

  }

  if (position === "rb") {

    return `${stats.rushYds} RUSH YDS / ${stats.rushTd} RUSH TD / ${stats.recYds} REC YDS / ${stats.recTd} REC TD`;

  }

  return `${stats.passYds} PASS YDS / ${stats.passTd} PASS TD / ${stats.compPct}% / ${stats.interceptions} INT`;

}



async function main(): Promise<void> {

  const date = process.argv[2] ?? todayIsoDate();

  const position = parsePosition(process.argv[3]);

  const puzzleDir = path.join(rootDir, "data", "puzzles", "nfl", position);



  console.log(`Generating daily NFL ${position.toUpperCase()} puzzle for ${date}...`);

  console.log("Loading NFL data...");



  const db = await loadNflDataFromFiles();

  const generated = generateDailyNflPuzzle(db, date, { position });



  await mkdir(puzzleDir, { recursive: true });



  const puzzlePath = path.join(puzzleDir, `${date}.json`);

  const solutionPath = path.join(puzzleDir, `${date}.solution.json`);



  const solutionFile: DailyNflPuzzleSolutionFile = {

    date,

    sport: "nfl",

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

