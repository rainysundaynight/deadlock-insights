import { useQuery } from "@tanstack/react-query";
import { Area, AreaChart, CartesianGrid, PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useMemo } from "react";

import { HeroIcon, SectionTitle, Stat, WinrateBar, useHeroMap } from "@/components/dl";
import { api, ranksQuery, type HeroAnalytics, type MatchHistoryEntry } from "@/lib/api";
import { fmtDuration, fmtK, kda } from "@/lib/format";
import { deviationFromAverage, formSeries, globalAverages, playstyle, summarize, won } from "@/lib/playerStats";
import { gradeFromScore, gradeHistory, gradeTone, strengthsWeaknesses } from "@/lib/grade";
import { Link } from "@tanstack/react-router";
import { GradeSeal, MetricBar, TipColumns } from "@/components/GradeReport";
import { cn } from "@/lib/utils";

export const globalAvgQuery = {
  queryKey: ["global-avg"],
  queryFn: () => api<HeroAnalytics[]>("/v1/analytics/hero-stats", { min_unix_timestamp: Math.floor(Date.now() / 86400000) * 86400 - 14 * 86400 }),
  staleTime: 1000 * 60 * 60,
};

const tip = { background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 };

export function PlayerInsights({ history, badge, backTo }: { history: MatchHistoryEntry[]; badge?: number | null | undefined; backTo?: string | undefined }) {
  const heroes = useHeroMap();
  const g = useQuery(globalAvgQuery);
  const myBadge = badge || history.find((m) => m.ranked_display_badge)?.ranked_display_badge || null;
  const tier = myBadge ? Math.floor(myBadge / 10) : null;
  const rq = useQuery({
    queryKey: ["rank-avg", tier],
    enabled: tier != null,
    staleTime: 1000 * 60 * 60,
    queryFn: () => api<HeroAnalytics[]>("/v1/analytics/hero-stats", { min_average_badge: tier! * 10 + 1, max_average_badge: tier! * 10 + 6, min_unix_timestamp: Math.floor(Date.now() / 86400000) * 86400 - 14 * 86400 }),
  });
  const ranksQ = useQuery(ranksQuery);
  const rankName = tier != null ? ranksQ.data?.find((r) => r.tier === tier)?.name ?? `Tier ${tier}` : null;
  const radarBase = rq.data?.length ? rq.data : g.data;
  const recent = history.slice(0, 100);
  const s = useMemo(() => summarize(recent), [recent]);
  const radar = useMemo(() => (radarBase ? playstyle(s, globalAverages(radarBase)).map((x) => ({ ...x, average: 100 })) : []), [s, radarBase]);
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
        <section className="panel p-0">
          <div className="flex items-center justify-between border-b border-border/60 px-5 py-3">
            <p className="font-display text-lg font-bold">Табель успеваемости</p>
            <span className={cn("font-mono text-[11px] uppercase tracking-wider", Math.abs(trend) < 2 ? "text-muted-foreground" : trend > 0 ? "text-win" : "text-loss")}>
              {Math.abs(trend) < 2 ? "→ стабильная форма" : trend > 0 ? `↑ форма растёт +${trend.toFixed(0)}` : `↓ форма падает ${trend.toFixed(0)}`}
            </span>
          </div>
          <div className="grid lg:grid-cols-[220px_1fr_1fr]">
            <div className="flex flex-col items-center justify-center gap-4 border-b border-border/60 p-6 lg:border-b-0 lg:border-r">
              <GradeSeal score={avgScore} caption={`${avgScore.toFixed(0)} / 100 · 30 матчей`} />
              <div className="grid w-full grid-cols-3 text-center">
                {[["WR", `${(s30.winrate * 100).toFixed(0)}%`, s30.winrate >= 0.5 ? "text-win" : "text-loss"], ["KDA", kda(s30.k, s30.d, s30.a), "text-primary"], ["Души", fmtK(s30.nw), "text-foreground"]].map(([l, v, c]) => (
                  <div key={l}><p className={cn("tabular font-display text-lg font-bold", c)}>{v}</p><p className="font-mono text-[9px] uppercase text-muted-foreground">{l}</p></div>
                ))}
              </div>
            </div>
            <div className="border-b border-border/60 p-5 lg:border-b-0 lg:border-r">
              <p className="mb-2 font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Против среднего игрока</p>
              {g.data && playstyle(s30, globalAverages(g.data)).map((x) => <MetricBar key={x.axis} label={x.axis} v={x.v} />)}
              <p className="mb-2 mt-5 font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Оценки по матчам · новые слева</p>
              <div className="flex flex-wrap gap-1">
                {graded.map(({ m, grade }) => (
                  <Link key={m.match_id} to="/matches/$matchId" params={{ matchId: String(m.match_id) }} {...(backTo ? { search: { from: backTo } } : {})}
                    title={`${heroes.get(m.hero_id)?.name ?? ""} · ${m.player_kills}/${m.player_deaths}/${m.player_assists} · ${grade}`}
                    className={cn("grid h-8 w-8 place-items-center border font-display text-xs font-bold transition-transform hover:-translate-y-0.5", won(m) ? "border-win/50 bg-win/10" : "border-loss/50 bg-loss/10", gradeTone(grade))}>
                    {grade}
                  </Link>
                ))}
              </div>
            </div>
            <div className="p-5">
              <TipColumns
                empty="Ровная игра без явных перекосов — держите уровень."
                tips={[
                  ...sw.bad.map((x) => ({ tone: "bad" as const, title: `${x.axis} · ${x.v - 100}%`, text: x.text })),
                  ...(s30.heroes.length > 6 ? [{ tone: "bad" as const, title: `Пул героев · ${s30.heroes.length}`, text: "Широкий пул за 30 матчей — сосредоточьтесь на 2–3 героях для стабильного роста." }] : []),
                  ...sw.good.map((x) => ({ tone: "good" as const, title: `${x.axis} · +${x.v - 100}%`, text: x.text })),
                ]}
              />
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
          <p className="-mt-2 mb-2 text-xs text-muted-foreground">100 = средний игрок {rq.data?.length && rankName ? <>ранга <span className="text-primary">{rankName}</span>{badge ? "" : " (по последнему/потенциальному рангу)"}</> : "за 14 дней"}</p>
          <div className="mb-2 flex gap-4 text-[10px] text-muted-foreground"><span className="inline-flex items-center gap-1"><i className="h-px w-4 bg-primary" />Игрок</span><span className="inline-flex items-center gap-1"><i className="w-4 border-t border-dashed border-muted-foreground" />Средний игрок</span></div>
          <div className="h-60">
            <ResponsiveContainer>
              <RadarChart data={radar} outerRadius="72%">
                <PolarGrid stroke="var(--border)" />
                <PolarAngleAxis dataKey="axis" tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} />
                <PolarRadiusAxis domain={[0, 200]} tick={false} axisLine={false} />
                <Radar name="Игрок" dataKey="v" stroke="var(--primary)" fill="var(--primary)" fillOpacity={0.3} />
                <Radar name="Средний игрок" dataKey="average" stroke="var(--muted-foreground)" strokeDasharray="4 3" fill="var(--muted-foreground)" fillOpacity={0.04} />
                <Tooltip contentStyle={tip} formatter={(v: number, name: string) => [name === "Средний игрок" ? "0% (база)" : `${v > 100 ? "+" : ""}${deviationFromAverage(v)}% к среднему`, name]} />
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
