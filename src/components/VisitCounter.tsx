import { useEffect, useState } from "react";

const SESSION_FLAG = "ps.visitCounted";

function formatCount(count: number): string {
  return count.toLocaleString();
}

export function VisitCounter() {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function track(): Promise<void> {
      let alreadyCounted = false;
      try {
        alreadyCounted = window.sessionStorage.getItem(SESSION_FLAG) === "1";
      } catch {
        alreadyCounted = false;
      }

      try {
        const response = await fetch("/api/visits", {
          method: alreadyCounted ? "GET" : "POST",
        });
        if (!response.ok) {
          return;
        }
        const data = (await response.json()) as {
          count?: number;
          error?: string;
        };
        if (cancelled || data.error || typeof data.count !== "number") {
          return;
        }
        setCount(data.count);
        if (!alreadyCounted) {
          try {
            window.sessionStorage.setItem(SESSION_FLAG, "1");
          } catch {
            // ignore
          }
        }
      } catch {
        // Hide quietly if tracking is unavailable.
      }
    }

    void track();
    return () => {
      cancelled = true;
    };
  }, []);

  if (count === null) {
    return null;
  }

  return (
    <p className="home-visit-counter" aria-live="polite">
      <strong>{formatCount(count)}</strong> All time plays
    </p>
  );
}
