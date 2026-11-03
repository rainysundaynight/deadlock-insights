export type Tier = "S" | "A" | "B" | "C" | "D";

export interface TierInput { hero_id: number; wins: number; matches: number }
export interface TierRow extends TierInput { winrate: number; pickrate: number; score: number; tier: Tier }

/** Bayesian-smoothed winrate: few matches pull towards 50%. */
export function smoothedWinrate(wins: number, matches: number, prior = 200) {
  return (wins + prior * 0.5) / (matches + prior);
}

/** Tier from smoothed winrate (pp above 50%) plus a small popularity bonus. */
export function tierFor(score: number): Tier {
  if (score >= 3) return "S";
  if (score >= 1.5) return "A";
  if (score >= -0.5) return "B";
  if (score >= -2) return "C";
  return "D";
}

export function buildTierList(rows: TierInput[]): TierRow[] {
  const total = rows.reduce((s, r) => s + r.matches, 0) || 1;
  const avgPick = 1 / Math.max(1, rows.length);
  return rows
    .map((r) => {
      const winrate = r.matches ? r.wins / r.matches : 0;
      const pickrate = r.matches / total;
      const wrPts = (smoothedWinrate(r.wins, r.matches) - 0.5) * 100;
      const popBonus = Math.max(-1, Math.min(1, Math.log2(pickrate / avgPick))) * 0.75;
      const score = wrPts + popBonus;
      return { ...r, winrate, pickrate, score, tier: tierFor(score) };
    })
    .sort((a, b) => b.score - a.score);
}
