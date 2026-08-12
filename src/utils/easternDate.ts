/** Calendar helpers for America/New_York (EST/EDT). */

export const EASTERN_TIMEZONE = "America/New_York";

/** Today's date in Eastern time as YYYY-MM-DD. */
export function easternTodayIso(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: EASTERN_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** Current hour in Eastern time (0–23). */
export function easternHour(now: Date = new Date()): number {
  const hourPart = new Intl.DateTimeFormat("en-US", {
    timeZone: EASTERN_TIMEZONE,
    hour: "numeric",
    hourCycle: "h23",
  })
    .formatToParts(now)
    .find((part) => part.type === "hour");

  return Number(hourPart?.value ?? "0");
}

/** True when Eastern local time is in the midnight hour (00:00–00:59). */
export function isEasternMidnightHour(now: Date = new Date()): boolean {
  return easternHour(now) === 0;
}
