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

/** Official MLB.com headshot from the MLBAM people id. */
export function mlbHeadshotUrl(mlbamId: string) {
  return `https://img.mlbstatic.com/mlb-photos/image/upload/d_people:generic:headshot:67:current.png/w_213,q_auto:best/v1/people/${mlbamId}/headshot/67/current`;
}

/**
 * Resolve a headshot URL for the active sport.
 * Returns null when NFL espnId / MLB mlbamId is missing.
 */
export function headshotUrlForSport(
  sport: "nba" | "nfl" | "mlb",
  playerId: string,
  espnId?: string | null,
  mlbamId?: string | null,
): string | null {
  if (sport === "nba") {
    return headshotUrl(playerId);
  }
  if (sport === "mlb") {
    const id = (mlbamId ?? playerId).trim();
    if (!id || !/^\d+$/.test(id)) {
      return null;
    }
    return mlbHeadshotUrl(id);
  }
  if (!espnId) {
    return null;
  }
  return nflHeadshotUrl(espnId);
}
