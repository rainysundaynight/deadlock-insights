import type { MatchHistoryEntry } from "@/lib/api";

export const GOAL_METRICS = {
  deaths: { label: "Смертей за матч", get: (m: MatchHistoryEntry) => m.player_deaths, defOp: "lte", def: 5 },
  kills: { label: "Убийств за матч", get: (m: MatchHistoryEntry) => m.player_kills, defOp: "gte", def: 8 },
  assists: { label: "Помощи за матч", get: (m: MatchHistoryEntry) => m.player_assists, defOp: "gte", def: 10 },
  last_hits: { label: "Крипов за матч", get: (m: MatchHistoryEntry) => m.last_hits, defOp: "gte", def: 150 },
  net_worth: { label: "Душ за матч", get: (m: MatchHistoryEntry) => m.net_worth, defOp: "gte", def: 35000 },
  souls_per_min: { label: "Душ в минуту", get: (m: MatchHistoryEntry) => m.net_worth / Math.max(1, m.match_duration_s / 60), defOp: "gte", def: 1200 },
} as const;
export type GoalMetric = keyof typeof GOAL_METRICS;

/** How many of the last `n` matches met the goal, plus the average value. */
export function goalProgress(history: MatchHistoryEntry[], metric: GoalMetric, op: string, target: number, n = 10) {
  const recent = history.slice(0, n);
  const get = GOAL_METRICS[metric].get;
  const vals = recent.map(get);
  const met = vals.filter((v) => (op === "lte" ? v <= target : v >= target)).length;
  const avg = vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : 0;
  return { met, total: recent.length, avg, perMatch: vals.map((v) => (op === "lte" ? v <= target : v >= target)) };
}
