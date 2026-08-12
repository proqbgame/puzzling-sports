/** Simple seeded PRNG (Mulberry32) for reproducible daily puzzles. */

export function hashStringToSeed(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function createSeededRng(seed: number): () => number {
  let state = seed >>> 0;

  return () => {
    state += 0x6d2b79f5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffleInPlace<T>(items: T[], rng: () => number): T[] {
  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

export function pickRandom<T>(items: readonly T[], rng: () => number): T | undefined {
  if (items.length === 0) {
    return undefined;
  }
  return items[Math.floor(rng() * items.length)];
}

export function pickRandomMany<T>(
  items: readonly T[],
  count: number,
  rng: () => number,
): T[] {
  const copy = [...items];
  shuffleInPlace(copy, rng);
  return copy.slice(0, Math.min(count, copy.length));
}
