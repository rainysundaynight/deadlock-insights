/** Badge = tier*10 + subrank (1..6). Linear step index for averaging. */
export const badgeToIdx = (b: number) => Math.floor(b / 10) * 6 + ((b % 10) - 1);
export const idxToBadge = (i: number) => {
  const r = Math.max(6, Math.min(11 * 6 + 5, Math.round(i)));
  return Math.floor(r / 6) * 10 + (r % 6) + 1;
};

/**
 * Potential rank for an unranked player: median rank of the people matchmaking put them with
 * (teammates + opponents across recent matches), nudged by recent winrate
 * (+1 subrank per 5% above 50%, capped at ±3).
 */
export function potentialBadge(lobbyBadges: number[], winrate: number): number | null {
  const valid = lobbyBadges.filter((b) => b >= 11 && b % 10 >= 1 && b % 10 <= 6);
  if (valid.length < 5) return null;
  const idx = valid.map(badgeToIdx).sort((a, b) => a - b);
  const at = (i: number) => idx[i] ?? 0;
  const mid = idx.length % 2 ? at((idx.length - 1) / 2) : (at(idx.length / 2 - 1) + at(idx.length / 2)) / 2;
  const shift = Math.max(-3, Math.min(3, Math.round((winrate - 0.5) / 0.05)));
  return idxToBadge(mid + shift);
}
