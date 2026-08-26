/**
 * Vercel Edge API — daily puzzle completion leaderboard + all-time records.
 *
 * Requires Upstash Redis env vars on Vercel:
 *   UPSTASH_REDIS_REST_URL
 *   UPSTASH_REDIS_REST_TOKEN
 *
 * POST { puzzleKey, timeMs, playerId, mode } →
 *   { rank, total, timeMs, bestTimeMs, topTimeMs, madeRecordBook }
 * GET  ?puzzleKey=… → { total, topTimeMs }
 * GET  ?scope=records → { records: [{ gridKey, mode, topTimeMs, puzzleKey }] }
 */

export const config = { runtime: "edge" };

const MIN_TIME_MS = 1_000;
const MAX_TIME_MS = 24 * 60 * 60 * 1000;
const KEY_RE = /^[a-z0-9-]+:\d{4}-\d{2}-\d{2}$/;
const PLAYER_RE = /^[a-zA-Z0-9_-]{8,64}$/;
const MODES = ["easy", "hard"] as const;
const GRID_KEYS = [
  "nba",
  "nfl-qb",
  "nfl-wr",
  "nfl-rb",
  "mlb-pitcher",
  "mlb-hitter",
] as const;

type GridKey = (typeof GRID_KEYS)[number];
type GameMode = (typeof MODES)[number];

type RedisResult = { result: unknown };

async function redis(
  url: string,
  token: string,
  command: (string | number)[],
): Promise<unknown> {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(command),
  });
  if (!response.ok) {
    throw new Error(`Redis error (${response.status})`);
  }
  const payload = (await response.json()) as RedisResult;
  return payload.result;
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}

function redisConfigured():
  | { url: string; token: string }
  | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    return null;
  }
  return { url, token };
}

function boardKey(puzzleKey: string): string {
  return `ps:lb:${puzzleKey}`;
}

function allTimeKey(gridKey: string, mode: GameMode): string {
  return `ps:alltime:${gridKey}:${mode}`;
}

function legacyAllTimeKey(gridKey: string): string {
  return `ps:alltime:${gridKey}`;
}

function gridKeyFromPuzzleKey(puzzleKey: string): GridKey | null {
  const gridKey = puzzleKey.split(":")[0] ?? "";
  return (GRID_KEYS as readonly string[]).includes(gridKey)
    ? (gridKey as GridKey)
    : null;
}

function parseMode(value: unknown): GameMode {
  return value === "hard" ? "hard" : "easy";
}

async function readTopTimeMs(
  url: string,
  token: string,
  key: string,
): Promise<number | null> {
  const top = await redis(url, token, ["ZRANGE", key, 0, 0, "WITHSCORES"]);
  if (!Array.isArray(top) || top.length < 2) {
    return null;
  }
  const score = Number(top[1]);
  return Number.isFinite(score) ? score : null;
}

type AllTimeRecord = {
  timeMs: number;
  puzzleKey: string;
  playerId: string;
  mode: GameMode;
  updatedAt: string;
};

async function parseAllTimeRecord(
  raw: unknown,
  fallbackMode: GameMode,
): Promise<AllTimeRecord | null> {
  if (typeof raw !== "string" || !raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as AllTimeRecord;
    if (
      typeof parsed.timeMs === "number" &&
      Number.isFinite(parsed.timeMs) &&
      typeof parsed.puzzleKey === "string"
    ) {
      return {
        ...parsed,
        mode: parsed.mode === "hard" || parsed.mode === "easy"
          ? parsed.mode
          : fallbackMode,
        playerId:
          typeof parsed.playerId === "string" ? parsed.playerId : "unknown",
        updatedAt:
          typeof parsed.updatedAt === "string"
            ? parsed.updatedAt
            : new Date().toISOString(),
      };
    }
  } catch {
    // ignore bad payloads
  }
  return null;
}

async function readAllTimeRecord(
  url: string,
  token: string,
  gridKey: GridKey,
  mode: GameMode,
): Promise<AllTimeRecord | null> {
  const scoped = await parseAllTimeRecord(
    await redis(url, token, ["GET", allTimeKey(gridKey, mode)]),
    mode,
  );
  if (scoped) {
    return scoped;
  }

  // Pre-mode records lived at ps:alltime:{gridKey}; treat as Easy.
  if (mode !== "easy") {
    return null;
  }
  const legacy = await parseAllTimeRecord(
    await redis(url, token, ["GET", legacyAllTimeKey(gridKey)]),
    "easy",
  );
  if (!legacy) {
    return null;
  }

  // Migrate into the mode-scoped key so phones and desktops share one source.
  await redis(url, token, [
    "SET",
    allTimeKey(gridKey, "easy"),
    JSON.stringify({ ...legacy, mode: "easy" }),
  ]);
  return legacy;
}

