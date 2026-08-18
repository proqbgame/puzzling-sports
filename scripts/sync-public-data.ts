/**
 * Copy NBA + NFL data and puzzles into public/ for the Vite dev/build server.
 *
 * Run: npm run sync:data
 */

import { copyFile, mkdir, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { buildPuzzleArchiveIndex } from "./build-puzzle-index.js";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

async function copyFileEnsuringDir(src: string, dest: string): Promise<void> {
  await mkdir(path.dirname(dest), { recursive: true });
  await copyFile(src, dest);
}

async function syncJsonDir(
  srcDir: string,
  destDir: string,
  options?: { skipSolutionFiles?: boolean },
): Promise<number> {
  let copied = 0;
  let files: string[];
  try {
    files = await readdir(srcDir);
  } catch {
    return 0;
  }

  for (const file of files) {
    if (!file.endsWith(".json")) {
      continue;
    }
    if (options?.skipSolutionFiles && file.endsWith(".solution.json")) {
      continue;
    }
    await copyFileEnsuringDir(path.join(srcDir, file), path.join(destDir, file));
    copied += 1;
  }

  return copied;
}

async function main(): Promise<void> {
  const nbaSrc = path.join(rootDir, "data", "nba");
  const nbaDest = path.join(rootDir, "public", "data", "nba");
  const nbaPuzzleSrc = path.join(rootDir, "data", "puzzles", "nba");
  const nbaPuzzleDest = path.join(rootDir, "public", "data", "puzzles", "nba");

  const nflSrc = path.join(rootDir, "data", "nfl");
  const nflDest = path.join(rootDir, "public", "data", "nfl");
  const nflQbPuzzleSrc = path.join(rootDir, "data", "puzzles", "nfl", "qb");
  const nflQbPuzzleDest = path.join(
    rootDir,
    "public",
    "data",
    "puzzles",
    "nfl",
    "qb",
  );
  const nflWrPuzzleSrc = path.join(rootDir, "data", "puzzles", "nfl", "wr");
  const nflWrPuzzleDest = path.join(
    rootDir,
    "public",
    "data",
    "puzzles",
    "nfl",
    "wr",
  );
  const nflRbPuzzleSrc = path.join(rootDir, "data", "puzzles", "nfl", "rb");
  const nflRbPuzzleDest = path.join(
    rootDir,
    "public",
    "data",
    "puzzles",
    "nfl",
    "rb",
  );
  const mlbSrc = path.join(rootDir, "data", "mlb");
  const mlbDest = path.join(rootDir, "public", "data", "mlb");
  const mlbHitterPuzzleSrc = path.join(rootDir, "data", "puzzles", "mlb", "hitter");
  const mlbHitterPuzzleDest = path.join(
    rootDir,
    "public",
    "data",
    "puzzles",
    "mlb",
    "hitter",
  );
  const mlbPitcherPuzzleSrc = path.join(rootDir, "data", "puzzles", "mlb", "pitcher");
  const mlbPitcherPuzzleDest = path.join(
    rootDir,
    "public",
    "data",
    "puzzles",
    "mlb",
    "pitcher",
  );

  for (const file of ["bios.json", "seasons.json", "metadata.json"]) {
    await copyFileEnsuringDir(path.join(nbaSrc, file), path.join(nbaDest, file));
    await copyFileEnsuringDir(path.join(nflSrc, file), path.join(nflDest, file));
    try {
      await copyFileEnsuringDir(path.join(mlbSrc, file), path.join(mlbDest, file));
    } catch {
      // MLB data is optional until the pipeline has been run.
    }
  }

  const nbaPuzzles = await syncJsonDir(nbaPuzzleSrc, nbaPuzzleDest, {
    skipSolutionFiles: true,
  });
  const nflQbPuzzles = await syncJsonDir(nflQbPuzzleSrc, nflQbPuzzleDest, {
    skipSolutionFiles: true,
  });
  const nflWrPuzzles = await syncJsonDir(nflWrPuzzleSrc, nflWrPuzzleDest, {
    skipSolutionFiles: true,
  });
  const nflRbPuzzles = await syncJsonDir(nflRbPuzzleSrc, nflRbPuzzleDest, {
    skipSolutionFiles: true,
  });

  const mlbHitterPuzzles = await syncJsonDir(
    mlbHitterPuzzleSrc,
    mlbHitterPuzzleDest,
    { skipSolutionFiles: true },
  );
  const mlbPitcherPuzzles = await syncJsonDir(
    mlbPitcherPuzzleSrc,
    mlbPitcherPuzzleDest,
    { skipSolutionFiles: true },
  );

  console.log(
    `Synced data to public/data/ (NBA: ${nbaPuzzles}, NFL QB: ${nflQbPuzzles}, NFL WR: ${nflWrPuzzles}, NFL RB: ${nflRbPuzzles}, MLB H: ${mlbHitterPuzzles}, MLB P: ${mlbPitcherPuzzles})`,
  );

  const index = await buildPuzzleArchiveIndex();
  const payload = `${JSON.stringify(index, null, 2)}\n`;
  for (const dest of [
    path.join(rootDir, "data", "puzzles", "index.json"),
    path.join(rootDir, "public", "data", "puzzles", "index.json"),
  ]) {
    await mkdir(path.dirname(dest), { recursive: true });
    await writeFile(dest, payload, "utf8");
  }
  console.log("Updated puzzle archive index.");
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
