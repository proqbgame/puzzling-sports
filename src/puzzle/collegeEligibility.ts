import {
  isKnownProClub,
  isRecognizableProClub,
} from "./recognizableProClubs.js";

/** Bios that expose a college field (NBA, NFL, etc.). */
export type BioWithCollege = { college: string | null };

/** Minimum distinct players required to use a college label on the outer shell. */
export const MIN_SHELL_COLLEGE_PLAYERS = 2;

export function buildCollegePlayerCountMap(
  bios: Record<string, BioWithCollege>,
): ReadonlyMap<string, number> {
  const counts = new Map<string, number>();

  for (const bio of Object.values(bios)) {
    if (!bio.college) {
      continue;
    }
    counts.set(bio.college, (counts.get(bio.college) ?? 0) + 1);
  }

  return counts;
}

export function getCollegePlayerCount(
  school: string,
  counts: ReadonlyMap<string, number>,
): number {
  return counts.get(school) ?? 0;
}

/**
 * Whether a college label may appear as an outer-shell criterion.
 * US colleges need only meet the player-count floor; pro clubs must also be recognizable.
 */
export function isShellEligibleCollege(
  school: string,
  counts: ReadonlyMap<string, number>,
): boolean {
  if (getCollegePlayerCount(school, counts) < MIN_SHELL_COLLEGE_PLAYERS) {
    return false;
  }

  if (isKnownProClub(school)) {
    return isRecognizableProClub(school);
  }

  return true;
}

export function filterShellEligibleColleges(
  schools: Iterable<string>,
  counts: ReadonlyMap<string, number>,
): Set<string> {
  const eligible = new Set<string>();

  for (const school of schools) {
    if (isShellEligibleCollege(school, counts)) {
      eligible.add(school);
    }
  }

  return eligible;
}
