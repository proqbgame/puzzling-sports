/**
 * Vercel Edge API — daily puzzle completion leaderboard.
 *
 * Requires Upstash Redis env vars on Vercel:
 *   UPSTASH_REDIS_REST_URL
 *   UPSTASH_REDIS_REST_TOKEN
 *
 * POST { puzzleKey, timeMs, playerId } → { rank, total, timeMs, bestTimeMs }
 * GET  ?puzzleKey=… → { total }
 */

export const config = { runtime: "edge" };

const MIN_TIME_MS = 1_000;
const MAX_TIME_MS = 24 * 60 * 60 * 1000;
const KEY_RE = /^[a-z0-9-]+:\d{4}-\d{2}-\d{2}$/;
const PLAYER_RE = /^[a-zA-Z0-9_-]{8,64}$/;

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
      const puzzleKey = new URL(request.url).searchParams.get("puzzleKey") ?? "";
      if (!KEY_RE.test(puzzleKey)) {
        return json({ error: "invalid_puzzle_key" }, 400);
      }
      const total = Number(
        (await redis(creds.url, creds.token, [
          "ZCARD",
          boardKey(puzzleKey),
        ])) ?? 0,
      );
      return json({ puzzleKey, total });
    }

    if (request.method !== "POST") {
      return json({ error: "method_not_allowed" }, 405);
    }

    const body = (await request.json()) as {
      puzzleKey?: string;
      timeMs?: number;
      playerId?: string;
    };

    const puzzleKey = body.puzzleKey?.trim() ?? "";
    const playerId = body.playerId?.trim() ?? "";
    const timeMs = Math.round(Number(body.timeMs));

    if (!KEY_RE.test(puzzleKey) || !PLAYER_RE.test(playerId)) {
      return json({ error: "invalid_request" }, 400);
    }
    if (!Number.isFinite(timeMs) || timeMs < MIN_TIME_MS || timeMs > MAX_TIME_MS) {
      return json({ error: "invalid_time" }, 400);
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

    const bestRaw = await redis(creds.url, creds.token, ["ZSCORE", key, playerId]);
    const bestTimeMs = Number(bestRaw);
    const rankIndex = Number(
      await redis(creds.url, creds.token, ["ZRANK", key, playerId]),
    );
    const total = Number(await redis(creds.url, creds.token, ["ZCARD", key]));

    return json({
      puzzleKey,
      timeMs,
      bestTimeMs,
      rank: rankIndex + 1,
      total,
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
