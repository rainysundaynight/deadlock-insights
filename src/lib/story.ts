import type { APlayer } from "./analysis";
import { snapAt } from "./analysis";

export interface Death { t: number; team: number; slot?: number | undefined }
export interface Fight { start: number; end: number; lost0: number; lost1: number; swing: number; winner: number | null }

type DPlayer = APlayer & { player_slot?: number; death_details?: { game_time_s: number }[] | undefined };

const teamNw = (players: APlayer[], t: number) => {
  let d = 0;
  for (const p of players) d += (p.team === 0 ? 1 : -1) * (snapAt(p, t)?.net_worth ?? 0);
  return d;
};

/** Clusters deaths (gap ≤ 20s, at least 3 deaths) into teamfights. swing = change of Hidden King soul lead across the fight. */
export function findFights(players: DPlayer[], gap = 20, min = 3): Fight[] {
  const ds: Death[] = players.flatMap((p) => (p.death_details ?? []).map((d) => ({ t: d.game_time_s, team: p.team, slot: p.player_slot }))).sort((a, b) => a.t - b.t);
  const out: Fight[] = [];
  let cur: Death[] = [];
  const flush = () => {
    if (cur.length >= min) {
      const start = cur[0]!.t, end = cur.at(-1)!.t;
      const lost0 = cur.filter((d) => d.team === 0).length, lost1 = cur.length - lost0;
      const swing = teamNw(players, end + 60) - teamNw(players, Math.max(0, start - 60));
      out.push({ start, end, lost0, lost1, swing, winner: lost0 === lost1 ? null : lost0 < lost1 ? 0 : 1 });
    }
    cur = [];
  };
  for (const d of ds) { if (cur.length && d.t - cur.at(-1)!.t > gap) flush(); cur.push(d); }
  flush();
  return out;
}

export interface TurningPoint { loserMaxLead: number; loserMaxLeadT: number; comeback: boolean; swingStart: number; swingEnd: number; swingAmount: number }

/** Finds the biggest 3-minute swing toward the eventual winner and whether the loser was ever clearly ahead (comeback/throw). */
export function turningPoint(series: { t: number; diff: number }[], winner: number, window = 180): TurningPoint {
  const sign = winner === 0 ? 1 : -1; // diff in winner's favour = diff*sign
  let loserMaxLead = 0, loserMaxLeadT = 0;
  for (const s of series) { const l = -s.diff * sign; if (l > loserMaxLead) { loserMaxLead = l; loserMaxLeadT = s.t; } }
  let best = { a: 0, b: 0, v: -Infinity };
  for (let i = 0; i < series.length; i++) for (let j = i + 1; j < series.length && series[j]!.t - series[i]!.t <= window; j++) {
    const v = (series[j]!.diff - series[i]!.diff) * sign;
    if (v > best.v) best = { a: series[i]!.t, b: series[j]!.t, v };
  }
  return { loserMaxLead, loserMaxLeadT, comeback: loserMaxLead >= 5000, swingStart: best.a, swingEnd: best.b, swingAmount: Math.max(0, best.v) };
}

/** Ability unlock/upgrade order from item entries whose ids are abilities. level 0 = unlocked, 1..3 = upgrade tier. */
export function abilityOrder(items: { game_time_s: number; item_id: number }[], abilityIds: Set<number>) {
  const seen = new Map<number, number>();
  return [...items].filter((i) => abilityIds.has(i.item_id)).sort((a, b) => a.game_time_s - b.game_time_s).map((i) => {
    const level = seen.get(i.item_id) ?? 0;
    seen.set(i.item_id, level + 1);
    return { t: i.game_time_s, id: i.item_id, level };
  });
}

export const median = (xs: number[]) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
};

/** Experience gates cannot be bypassed by a short winning streak or high KDA. */
export const MASTERY = ["Новичок", "Знаток", "Мастер", "Гранд-мастер", "Легенда"] as const;
export const MASTERY_REQUIREMENTS = [
  { games: 0, winrate: 0 },
  { games: 20, winrate: 0.5 },
  { games: 50, winrate: 0.53 },
  { games: 150, winrate: 0.55 },
  { games: 300, winrate: 0.6 },
] as const;
export function mastery(games: number, wr: number) {
  let level = 0;
  for (const [i, requirement] of MASTERY_REQUIREMENTS.entries()) {
    if (games >= requirement.games && wr >= requirement.winrate) level = i;
  }
  const next = MASTERY_REQUIREMENTS[level + 1];
  const progress = next ? Math.min(1, Math.max(0, games) / next.games, Math.max(0, wr) / next.winrate) : 1;
  return { level, name: MASTERY[level] ?? MASTERY[0], score: Math.round(progress * 100), next };
}

/** Playstyle archetype from radar axes (100 = average player). */
export function archetype(axes: { axis: string; v: number }[]) {
  const v = (n: string) => axes.find((a) => a.axis === n)?.v ?? 100;
  const cands = [
    { name: "Агрессивный дуэлянт", text: "Ищет убийства чаще среднего игрока", s: v("Убийства") * 1.0 + (200 - v("Выживание")) * 0.2 },
    { name: "Командный игрок", text: "Живёт в драках рядом с командой — много помощи", s: v("Помощь") * 1.05 },
    { name: "Экономический керри", text: "Фармит и копит души быстрее других", s: (v("Фарм") + v("Души")) / 2 * 1.02 },
    { name: "Осторожный стратег", text: "Редко умирает, играет от позиции", s: v("Выживание") * 0.98 },
    { name: "Мастер линии", text: "Забирает у соперника души денаями", s: v("Денаи") * 0.95 },
  ].sort((a, b) => b.s - a.s);
  return { main: cands[0]!, second: cands[1]! };
}
