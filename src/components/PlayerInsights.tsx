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
    return last30.map((m) => ({ m, ...gradeHistory(m, ga, s.dur) }));
  }, [g.data, last30, s.dur]);
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
        <section className="panel grid gap-6 p-5 lg:grid-cols-[200px_1fr]">
          <div className="flex flex-col items-center justify-center rounded-xl border border-primary/30 bg-primary/5 p-4 text-center">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Оценка · 30 матчей</p>
            <p className={cn("font-display text-6xl font-extrabold", gradeTone(gradeFromScore(avgScore)))}>{gradeFromScore(avgScore)}</p>
            <p className="tabular text-sm text-muted-foreground">{avgScore.toFixed(0)} / 100</p>
            <p className={cn("mt-2 text-xs", trend >= 0 ? "text-win" : "text-loss")}>{Math.abs(trend) < 2 ? "Стабильная форма" : trend > 0 ? `Форма растёт (+${trend.toFixed(0)})` : `Форма падает (${trend.toFixed(0)})`}</p>
          </div>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <Stat label="Винрейт · 30" value={`${(s30.winrate * 100).toFixed(0)}%`} tone={s30.winrate >= 0.5 ? "win" : "loss"} sub={`${s30.wins}–${s30.n - s30.wins}`} />
              <Stat label="KDA · 30" value={kda(s30.k, s30.d, s30.a)} tone="brass" sub={`${s30.k.toFixed(1)} / ${s30.d.toFixed(1)} / ${s30.a.toFixed(1)}`} />
              <Stat label="Души · 30" value={fmtK(s30.nw)} />
              <Stat label="Смертей за матч" value={s30.d.toFixed(1)} tone={s30.d > s.d ? "loss" : "win"} sub={`в среднем ${s.d.toFixed(1)}`} />
            </div>
            <div>
              <p className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">Оценки по матчам (новые слева)</p>
              <div className="flex flex-wrap gap-1">
                {graded.map(({ m, grade }) => (
                  <Link key={m.match_id} to="/matches/$matchId" params={{ matchId: String(m.match_id) }} title={`${heroes.get(m.hero_id)?.name ?? ""} · ${m.player_kills}/${m.player_deaths}/${m.player_assists}`}
                    className={cn("grid h-8 w-9 place-items-center rounded-md border font-display text-xs font-bold", won(m) ? "border-win/40 bg-win/10" : "border-loss/40 bg-loss/10", gradeTone(grade))}>{grade}</Link>
                ))}
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-lg border border-win/30 bg-win/5 p-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-win">Сильные стороны</p>
                {sw.good.length ? sw.good.map((x) => <p key={x.axis} className="text-sm"><b>{x.axis}</b> <span className="tabular text-xs text-muted-foreground">{x.v}%</span> — {x.text}</p>) : <p className="text-sm text-muted-foreground">Ровная игра без явных перекосов.</p>}
              </div>
              <div className="rounded-lg border border-loss/30 bg-loss/5 p-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-loss">Что улучшить</p>
                {sw.bad.length ? sw.bad.map((x) => <p key={x.axis} className="text-sm"><b>{x.axis}</b> <span className="tabular text-xs text-muted-foreground">{x.v}%</span> — {x.text}</p>) : <p className="text-sm text-muted-foreground">Слабых мест не видно — держите уровень.</p>}
                {s30.heroes.length > 6 && <p className="mt-1 text-sm">Широкий пул ({s30.heroes.length} героев за 30 матчей) — сосредоточьтесь на 2–3 героях для стабильного роста.</p>}
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
