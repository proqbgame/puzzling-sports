/**
 * Scan puzzle folders and write public/data/puzzles/index.json
 * (also mirrors under data/puzzles/index.json).
 *
 * Run: npm run build:puzzle-index
 */

import { mkdir, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  emptyPuzzleArchiveIndex,
  type PuzzleArchiveIndex,
  type PuzzleGridKey,
} from "../src/puzzle/archiveIndex.js";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const GRID_DIRS: { key: PuzzleGridKey; relative: string }[] = [
  { key: "nba", relative: path.join("data", "puzzles", "nba") },
  { key: "nfl-qb", relative: path.join("data", "puzzles", "nfl", "qb") },
  { key: "nfl-wr", relative: path.join("data", "puzzles", "nfl", "wr") },
  { key: "nfl-rb", relative: path.join("data", "puzzles", "nfl", "rb") },
];

async function listPuzzleDates(dir: string): Promise<string[]> {
  let files: string[];
  try {
    files = await readdir(dir);
  } catch {
    return [];
  }

  const dates = files
    .filter(
      (file) =>
        file.endsWith(".json") &&
        !file.endsWith(".solution.json") &&
        /^\d{4}-\d{2}-\d{2}\.json$/.test(file),
    )
    .map((file) => file.replace(/\.json$/, ""));

  dates.sort((a, b) => b.localeCompare(a));
  return dates;
}

export async function buildPuzzleArchiveIndex(): Promise<PuzzleArchiveIndex> {
  const index = emptyPuzzleArchiveIndex();

  for (const { key, relative } of GRID_DIRS) {
    index.grids[key] = await listPuzzleDates(path.join(rootDir, relative));
  }

  return index;
}

async function writeIndex(index: PuzzleArchiveIndex): Promise<void> {
  const payload = `${JSON.stringify(index, null, 2)}\n`;
  const destinations = [
    path.join(rootDir, "data", "puzzles", "index.json"),
    path.join(rootDir, "public", "data", "puzzles", "index.json"),
  ];

  for (const dest of destinations) {
    await mkdir(path.dirname(dest), { recursive: true });
    await writeFile(dest, payload, "utf8");
  }
}

async function main(): Promise<void> {
  const index = await buildPuzzleArchiveIndex();
  await writeIndex(index);

  const counts = Object.entries(index.grids)
    .map(([key, dates]) => `${key}=${dates.length}`)
    .join(", ");
  console.log(`Wrote puzzle archive index (${counts})`);
}

const isDirectRun =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectRun) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
}
