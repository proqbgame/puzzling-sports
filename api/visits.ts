/**
 * Vercel Edge API — global site visit counter.
 *
 * POST → increments and returns { count }
 * GET  → returns { count } without incrementing
 */

export const config = { runtime: "edge" };

const COUNTER_KEY = "ps:visits:total";

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
  const url = (process.env.UPSTASH_REDIS_REST_URL ?? "")
    .trim()
    .replace(/^['"]|['"]$/g, "");
  const token = (process.env.UPSTASH_REDIS_REST_TOKEN ?? "")
    .trim()
    .replace(/^['"]|['"]$/g, "");
  if (!url || !token) {
    return null;
  }
  try {
    // eslint-disable-next-line no-new
    new URL(url);
  } catch {
    return null;
  }
  if (!url.startsWith("https://")) {
    return null;
  }
  return { url, token };
}

export default async function handler(request: Request): Promise<Response> {
  const creds = redisConfigured();
  if (!creds) {
    return json(
      {
        error: "visits_unconfigured",
        message: "Visit tracking is not connected yet.",
      },
      503,
    );
  }

  try {
    if (request.method === "GET") {
      const raw = await redis(creds.url, creds.token, ["GET", COUNTER_KEY]);
      const count = Number(raw ?? 0);
      return json({
        count: Number.isFinite(count) ? count : 0,
      });
    }

    if (request.method !== "POST") {
      return json({ error: "method_not_allowed" }, 405);
    }

    const raw = await redis(creds.url, creds.token, ["INCR", COUNTER_KEY]);
    const count = Number(raw ?? 0);
    return json({
      count: Number.isFinite(count) ? count : 0,
    });
  } catch (error) {
    return json(
      {
        error: "visits_failed",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      500,
    );
  }
}
