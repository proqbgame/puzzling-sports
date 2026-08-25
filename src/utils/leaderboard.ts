import type { PuzzleGridKey } from "../puzzle/archiveIndex.js";

export function puzzleKeyFor(
  gridKey: PuzzleGridKey,
  date: string,
): string {
  return `${gridKey}:${date}`;
}

export function puzzleDisplayName(
  sport: "nba" | "nfl" | "mlb",
  nflPosition: "qb" | "wr" | "rb" = "qb",
  mlbPosition: "pitcher" | "hitter" = "hitter",
): string {
  if (sport === "nba") {
    return "NBA puzzle";
  }
  if (sport === "nfl") {
    return `NFL ${nflPosition.toUpperCase()} puzzle`;
  }
  return mlbPosition === "pitcher" ? "MLB Pitcher puzzle" : "MLB Batter puzzle";
}

export function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function formatOrdinal(n: number): string {
  const abs = Math.abs(n);
  const mod100 = abs % 100;
  if (mod100 >= 11 && mod100 <= 13) {
    return `${n}th`;
  }
  switch (abs % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}

const PLAYER_ID_KEY = "ps.playerId";

type BrowserStorage = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
};

function getBrowserStorage(): BrowserStorage | null {
  try {
    const root = globalThis as { localStorage?: BrowserStorage };
    return root.localStorage ?? null;
  } catch {
    return null;
  }
}

export function getOrCreatePlayerId(): string {
  const storage = getBrowserStorage();
  try {
    const existing = storage?.getItem(PLAYER_ID_KEY) ?? null;
    if (existing && /^[a-zA-Z0-9_-]{8,64}$/.test(existing)) {
      return existing;
    }
    const id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID().replace(/-/g, "")
        : `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
    storage?.setItem(PLAYER_ID_KEY, id);
    return id;
  } catch {
    return `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
  }
}

export interface LeaderboardResult {
  rank: number;
  total: number;
  timeMs: number;
  bestTimeMs: number;
}

export async function submitCompletionTime(
  puzzleKey: string,
  timeMs: number,
): Promise<LeaderboardResult | null> {
  try {
    const response = await fetch("/api/leaderboard", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        puzzleKey,
        timeMs,
        playerId: getOrCreatePlayerId(),
      }),
    });

    if (response.ok) {
      const data = (await response.json()) as LeaderboardResult & {
        error?: string;
      };
      if (!data.error && data.rank && data.total) {
        return data;
      }
    }
  } catch {
    // Fall through to local standings.
  }

  return submitLocalCompletionTime(puzzleKey, timeMs);
}

const LOCAL_LB_KEY = "ps.localLeaderboard";

function submitLocalCompletionTime(
  puzzleKey: string,
  timeMs: number,
): LeaderboardResult {
  const playerId = getOrCreatePlayerId();
  const storage = getBrowserStorage();
  let store: Record<string, Record<string, number>> = {};
  try {
    store = JSON.parse(storage?.getItem(LOCAL_LB_KEY) ?? "{}") as Record<
      string,
      Record<string, number>
    >;
  } catch {
    store = {};
  }

  const board = { ...(store[puzzleKey] ?? {}) };
  const previous = board[playerId];
  if (previous === undefined || timeMs < previous) {
    board[playerId] = timeMs;
  }
  store[puzzleKey] = board;
  try {
    storage?.setItem(LOCAL_LB_KEY, JSON.stringify(store));
  } catch {
    // Ignore quota errors; still return a rank for this session.
  }

  const bestTimeMs = board[playerId];
  const sorted = Object.values(board).sort((a, b) => a - b);
  const rank = sorted.findIndex((value) => value === bestTimeMs) + 1;
  return {
    rank: rank > 0 ? rank : sorted.length,
    total: sorted.length,
    timeMs,
    bestTimeMs,
  };
}
