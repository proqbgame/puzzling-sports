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

export const RECORD_BOOK_GRIDS: readonly {
  gridKey: PuzzleGridKey;
  label: string;
  detail: string;
}[] = [
  { gridKey: "nba", label: "NBA", detail: "All NBA daily puzzles" },
  { gridKey: "nfl-qb", label: "NFL QB", detail: "All quarterback puzzles" },
  { gridKey: "nfl-wr", label: "NFL WR", detail: "All wide receiver puzzles" },
  { gridKey: "nfl-rb", label: "NFL RB", detail: "All running back puzzles" },
  { gridKey: "mlb-hitter", label: "MLB Batter", detail: "All batter puzzles" },
  {
    gridKey: "mlb-pitcher",
    label: "MLB Pitcher",
    detail: "All pitcher puzzles",
  },
] as const;

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
  topTimeMs: number | null;
}

export interface GridRecord {
  gridKey: PuzzleGridKey;
  topTimeMs: number | null;
  puzzleKey: string | null;
}

export async function fetchTopTimeMs(puzzleKey: string): Promise<number | null> {
  try {
    const response = await fetch(
      `/api/leaderboard?puzzleKey=${encodeURIComponent(puzzleKey)}`,
    );
    if (response.ok) {
      const data = (await response.json()) as {
        topTimeMs?: number | null;
        error?: string;
      };
      if (!data.error && typeof data.topTimeMs === "number") {
        return data.topTimeMs;
      }
      if (!data.error && data.topTimeMs === null) {
        return null;
      }
    }
  } catch {
    // Fall through to local standings.
  }
  return getLocalTopTimeMs(puzzleKey);
}

export async function fetchAllTimeRecords(): Promise<GridRecord[]> {
  try {
    const response = await fetch("/api/leaderboard?scope=records");
    if (response.ok) {
      const data = (await response.json()) as {
        records?: GridRecord[];
        error?: string;
      };
      if (!data.error && Array.isArray(data.records)) {
        return RECORD_BOOK_GRIDS.map((entry) => {
          const match = data.records?.find(
            (record) => record.gridKey === entry.gridKey,
          );
          return {
            gridKey: entry.gridKey,
            topTimeMs:
              typeof match?.topTimeMs === "number" ? match.topTimeMs : null,
            puzzleKey:
              typeof match?.puzzleKey === "string" ? match.puzzleKey : null,
          };
        });
      }
    }
  } catch {
    // Fall through to local standings.
  }
  return getLocalAllTimeRecords();
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
        return {
          ...data,
          topTimeMs:
            typeof data.topTimeMs === "number" ? data.topTimeMs : data.bestTimeMs,
        };
      }
    }
  } catch {
    // Fall through to local standings.
  }

  return submitLocalCompletionTime(puzzleKey, timeMs);
}

const LOCAL_LB_KEY = "ps.localLeaderboard";
const LOCAL_ALLTIME_KEY = "ps.localAllTimeRecords";

function readLocalBoard(puzzleKey: string): Record<string, number> {
  const storage = getBrowserStorage();
  try {
    const store = JSON.parse(storage?.getItem(LOCAL_LB_KEY) ?? "{}") as Record<
      string,
      Record<string, number>
    >;
    return { ...(store[puzzleKey] ?? {}) };
  } catch {
    return {};
  }
}

function getLocalTopTimeMs(puzzleKey: string): number | null {
  const values = Object.values(readLocalBoard(puzzleKey));
  if (values.length === 0) {
    return null;
  }
  return Math.min(...values);
}

function readLocalAllTimeStore(): Partial<
  Record<PuzzleGridKey, { timeMs: number; puzzleKey: string }>
> {
  const storage = getBrowserStorage();
  try {
    return JSON.parse(storage?.getItem(LOCAL_ALLTIME_KEY) ?? "{}") as Partial<
      Record<PuzzleGridKey, { timeMs: number; puzzleKey: string }>
    >;
  } catch {
    return {};
  }
}

function writeLocalAllTimeStore(
  store: Partial<Record<PuzzleGridKey, { timeMs: number; puzzleKey: string }>>,
): void {
  const storage = getBrowserStorage();
  try {
    storage?.setItem(LOCAL_ALLTIME_KEY, JSON.stringify(store));
  } catch {
    // Ignore quota errors.
  }
}

function updateLocalAllTimeRecord(puzzleKey: string, timeMs: number): void {
  const gridKey = puzzleKey.split(":")[0] as PuzzleGridKey;
  if (!RECORD_BOOK_GRIDS.some((entry) => entry.gridKey === gridKey)) {
    return;
  }
  const store = readLocalAllTimeStore();
  const existing = store[gridKey];
  if (existing && existing.timeMs <= timeMs) {
    return;
  }
  store[gridKey] = { timeMs, puzzleKey };
  writeLocalAllTimeStore(store);
}

function getLocalAllTimeRecords(): GridRecord[] {
  const store = readLocalAllTimeStore();

  // Also derive from any daily local boards (covers older local completions).
  const storage = getBrowserStorage();
  let dailyStore: Record<string, Record<string, number>> = {};
  try {
    dailyStore = JSON.parse(storage?.getItem(LOCAL_LB_KEY) ?? "{}") as Record<
      string,
      Record<string, number>
    >;
  } catch {
    dailyStore = {};
  }

  for (const [puzzleKey, board] of Object.entries(dailyStore)) {
    const values = Object.values(board);
    if (values.length === 0) {
      continue;
    }
    const top = Math.min(...values);
    updateLocalAllTimeRecord(puzzleKey, top);
  }

  const refreshed = readLocalAllTimeStore();
  return RECORD_BOOK_GRIDS.map((entry) => {
    const match = refreshed[entry.gridKey] ?? store[entry.gridKey];
    return {
      gridKey: entry.gridKey,
      topTimeMs: match?.timeMs ?? null,
      puzzleKey: match?.puzzleKey ?? null,
    };
  });
}

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

  updateLocalAllTimeRecord(puzzleKey, timeMs);

  const bestTimeMs = board[playerId];
  const sorted = Object.values(board).sort((a, b) => a - b);
  const rank = sorted.findIndex((value) => value === bestTimeMs) + 1;
  return {
    rank: rank > 0 ? rank : sorted.length,
    total: sorted.length,
    timeMs,
    bestTimeMs,
    topTimeMs: sorted[0] ?? null,
  };
}
