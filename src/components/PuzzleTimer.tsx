import { useEffect, useRef, useState } from "react";
import { fetchTopTimeMs, formatDuration } from "../utils/leaderboard.js";

interface PuzzleTimerProps {
  /** Unique per puzzle day + sport grid; resets the timer when it changes. */
  storageKey: string;
  running: boolean;
  /** Optional override after a new personal/global best is known. */
  topTimeMs?: number | null;
  onStop?: (elapsedMs: number) => void;
}

function elapsedStorageKey(storageKey: string): string {
  return `ps.timer.elapsed:${storageKey}`;
}

function doneStorageKey(storageKey: string): string {
  return `ps.timer.done:${storageKey}`;
}

function readStoredElapsed(storageKey: string): number {
  try {
    const saved = window.sessionStorage.getItem(elapsedStorageKey(storageKey));
    if (saved && Number.isFinite(Number(saved))) {
      return Math.max(0, Number(saved));
    }
    // Drop legacy wall-clock start keys so home-page time is not counted.
    window.sessionStorage.removeItem(`ps.timer.start:${storageKey}`);
  } catch {
    // ignore storage failures
  }
  return 0;
}

function writeStoredElapsed(storageKey: string, elapsedMs: number): void {
  try {
    window.sessionStorage.setItem(
      elapsedStorageKey(storageKey),
      String(Math.max(0, elapsedMs)),
    );
    window.sessionStorage.removeItem(`ps.timer.start:${storageKey}`);
  } catch {
    // ignore storage failures
  }
}

function readStoredDone(storageKey: string): boolean {
  try {
    return window.sessionStorage.getItem(doneStorageKey(storageKey)) === "1";
  } catch {
    return false;
  }
}

function writeStoredDone(storageKey: string, done: boolean): void {
  try {
    if (done) {
      window.sessionStorage.setItem(doneStorageKey(storageKey), "1");
    } else {
      window.sessionStorage.removeItem(doneStorageKey(storageKey));
    }
  } catch {
    // ignore storage failures
  }
}

export function PuzzleTimer({
  storageKey,
  running,
  topTimeMs: topTimeOverride,
  onStop,
}: PuzzleTimerProps) {
  const [elapsedMs, setElapsedMs] = useState(0);
  const [fetchedTopTimeMs, setFetchedTopTimeMs] = useState<number | null>(null);
  const startedAtRef = useRef<number | null>(null);
  const frozenRef = useRef(false);
  const onStopRef = useRef(onStop);
  onStopRef.current = onStop;

  useEffect(() => {
    const accumulated = readStoredElapsed(storageKey);
    const wasDone = readStoredDone(storageKey);

    frozenRef.current = wasDone;
    startedAtRef.current = Date.now() - accumulated;
    setElapsedMs(accumulated);

    return () => {
      if (frozenRef.current || startedAtRef.current === null) {
        return;
      }
      const ms = Math.max(0, Date.now() - startedAtRef.current);
      writeStoredElapsed(storageKey, ms);
    };
  }, [storageKey]);

  useEffect(() => {
    let cancelled = false;
    setFetchedTopTimeMs(null);
    void fetchTopTimeMs(storageKey).then((top) => {
      if (!cancelled) {
        setFetchedTopTimeMs(top);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [storageKey]);

  useEffect(() => {
    if (!running) {
      if (!frozenRef.current && startedAtRef.current !== null) {
        frozenRef.current = true;
        const finalMs = Math.max(0, Date.now() - startedAtRef.current);
        setElapsedMs(finalMs);
        writeStoredElapsed(storageKey, finalMs);
        writeStoredDone(storageKey, true);
        onStopRef.current?.(finalMs);
      }
      return;
    }

    // New attempt after a prior finish in this browser session.
    if (frozenRef.current) {
      frozenRef.current = false;
      startedAtRef.current = Date.now();
      setElapsedMs(0);
      writeStoredElapsed(storageKey, 0);
      writeStoredDone(storageKey, false);
    }

    const tick = (): void => {
      if (startedAtRef.current === null) {
        return;
      }
      setElapsedMs(Math.max(0, Date.now() - startedAtRef.current));
    };
    tick();
    const id = window.setInterval(tick, 250);
    return () => window.clearInterval(id);
  }, [running, storageKey]);

  const topTimeMs =
    typeof topTimeOverride === "number" ? topTimeOverride : fetchedTopTimeMs;

  return (
    <div className="puzzle-timer-stack" aria-live="polite">
      <div className="puzzle-timer" aria-label="Puzzle timer">
        <span className="puzzle-timer-label">Time</span>
        <span className="puzzle-timer-value">{formatDuration(elapsedMs)}</span>
      </div>
      <div className="puzzle-timer puzzle-timer-beat" aria-label="Time to beat">
        <span className="puzzle-timer-label">Time to beat</span>
        <span className="puzzle-timer-value">
          {typeof topTimeMs === "number" ? formatDuration(topTimeMs) : "—"}
        </span>
      </div>
    </div>
  );
}
