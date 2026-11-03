import { useQuery } from "@tanstack/react-query";
import { Area, AreaChart, CartesianGrid, PolarAngleAxis, PolarGrid, Radar, RadarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useMemo } from "react";

import { HeroIcon, SectionTitle, Stat, WinrateBar, useHeroMap } from "@/components/dl";
import { api, type HeroAnalytics, type MatchHistoryEntry } from "@/lib/api";
import { fmtDuration, fmtK, kda } from "@/lib/format";
import { formSeries, globalAverages, playstyle, summarize } from "@/lib/playerStats";

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

  if (!history.length) return null;
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Средние души" value={fmtK(s.nw)} tone="brass" sub="за матч, последние 100" />
        <Stat label="Средняя длительность" value={fmtDuration(s.dur)} />
        <Stat label="Лучшая серия" value={`${s.bestStreak} побед`} tone="win" />
        <Stat label="Текущая серия" value={s.currentStreak > 0 ? `+${s.currentStreak}` : String(s.currentStreak)} tone={s.currentStreak > 0 ? "win" : "loss"} sub={s.currentStreak > 0 ? "побед подряд" : "поражений подряд"} />
      </div>
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
