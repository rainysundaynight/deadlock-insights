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

import { api, type MatchHistoryEntry } from "@/lib/api";

const CACHE_TTL = 24 * 3600 * 1000;

/**
 * Estimated rank from the player's own recent matches (last 15): median badge of the people
 * they were matched with, nudged by winrate. Cached in localStorage for 24h so live tabs stay fast.
 */
export async function fetchPotentialBadge(accountId: number): Promise<number | null> {
  try {
    const raw = localStorage.getItem(`pot-rank:${accountId}`);
    if (raw) {
      const { badge, ts } = JSON.parse(raw) as { badge: number | null; ts: number };
      if (Date.now() - ts < CACHE_TTL) return badge;
    }
  } catch { /* corrupted cache */ }
  const history = await api<MatchHistoryEntry[]>(`/v1/players/${accountId}/match-history`).catch(() => []);
  const recent = history.slice(0, 15);
  let badge: number | null = null;
  if (recent.length) {
    const metas = await api<{ players: { account_id: number }[] }[]>("/v1/matches/metadata", {
      include_player_info: true, match_ids: recent.map((m) => m.match_id).join(","), limit: 15,
    }).catch(() => []);
    const ids = [...new Set(metas.flatMap((m) => m.players.map((p) => p.account_id)))].filter((x) => x && x !== accountId).slice(0, 100);
    if (ids.length) {
      const ranks = await api<{ badge: number | null }[]>("/v1/players/rank", { account_ids: ids.join(",") }).catch(() => []);
      const wr = recent.filter((m) => m.match_result === m.player_team).length / recent.length;
      badge = potentialBadge(ranks.map((r) => r.badge ?? 0), wr);
    }
  }
  try { localStorage.setItem(`pot-rank:${accountId}`, JSON.stringify({ badge, ts: Date.now() })); } catch { /* storage full */ }
  return badge;
}
