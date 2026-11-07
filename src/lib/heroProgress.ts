import type { MatchHistoryEntry } from "./api";

export interface HeroWindow { n: number; winrate: number; kda: number; soulsPerMin: number }
export interface HeroProgress { heroId: number; total: number; recent: HeroWindow; previous: HeroWindow | null; trend: "up" | "down" | "flat"; series: number[] }

/** Minimum games per hero before progress is shown; each window is up to WINDOW games. */
export const PROGRESS_MIN_GAMES = 6;
export const PROGRESS_WINDOW = 10;

function summarize(ms: MatchHistoryEntry[]): HeroWindow {
  const n = ms.length;
  const wins = ms.filter((m) => m.match_result === m.player_team).length;
  const k = ms.reduce((s, m) => s + m.player_kills + m.player_assists, 0);
  const d = ms.reduce((s, m) => s + m.player_deaths, 0);
  const souls = ms.reduce((s, m) => s + m.net_worth, 0);
  const mins = ms.reduce((s, m) => s + m.match_duration_s, 0) / 60;
  return { n, winrate: n ? wins / n : 0, kda: k / Math.max(1, d), soulsPerMin: mins ? souls / mins : 0 };
}

/** Compares the newest WINDOW games on a hero with the WINDOW before them. */
export function heroProgress(history: MatchHistoryEntry[]): HeroProgress[] {
  const byHero = new Map<number, MatchHistoryEntry[]>();
  for (const m of [...history].sort((a, b) => b.start_time - a.start_time)) {
    const arr = byHero.get(m.hero_id) ?? [];
    arr.push(m);
    byHero.set(m.hero_id, arr);
  }
  const out: HeroProgress[] = [];
  for (const [heroId, ms] of byHero) {
    if (ms.length < PROGRESS_MIN_GAMES) continue;
    const half = Math.min(PROGRESS_WINDOW, Math.ceil(ms.length / 2));
    const recent = summarize(ms.slice(0, half));
    const prevMs = ms.slice(half, half * 2);
    const previous = prevMs.length ? summarize(prevMs) : null;
    let trend: HeroProgress["trend"] = "flat";
    if (previous) {
      const score = (recent.winrate - previous.winrate) * 2 + (recent.kda - previous.kda) / Math.max(1, previous.kda);
      trend = score > 0.1 ? "up" : score < -0.1 ? "down" : "flat";
    }
    // Rolling winrate over the last games (oldest → newest), window 5.
    const chrono = [...ms].reverse();
    const series = chrono.map((_, i) => {
      const w = chrono.slice(Math.max(0, i - 4), i + 1);
      return w.filter((m) => m.match_result === m.player_team).length / w.length;
    });
    out.push({ heroId, total: ms.length, recent, previous, trend, series });
  }
  return out.sort((a, b) => b.total - a.total);
}
