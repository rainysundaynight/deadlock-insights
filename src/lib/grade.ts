import type { MatchHistoryEntry } from "@/lib/api";

export const GRADES = ["S+", "S", "A", "B", "C", "D"] as const;
export type Grade = (typeof GRADES)[number];

/** Score 0–100 → letter. Average performance in a win ≈ B, in a loss ≈ C. */
export function gradeFromScore(score: number): Grade {
  if (score >= 90) return "S+";
  if (score >= 78) return "S";
  if (score >= 66) return "A";
  if (score >= 54) return "B";
  if (score >= 42) return "C";
  return "D";
}

const clip = (v: number) => Math.max(0, Math.min(2, Number.isFinite(v) ? v : 1));

interface Perf { k: number; d: number; a: number; nw: number; lh: number; dmg?: number; won: boolean }

/** Weighted ratio of a player's numbers to a baseline (1 = equal). */
export function perfScore(p: Perf, base: Omit<Perf, "won">): number {
  const kda = (p.k + p.a * 0.7) / Math.max(1, p.d);
  const bkda = (base.k + base.a * 0.7) / Math.max(1, base.d);
  const parts: [number, number][] = [
    [clip(kda / (bkda || 1)), 0.35],
    [clip(p.nw / (base.nw || 1)), 0.25],
    [clip(p.lh / (base.lh || 1)), 0.1],
  ];
  if (p.dmg != null && base.dmg) parts.push([clip(p.dmg / base.dmg), 0.2]);
  else parts[0]![1] += 0.2;
  const w = parts.reduce((s, [, x]) => s + x, 0);
  const r = parts.reduce((s, [v, x]) => s + v * x, 0) / w;
  return Math.max(0, Math.min(100, r * 46 + (p.won ? 10 : 0)));
}

/** Grade of a player within a finished match, relative to the lobby average. */
export function gradeInMatch<T extends { kills: number; deaths: number; assists: number; net_worth: number; last_hits: number; team: number; stats: { player_damage?: number }[] }>(p: T, lobby: T[], winner: number) {
  const n = lobby.length || 1;
  const avg = (f: (x: T) => number) => lobby.reduce((s, x) => s + f(x), 0) / n;
  const dmg = (x: T) => x.stats.at(-1)?.player_damage ?? 0;
  const score = perfScore(
    { k: p.kills, d: p.deaths, a: p.assists, nw: p.net_worth, lh: p.last_hits, dmg: dmg(p), won: p.team === winner },
    { k: avg((x) => x.kills), d: avg((x) => x.deaths), a: avg((x) => x.assists), nw: avg((x) => x.net_worth), lh: avg((x) => x.last_hits), dmg: avg(dmg) },
  );
  return { score, grade: gradeFromScore(score) };
}

/** Grade of a match-history entry vs. the global average, normalised by duration. */
export function gradeHistory(m: MatchHistoryEntry, g: { k: number; d: number; a: number; nw: number; lh: number }, avgDur: number) {
  const f = (m.match_duration_s || avgDur) / (avgDur || 1);
  const score = perfScore(
    { k: m.player_kills, d: m.player_deaths, a: m.player_assists, nw: m.net_worth, lh: m.last_hits, won: m.match_result === m.player_team },
    { k: g.k * f, d: g.d * f, a: g.a * f, nw: g.nw * f, lh: g.lh * f },
  );
  return { score, grade: gradeFromScore(score) };
}

export const gradeTone = (g: Grade) => (g === "S+" || g === "S" ? "text-primary" : g === "A" ? "text-win" : g === "B" ? "text-foreground" : "text-loss");

const ADVICE: Record<string, { good: string; bad: string }> = {
  "Убийства": { good: "Сильная агрессия — часто добиваете соперников.", bad: "Мало убийств: ищите ганки с союзниками и добивайте ослабленных врагов." },
  "Выживание": { good: "Редко умираете — хорошее позиционирование.", bad: "Много смертей: следите за миникартой, не заходите далеко без обзора, берите предметы на живучесть." },
  "Помощь": { good: "Отлично участвуете в командных драках.", bad: "Низкое участие в драках: чаще присоединяйтесь к команде на тимфайтах." },
  "Фарм": { good: "Отличный фарм крипов.", bad: "Слабый фарм: добивайте крипов на линии и зачищайте лагеря между драками." },
  "Души": { good: "Высокий доход душ — быстро собираете предметы.", bad: "Низкий доход: меньше простаивайте, фармите джунгли и урны." },
  "Денаи": { good: "Хорошо денаите — лишаете соперника душ.", bad: "Мало денаев: добивайте своих крипов и подбирайте сферы душ." },
};

/** Strengths / weaknesses from playstyle axes (100 = average). */
export function strengthsWeaknesses(axes: { axis: string; v: number }[]) {
  const sorted = [...axes].sort((a, b) => b.v - a.v);
  const good = sorted.filter((x) => x.v >= 110).slice(0, 3).map((x) => ({ ...x, text: ADVICE[x.axis]?.good ?? "" }));
  const bad = sorted.filter((x) => x.v <= 90).reverse().slice(0, 3).map((x) => ({ ...x, text: ADVICE[x.axis]?.bad ?? "" }));
  return { good, bad };
}
