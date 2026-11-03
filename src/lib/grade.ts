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

/** Per-metric ratios vs. baseline (1 = equal) with weights — used for the score and its explanation. */
export function perfParts(p: Perf, base: Omit<Perf, "won">) {
  const kda = (p.k + p.a * 0.7) / Math.max(1, p.d);
  const bkda = (base.k + base.a * 0.7) / Math.max(1, base.d);
  const parts: { label: string; v: number; w: number }[] = [
    { label: "KDA", v: clip(kda / (bkda || 1)), w: 0.35 },
    { label: "Души", v: clip(p.nw / (base.nw || 1)), w: 0.25 },
    { label: "Крипы", v: clip(p.lh / (base.lh || 1)), w: 0.1 },
  ];
  if (p.dmg != null && base.dmg) parts.push({ label: "Урон", v: clip(p.dmg / base.dmg), w: 0.2 });
  else parts[0]!.w += 0.2;
  return parts;
}

/** Weighted ratio of a player's numbers to a baseline (1 = equal). */
export function perfScore(p: Perf, base: Omit<Perf, "won">): number {
  const parts = perfParts(p, base);
  const w = parts.reduce((s, x) => s + x.w, 0);
  const r = parts.reduce((s, x) => s + x.v * x.w, 0) / w;
  return Math.max(0, Math.min(100, r * 46 + (p.won ? 10 : 0)));
}

/** Human-readable reasons behind a grade (ratio vs. average, win bonus). */
export function explainGrade(p: Perf, base: Omit<Perf, "won">): string[] {
  const lines = perfParts(p, base).map((x) => `${x.label}: ${Math.round(x.v * 100)}% от среднего${x.v >= 1.2 ? " — сильно" : x.v <= 0.8 ? " — слабо" : ""}`);
  lines.push(p.won ? "Победа: +10 баллов" : "Поражение: без бонуса");
  return lines;
}

/** Same as explainGrade but with the global baseline scaled to match length. */
export function explainVsGlobal(p: { k: number; d: number; a: number; nw: number; lh: number; won: boolean }, g: Global, durationS: number) {
  const f = (durationS || AVG_MATCH_S) / AVG_MATCH_S;
  return explainGrade(p, { k: g.k * f, d: g.d * f, a: g.a * f, nw: g.nw * f, lh: g.lh * f });
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

/** Typical match length used to scale global per-match averages. */
export const AVG_MATCH_S = 1950;
type Global = { k: number; d: number; a: number; nw: number; lh: number };

/** One shared grade formula: player's numbers vs. the global average, scaled to match length. Used by profile AND match page so they agree. */
export function gradeVsGlobal(p: { k: number; d: number; a: number; nw: number; lh: number; won: boolean }, g: Global, durationS: number) {
  const f = (durationS || AVG_MATCH_S) / AVG_MATCH_S;
  const score = perfScore(p, { k: g.k * f, d: g.d * f, a: g.a * f, nw: g.nw * f, lh: g.lh * f });
  return { score, grade: gradeFromScore(score) };
}

/** Grade of a match-history entry. */
export function gradeHistory(m: MatchHistoryEntry, g: Global) {
  return gradeVsGlobal({ k: m.player_kills, d: m.player_deaths, a: m.player_assists, nw: m.net_worth, lh: m.last_hits, won: m.match_result === m.player_team }, g, m.match_duration_s);
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
