export interface DayRow { hero_id: number; bucket: number; wins: number; matches: number; matches_per_bucket?: number }

export interface HeroTrend { hero_id: number; recentWr: number; prevWr: number; delta: number; recentPick: number; prevPick: number; pickDelta: number; matches: number }

/** Compares the last `window` days against the `window` days before them. */
export function heroTrends(rows: DayRow[], window = 7, minMatches = 300): HeroTrend[] {
  const days = [...new Set(rows.map((r) => r.bucket))].sort((a, b) => a - b);
  const recent = new Set(days.slice(-window));
  const prev = new Set(days.slice(-window * 2, -window));
  const totals = (set: Set<number>) => {
    const seen = new Map<number, number>();
    for (const r of rows) if (set.has(r.bucket)) seen.set(r.bucket, r.matches_per_bucket ?? 0);
    return [...seen.values()].reduce((a, b) => a + b, 0) || 1;
  };
  const totR = totals(recent), totP = totals(prev);
  const agg = new Map<number, { rw: number; rm: number; pw: number; pm: number }>();
  for (const r of rows) {
    const a = agg.get(r.hero_id) ?? { rw: 0, rm: 0, pw: 0, pm: 0 };
    if (recent.has(r.bucket)) { a.rw += r.wins; a.rm += r.matches; }
    else if (prev.has(r.bucket)) { a.pw += r.wins; a.pm += r.matches; }
    agg.set(r.hero_id, a);
  }
  return [...agg.entries()]
    .filter(([, a]) => a.rm >= minMatches && a.pm >= minMatches)
    .map(([hero_id, a]) => {
      const recentWr = a.rw / a.rm, prevWr = a.pw / a.pm;
      const recentPick = a.rm / totR, prevPick = a.pm / totP;
      return { hero_id, recentWr, prevWr, delta: recentWr - prevWr, recentPick, prevPick, pickDelta: recentPick - prevPick, matches: a.rm };
    });
}
