/**
 * Normalize player names for lookup (case-insensitive, punctuation-insensitive).
 */

export function normalizePlayerName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[.'’`-]/g, "")
    .replace(/\s+/g, " ");
}

/** Convert "Chamberlain, Wilt" -> "Wilt Chamberlain" before normalization. */
export function formatPlayerNameInput(name: string): string {
  const trimmed = name.trim();
  if (!trimmed.includes(",")) {
    return trimmed;
  }

  const [last, first] = trimmed.split(",", 2);
  return `${first.trim()} ${last.trim()}`.trim();
}
