/**
 * Generate all daily grids for a date (NBA + NFL QB/WR/RB + MLB hitter/pitcher), sync public data,
 * and refresh the archive index.
 *
 * Defaults to today's date in America/New_York.
 *
 *   npm run generate:daily
 *   npm run generate:daily -- 2026-08-03
 *   npm run generate:daily -- --force
 *   npm run generate:daily -- 2026-08-03 --force
 *
 * Cron / CI: pass --if-missing (default) so re-runs are idempotent.
 */

import { access } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { easternTodayIso } from "../src/utils/easternDate.js";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

type GridSpec =
  | { kind: "nba"; label: string; file: string }
  | { kind: "nfl"; position: "qb" | "wr" | "rb"; label: string; file: string }
  | { kind: "mlb"; position: "pitcher" | "hitter"; label: string; file: string };

function parseArgs(argv: string[]): { date: string; force: boolean } {
  let force = false;
  let date: string | undefined;

  for (const arg of argv) {
    if (arg === "--force") {
      force = true;
      continue;
    }
    if (arg === "--if-missing") {
      force = false;
      continue;
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(arg)) {
      date = arg;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  return { date: date ?? easternTodayIso(), force };
}

function fileExists(filePath: string): Promise<boolean> {
  return access(filePath).then(
    () => true,
    () => false,
  );
}

function runNpmScript(script: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const npmBin = process.platform === "win32" ? "npm.cmd" : "npm";
    const child = spawn(npmBin, ["run", script, "--", ...args], {
      cwd: rootDir,
      stdio: "inherit",
      env: process.env,
      // Windows needs a shell to resolve npm.cmd reliably.
      shell: process.platform === "win32",
    });

    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`npm run ${script} exited with code ${code}`));
      }
    });
  });
}

async function main(): Promise<void> {
  const { date, force } = parseArgs(process.argv.slice(2));

  const grids: GridSpec[] = [
    {
      kind: "nba",
      label: "NBA",
      file: path.join(rootDir, "data", "puzzles", "nba", `${date}.json`),
    },
    {
      kind: "nfl",
      position: "qb",
      label: "NFL QB",
      file: path.join(rootDir, "data", "puzzles", "nfl", "qb", `${date}.json`),
    },
    {
      kind: "nfl",
      position: "wr",
      label: "NFL WR",
      file: path.join(rootDir, "data", "puzzles", "nfl", "wr", `${date}.json`),
    },
    {
      kind: "nfl",
      position: "rb",
      label: "NFL RB",
      file: path.join(rootDir, "data", "puzzles", "nfl", "rb", `${date}.json`),
    },
    {
      kind: "mlb",
      position: "hitter",
      label: "MLB Hitter",
      file: path.join(rootDir, "data", "puzzles", "mlb", "hitter", `${date}.json`),
    },
    {
      kind: "mlb",
      position: "pitcher",
      label: "MLB Pitcher",
      file: path.join(rootDir, "data", "puzzles", "mlb", "pitcher", `${date}.json`),
    },
  ];

  console.log(`Daily generate for ${date} (America/New_York)${force ? " [force]" : ""}`);

  for (const grid of grids) {
    if (!force && (await fileExists(grid.file))) {
      console.log(`  skip ${grid.label} — already exists`);
      continue;
    }

    if (grid.kind === "nba") {
      await runNpmScript("generate:puzzle", [date]);
    } else if (grid.kind === "mlb") {
      await runNpmScript("generate:mlb-puzzle", [date, grid.position]);
    } else {
      await runNpmScript("generate:nfl-puzzle", [date, grid.position]);
    }
  }

  await runNpmScript("sync:data", []);
  await runNpmScript("build:puzzle-index", []);
  console.log("Daily generate complete.");
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