async function maybeUpdateAllTimeRecord(
  url: string,
  token: string,
  gridKey: GridKey,
  mode: GameMode,
  timeMs: number,
  puzzleKey: string,
  playerId: string,
): Promise<boolean> {
  const existing = await readAllTimeRecord(url, token, gridKey, mode);
  if (existing && existing.timeMs <= timeMs) {
    return false;
  }
  const next: AllTimeRecord = {
    timeMs,
    puzzleKey,
    playerId,
    mode,
    updatedAt: new Date().toISOString(),
  };
  await redis(url, token, [
    "SET",
    allTimeKey(gridKey, mode),
    JSON.stringify(next),
  ]);
  return true;
}

export default async function handler(request: Request): Promise<Response> {
  const creds = redisConfigured();
  if (!creds) {
    return json(
      {
        error: "leaderboard_unconfigured",
        message: "Daily rankings are not connected yet.",
      },
      503,
    );
  }

  try {
    if (request.method === "GET") {
      const params = new URL(request.url).searchParams;
      if (params.get("scope") === "records") {
        const records = [];
        for (const mode of MODES) {
          for (const gridKey of GRID_KEYS) {
            const record = await readAllTimeRecord(
              creds.url,
              creds.token,
              gridKey,
              mode,
            );
            records.push({
              gridKey,
              mode,
              topTimeMs: record?.timeMs ?? null,
              puzzleKey: record?.puzzleKey ?? null,
            });
          }
        }
        return json({ records });
      }

      const puzzleKey = params.get("puzzleKey") ?? "";
      if (!KEY_RE.test(puzzleKey)) {
        return json({ error: "invalid_puzzle_key" }, 400);
      }
      const key = boardKey(puzzleKey);
      const total = Number(
        (await redis(creds.url, creds.token, ["ZCARD", key])) ?? 0,
      );
      const topTimeMs = await readTopTimeMs(creds.url, creds.token, key);
      return json({ puzzleKey, total, topTimeMs });
    }

    if (request.method !== "POST") {
      return json({ error: "method_not_allowed" }, 405);
    }

    const body = (await request.json()) as {
      puzzleKey?: string;
      timeMs?: number;
      playerId?: string;
      mode?: string;
      recordOnly?: boolean;
    };

    const puzzleKey = body.puzzleKey?.trim() ?? "";
    const playerId = body.playerId?.trim() ?? "";
    const timeMs = Math.round(Number(body.timeMs));
    const mode = parseMode(body.mode);
    const recordOnly = body.recordOnly === true;

    if (!KEY_RE.test(puzzleKey) || !PLAYER_RE.test(playerId)) {
      return json({ error: "invalid_request" }, 400);
    }
    if (!Number.isFinite(timeMs) || timeMs < MIN_TIME_MS || timeMs > MAX_TIME_MS) {
      return json({ error: "invalid_time" }, 400);
    }

    const gridKey = gridKeyFromPuzzleKey(puzzleKey);
    if (!gridKey) {
      return json({ error: "invalid_puzzle_key" }, 400);
    }

    if (recordOnly) {
      const madeRecordBook = await maybeUpdateAllTimeRecord(
        creds.url,
        creds.token,
        gridKey,
        mode,
        timeMs,
        puzzleKey,
        playerId,
      );
      const record = await readAllTimeRecord(
        creds.url,
        creds.token,
        gridKey,
        mode,
      );
      return json({
        puzzleKey,
        mode,
        madeRecordBook,
        topTimeMs: record?.timeMs ?? null,
      });
    }

    const key = boardKey(puzzleKey);
    const existing = await redis(creds.url, creds.token, ["ZSCORE", key, playerId]);
    const previous =
      existing === null || existing === undefined
        ? null
        : Number(existing);

    if (previous === null || timeMs < previous) {
      await redis(creds.url, creds.token, ["ZADD", key, timeMs, playerId]);
    }

    const madeRecordBook = await maybeUpdateAllTimeRecord(
      creds.url,
      creds.token,
      gridKey,
      mode,
      timeMs,
      puzzleKey,
      playerId,
    );

    const bestRaw = await redis(creds.url, creds.token, ["ZSCORE", key, playerId]);
    const bestTimeMs = Number(bestRaw);
    const rankIndex = Number(
      await redis(creds.url, creds.token, ["ZRANK", key, playerId]),
    );
    const total = Number(await redis(creds.url, creds.token, ["ZCARD", key]));
    const topTimeMs = await readTopTimeMs(creds.url, creds.token, key);

    return json({
      puzzleKey,
      timeMs,
      bestTimeMs,
      topTimeMs,
      rank: rankIndex + 1,
      total,
      madeRecordBook,
      mode,
    });
  } catch (error) {
    return json(
      {
        error: "leaderboard_failed",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      500,
    );
  }
}
