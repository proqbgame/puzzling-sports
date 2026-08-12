type NbaHeadshotSize = "260x190" | "1040x760";

/** NBA CDN headshot from the league player id used as `playerId` in bios. */
export function headshotUrl(
  playerId: string,
  size: NbaHeadshotSize = "260x190",
) {
  return `https://cdn.nba.com/headshots/nba/latest/${size}/${playerId}.png`;
}

/** ESPN CDN headshot; requires espnId from NFL bios (not GSIS id). */
export function nflHeadshotUrl(espnId: string) {
  return `https://a.espncdn.com/i/headshots/nfl/players/full/${espnId}.png`;
}

/**
 * Resolve a headshot URL for the active sport.
 * Returns null when NFL espnId is missing (caller should keep letter/initial UI).
 */
export function headshotUrlForSport(
  sport: "nba" | "nfl",
  playerId: string,
  espnId?: string | null,
): string | null {
  if (sport === "nba") {
    return headshotUrl(playerId);
  }
  if (!espnId) {
    return null;
  }
  return nflHeadshotUrl(espnId);
}
