import { useQuery } from "@tanstack/react-query";
import { Area, AreaChart, CartesianGrid, PolarAngleAxis, PolarGrid, Radar, RadarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useMemo } from "react";

import { HeroIcon, SectionTitle, Stat, WinrateBar, useHeroMap } from "@/components/dl";
import { api, type HeroAnalytics, type MatchHistoryEntry } from "@/lib/api";
import { fmtDuration, fmtK, kda } from "@/lib/format";
import { formSeries, globalAverages, playstyle, summarize, won } from "@/lib/playerStats";
import { gradeFromScore, gradeHistory, gradeTone, strengthsWeaknesses } from "@/lib/grade";
import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

export const globalAvgQuery = {
  queryKey: ["global-avg"],
  queryFn: () => api<HeroAnalytics[]>("/v1/analytics/hero-stats", { min_unix_timestamp: Math.floor(Date.now() / 86400000) * 86400 - 14 * 86400 }),
  staleTime: 1000 * 60 * 60,
};

const tip = { background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 };

export function PlayerInsights({ history }: { history: MatchHistoryEntry[] }) {
  const heroes = useHeroMap();
  const g = useQuery(globalAvgQuery);
  const recent = history.slice(0, 100);
  const s = useMemo(() => summarize(recent), [recent]);
  const radar = useMemo(() => (g.data ? playstyle(s, globalAverages(g.data)) : []), [s, g.data]);
  const form = useMemo(() => formSeries(recent), [recent]);
  const hasRank = recent.some((m) => m.ranked_delta != null);
  const last30 = useMemo(() => history.slice(0, 30), [history]);
  const s30 = useMemo(() => summarize(last30), [last30]);
  const graded = useMemo(() => {
    if (!g.data) return [];
    const ga = globalAverages(g.data);
    return last30.map((m) => ({ m, ...gradeHistory(m, ga) }));
  }, [g.data, last30]);
  const avgScore = graded.length ? graded.reduce((a, x) => a + x.score, 0) / graded.length : 0;
  const sw = useMemo(() => (g.data ? strengthsWeaknesses(playstyle(s30, globalAverages(g.data))) : { good: [], bad: [] }), [g.data, s30]);
  const trend = graded.length >= 20 ? graded.slice(0, 10).reduce((a, x) => a + x.score, 0) / 10 - graded.slice(10, 30).reduce((a, x) => a + x.score, 0) / (graded.length - 10) : 0;

  if (!history.length) return null;
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Средние души" value={fmtK(s.nw)} tone="brass" sub="за матч, последние 100" />
        <Stat label="Средняя длительность" value={fmtDuration(s.dur)} />
        <Stat label="Лучшая серия" value={`${s.bestStreak} побед`} tone="win" />
        <Stat label="Текущая серия" value={s.currentStreak > 0 ? `+${s.currentStreak}` : String(s.currentStreak)} tone={s.currentStreak > 0 ? "win" : "loss"} sub={s.currentStreak > 0 ? "побед подряд" : "поражений подряд"} />
      </div>
      {graded.length > 0 && (
        <section className="panel relative overflow-hidden p-0">
          <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-primary/10 blur-3xl" />
          <div className="relative grid gap-0 lg:grid-cols-[260px_1fr]">
            {/* Grade ring */}
            <div className="flex flex-col items-center justify-center gap-3 border-b border-border/60 p-6 lg:border-b-0 lg:border-r">
              <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">Оценка · 30 матчей</p>
              <div className="relative grid h-40 w-40 place-items-center rounded-full"
                style={{ background: `conic-gradient(var(--primary) ${avgScore * 3.6}deg, color-mix(in oklab, var(--muted) 60%, transparent) 0)` }}>
                <div className="grid h-[136px] w-[136px] place-items-center rounded-full bg-card">
                  <div className="text-center">
                    <p className={cn("font-display text-6xl font-extrabold leading-none", gradeTone(gradeFromScore(avgScore)))}>{gradeFromScore(avgScore)}</p>
                    <p className="tabular mt-1 text-xs text-muted-foreground">{avgScore.toFixed(0)} / 100</p>
                  </div>
                </div>
              </div>
              <span className={cn("inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium",
                Math.abs(trend) < 2 ? "bg-muted text-muted-foreground" : trend > 0 ? "bg-win/15 text-win" : "bg-loss/15 text-loss")}>
                {Math.abs(trend) < 2 ? "→ Стабильная форма" : trend > 0 ? `↑ Форма растёт +${trend.toFixed(0)}` : `↓ Форма падает ${trend.toFixed(0)}`}
              </span>
            </div>

            <div className="space-y-5 p-5">
              <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl bg-border/60 md:grid-cols-4">
                {[
                  { l: "Винрейт", v: `${(s30.winrate * 100).toFixed(0)}%`, sub: `${s30.wins}–${s30.n - s30.wins}`, c: s30.winrate >= 0.5 ? "text-win" : "text-loss" },
                  { l: "KDA", v: kda(s30.k, s30.d, s30.a), sub: `${s30.k.toFixed(1)} / ${s30.d.toFixed(1)} / ${s30.a.toFixed(1)}`, c: "text-primary" },
                  { l: "Души", v: fmtK(s30.nw), sub: "за матч", c: "text-foreground" },
                  { l: "Смерти", v: s30.d.toFixed(1), sub: `обычно ${s.d.toFixed(1)}`, c: s30.d > s.d ? "text-loss" : "text-win" },
                ].map((x) => (
                  <div key={x.l} className="bg-card/90 p-4">
                    <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{x.l}</p>
                    <p className={cn("tabular mt-1 font-display text-2xl font-bold", x.c)}>{x.v}</p>
                    <p className="tabular text-xs text-muted-foreground">{x.sub}</p>
                  </div>
                ))}
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between text-[11px] uppercase tracking-wider text-muted-foreground">
                  <span>Оценки по матчам</span><span>← новые · старые →</span>
                </div>
                <div className="flex h-24 items-end gap-1">
                  {graded.map(({ m, grade, score }) => (
                    <Link key={m.match_id} to="/matches/$matchId" params={{ matchId: String(m.match_id) }}
                      title={`${heroes.get(m.hero_id)?.name ?? ""} · ${m.player_kills}/${m.player_deaths}/${m.player_assists} · ${grade}`}
                      className="group flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1">
                      <span className={cn("font-display text-[10px] font-bold opacity-70 group-hover:opacity-100", gradeTone(grade))}>{grade}</span>
                      <span className={cn("w-full rounded-t-md transition-all group-hover:brightness-125", won(m) ? "bg-gradient-to-t from-win/30 to-win/80" : "bg-gradient-to-t from-loss/30 to-loss/80")}
                        style={{ height: `${Math.max(8, Math.min(100, score))}%` }} />
                    </Link>
                  ))}
                </div>
                <div className="mt-2 flex gap-4 text-[11px] text-muted-foreground">
                  <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-win" />победа</span>
                  <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-loss" />поражение</span>
                  <span>высота — очки за матч</span>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                {([
                  { title: "Сильные стороны", items: sw.good, tone: "win", empty: "Ровная игра без явных перекосов." },
                  { title: "Что улучшить", items: sw.bad, tone: "loss", empty: "Слабых мест не видно — держите уровень." },
                ] as const).map((col) => (
                  <div key={col.title} className={cn("rounded-xl border bg-gradient-to-br to-transparent p-4", col.tone === "win" ? "border-win/25 from-win/10" : "border-loss/25 from-loss/10")}>
                    <p className={cn("mb-3 text-xs font-semibold uppercase tracking-wider", col.tone === "win" ? "text-win" : "text-loss")}>{col.title}</p>
                    <div className="space-y-3">
                      {col.items.length ? col.items.map((x) => (
                        <div key={x.axis}>
                          <div className="mb-1 flex items-baseline justify-between gap-2">
                            <span className="text-sm font-semibold">{x.axis}</span>
                            <span className={cn("tabular text-xs font-medium", col.tone === "win" ? "text-win" : "text-loss")}>{x.v}%</span>
                          </div>
                          <div className="mb-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
                            <div className={cn("h-full rounded-full", col.tone === "win" ? "bg-win" : "bg-loss")} style={{ width: `${Math.min(100, x.v / 2)}%` }} />
                          </div>
                          <p className="text-xs leading-relaxed text-muted-foreground">{x.text}</p>
                        </div>
                      )) : <p className="text-sm text-muted-foreground">{col.empty}</p>}
                      {col.tone === "loss" && s30.heroes.length > 6 && (
                        <div>
                          <p className="text-sm font-semibold">Пул героев <span className="tabular text-xs font-medium text-loss">{s30.heroes.length}</span></p>
                          <p className="text-xs leading-relaxed text-muted-foreground">Широкий пул за 30 матчей — сосредоточьтесь на 2–3 героях для стабильного роста.</p>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}
      <div className="grid gap-4 lg:grid-cols-5">
        <section className="panel p-5 lg:col-span-3">
          <SectionTitle>{hasRank ? "Изменение рейтинга" : "Форма — винрейт за 20 матчей"}</SectionTitle>
          <div className="h-64">
            <ResponsiveContainer>
              <AreaChart data={form}>
                <defs>
                  <linearGradient id="fg" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="var(--border)" vertical={false} />
                <XAxis dataKey="i" stroke="var(--muted-foreground)" fontSize={11} />
                <YAxis stroke="var(--muted-foreground)" fontSize={11} domain={hasRank ? ["auto", "auto"] : [0, 100]} />
                <Tooltip contentStyle={tip} labelFormatter={(i) => `Матч ${i}`} formatter={(v: number) => [hasRank ? v : `${v}%`, hasRank ? "Δ рейтинга" : "Винрейт"]} />
                <Area dataKey={hasRank ? "delta" : "wr"} stroke="var(--primary)" strokeWidth={2} fill="url(#fg)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>
        <section className="panel p-5 lg:col-span-2">
          <SectionTitle>Стиль игры</SectionTitle>
          <p className="-mt-2 mb-2 text-xs text-muted-foreground">100 = средний игрок за 14 дней</p>
          <div className="h-60">
            <ResponsiveContainer>
              <RadarChart data={radar} outerRadius="72%">
                <PolarGrid stroke="var(--border)" />
                <PolarAngleAxis dataKey="axis" tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} />
                <Radar dataKey="v" stroke="var(--primary)" fill="var(--primary)" fillOpacity={0.3} />
                <Tooltip contentStyle={tip} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>
      <section className="panel p-5">
        <SectionTitle>Пул героев (последние 100 матчей)</SectionTitle>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {s.heroes.slice(0, 9).map((h) => (
            <div key={h.hero_id} className="flex items-center gap-3 rounded-lg bg-secondary/60 p-3">
              <HeroIcon heroId={h.hero_id} size={40} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{heroes.get(h.hero_id)?.name}</p>
                <p className="text-xs text-muted-foreground">{h.n} матчей · {Math.round((h.n / s.n) * 100)}%</p>
              </div>
              <WinrateBar value={h.wins / h.n} />
            </div>
          ))}
        </div>
        <p className="mt-4 text-xs text-muted-foreground">Средний KDA: {kda(s.k, s.d, s.a)} · {s.k.toFixed(1)} / {s.d.toFixed(1)} / {s.a.toFixed(1)}</p>
      </section>
    </div>
  );
}
