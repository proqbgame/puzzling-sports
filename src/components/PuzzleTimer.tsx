import { useEffect, useRef, useState } from "react";
import { formatDuration } from "../utils/leaderboard.js";

interface PuzzleTimerProps {
  /** Unique per puzzle day + sport grid; resets the timer when it changes. */
  storageKey: string;
  running: boolean;
  onStop?: (elapsedMs: number) => void;
}

export function PuzzleTimer({ storageKey, running, onStop }: PuzzleTimerProps) {
  const [elapsedMs, setElapsedMs] = useState(0);
  const startedAtRef = useRef<number | null>(null);
  const frozenRef = useRef(false);
  const onStopRef = useRef(onStop);
  onStopRef.current = onStop;

  useEffect(() => {
    frozenRef.current = false;
    const sessionKey = `ps.timer.start:${storageKey}`;
    let startedAt: number;
    try {
      const saved = window.sessionStorage.getItem(sessionKey);
      if (saved && Number.isFinite(Number(saved))) {
        startedAt = Number(saved);
      } else {
        startedAt = Date.now();
        window.sessionStorage.setItem(sessionKey, String(startedAt));
      }
    } catch {
      startedAt = Date.now();
    }
    startedAtRef.current = startedAt;
    setElapsedMs(Math.max(0, Date.now() - startedAt));
  }, [storageKey]);

  useEffect(() => {
    if (!running) {
      if (!frozenRef.current && startedAtRef.current !== null) {
        frozenRef.current = true;
        const finalMs = Math.max(0, Date.now() - startedAtRef.current);
        setElapsedMs(finalMs);
        onStopRef.current?.(finalMs);
      }
      return;
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
  }, [running]);

  return (
    <div className="puzzle-timer" aria-live="polite" aria-label="Puzzle timer">
      <span className="puzzle-timer-label">Time</span>
      <span className="puzzle-timer-value">{formatDuration(elapsedMs)}</span>
    </div>
  );
}
