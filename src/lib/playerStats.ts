import type { HeroAnalytics, MatchHistoryEntry } from "@/lib/api";

export interface PlayerSummary {
  n: number; wins: number; winrate: number;
  k: number; d: number; a: number; nw: number; lh: number; dn: number; dur: number;
  bestStreak: number; currentStreak: number; // + wins, - losses
  heroes: { hero_id: number; n: number; wins: number }[];
}

export const won = (m: MatchHistoryEntry) => m.match_result === m.player_team;
export const deviationFromAverage = (ratioPercent: number) => Math.round(ratioPercent - 100);

export function summarize(h: MatchHistoryEntry[]): PlayerSummary {
  const n = h.length || 1;
  const sum = (f: (m: MatchHistoryEntry) => number) => h.reduce((s, m) => s + f(m), 0) / n;
  const wins = h.filter(won).length;
  let best = 0, run = 0;
  [...h].reverse().forEach((m) => { run = won(m) ? run + 1 : 0; best = Math.max(best, run); });
  let cur = 0;
  for (const m of h) {
    if (cur === 0) cur = won(m) ? 1 : -1;
    else if (won(m) === cur > 0) cur += cur > 0 ? 1 : -1;
    else break;
  }
  const hm = new Map<number, { hero_id: number; n: number; wins: number }>();
  h.forEach((m) => {
    const e = hm.get(m.hero_id) ?? { hero_id: m.hero_id, n: 0, wins: 0 };
    e.n++; if (won(m)) e.wins++; hm.set(m.hero_id, e);
  });
  return {
    n: h.length, wins, winrate: h.length ? wins / h.length : 0,
    k: sum((m) => m.player_kills), d: sum((m) => m.player_deaths), a: sum((m) => m.player_assists),
    nw: sum((m) => m.net_worth), lh: sum((m) => m.last_hits), dn: sum((m) => m.denies), dur: sum((m) => m.match_duration_s),
    bestStreak: best, currentStreak: cur,
    heroes: [...hm.values()].sort((a, b) => b.n - a.n),
  };
}

/** Global per-match averages from hero analytics. */
export function globalAverages(rows: HeroAnalytics[]) {
  const m = rows.reduce((s, r) => s + r.matches, 0) || 1;
  const t = (f: (r: HeroAnalytics) => number | undefined) => rows.reduce((s, r) => s + (f(r) ?? 0), 0) / m;
  return { k: t((r) => r.total_kills), d: t((r) => r.total_deaths), a: t((r) => r.total_assists), nw: t((r) => r.total_net_worth), lh: t((r) => r.total_last_hits), dn: t((r) => r.total_denies) };
}

/** Radar axes as % of average player (100 = average). Deaths inverted (fewer = better). */
export function playstyle(s: PlayerSummary, g: ReturnType<typeof globalAverages>) {
  const r = (a: number, b: number) => Math.round(Math.min(200, (a / (b || 1)) * 100));
  return [
    { axis: "Убийства", v: r(s.k, g.k) },
    { axis: "Выживание", v: r(g.d, s.d || 0.1) },
    { axis: "Помощь", v: r(s.a, g.a) },
    { axis: "Фарм", v: r(s.lh, g.lh) },
    { axis: "Души", v: r(s.nw, g.nw) },
    { axis: "Денаи", v: r(s.dn, g.dn) },
  ];
}

/** Chronological series: rolling winrate over `win` matches and cumulative rank delta when available. */
export function formSeries(h: MatchHistoryEntry[], win = 20) {
  const chrono = [...h].reverse();
  let delta = 0;
  return chrono.map((m, i) => {
    const slice = chrono.slice(Math.max(0, i - win + 1), i + 1);
    delta += m.ranked_delta ?? 0;
    return { i: i + 1, wr: Math.round((slice.filter(won).length / slice.length) * 100), delta, t: m.start_time };
  });
}
