import { useQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { TrendingDown, TrendingUp } from "lucide-react";
import { useMemo, useState } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { Chip, ErrorBox, RankRangeFilter, rankParams, type RankRange, HeroIcon, Loading, PageHeader, useHeroMap } from "@/components/dl";
import { api } from "@/lib/api";
import { heroTrends, type DayRow } from "@/lib/trends";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/trends")({
  head: () => ({
    meta: [
      { title: "Тренды меты Deadlock — кто взлетел и кто просел" },
      { name: "description", content: "Изменение винрейта и популярности героев Deadlock день за днём." },
      { property: "og:title", content: "Тренды меты Deadlock" },
      { property: "og:description", content: "Кто из героев усилился, а кто ослаб за последнюю неделю." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Trends,
});


function Trends() {
  const heroes = useHeroMap();
  const [range, setRange] = useState<RankRange>([0, 11]);
  const [hero, setHero] = useState<number | null>(null);
  const since = Math.floor(Date.now() / 1000 / 86400) * 86400 - 28 * 86400;
  const q = useQuery({
    queryKey: ["trends", range, since],
    queryFn: () => api<DayRow[]>("/v1/analytics/hero-stats", { bucket: "start_time_day", min_unix_timestamp: since, ...rankParams(range) }),
    staleTime: 3600_000,
  });
  const trends = useMemo(() => heroTrends((q.data ?? []).filter((r) => heroes.has(r.hero_id))), [q.data, heroes]);
  const risers = [...trends].sort((a, b) => b.delta - a.delta).slice(0, 8);
  const fallers = [...trends].sort((a, b) => a.delta - b.delta).slice(0, 8);
  const sel = hero ?? risers[0]?.hero_id;
  const series = useMemo(() => (q.data ?? []).filter((r) => r.hero_id === sel).sort((a, b) => a.bucket - b.bucket).map((r) => ({
    d: new Date(r.bucket * 1000).toLocaleDateString("ru", { day: "numeric", month: "short" }),
    wr: +((r.wins / r.matches) * 100).toFixed(1),
    pick: r.matches_per_bucket ? +((r.matches / r.matches_per_bucket) * 100).toFixed(1) : 0,
  })), [q.data, sel]);

  const List = ({ title, rows, up }: { title: string; rows: typeof trends; up: boolean }) => (
    <section className="panel p-4">
      <h2 className={cn("mb-3 inline-flex items-center gap-2 font-display text-sm font-semibold uppercase tracking-wider", up ? "text-win" : "text-loss")}>{up ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}{title}</h2>
      <div className="space-y-1">
        {rows.map((r) => (
          <button key={r.hero_id} onClick={() => setHero(r.hero_id)} className={cn("flex w-full items-center gap-3 rounded-lg p-2 text-left hover:bg-accent", sel === r.hero_id && "bg-accent")}>
            <HeroIcon heroId={r.hero_id} size={32} />
            <span className="flex-1 truncate">{heroes.get(r.hero_id)?.name}</span>
            <span className="tabular text-xs text-muted-foreground">{(r.prevWr * 100).toFixed(1)}% → {(r.recentWr * 100).toFixed(1)}%</span>
            <span className={cn("tabular w-14 text-right text-sm font-semibold", r.delta >= 0 ? "text-win" : "text-loss")}>{r.delta >= 0 ? "+" : ""}{(r.delta * 100).toFixed(1)}</span>
          </button>
        ))}
      </div>
    </section>
  );

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Мета" title="Тренды меты">Последние 7 дней против предыдущих 7: изменение винрейта (в п.п.) и популярности.</PageHeader>
      <RankRangeFilter value={range} onChange={setRange} />
      {q.isLoading ? <Loading /> : q.error ? <ErrorBox error={q.error} /> : (
        <>
          {sel && (
            <section className="panel p-4">
              <div className="mb-3 flex items-center gap-3">
                <HeroIcon heroId={sel} size={36} />
                <Link to="/heroes/$heroId" params={{ heroId: String(sel) }} className="font-display font-semibold hover:text-primary">{heroes.get(sel)?.name}</Link>
                <span className="text-xs text-muted-foreground">по дням · <span className="text-primary">винрейт</span> · <span className="text-secondary-foreground">популярность</span></span>
              </div>
              <div className="h-64">
                <ResponsiveContainer>
                  <LineChart data={series}>
                    <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
                    <XAxis dataKey="d" stroke="var(--muted-foreground)" fontSize={11} />
                    <YAxis yAxisId="wr" stroke="var(--muted-foreground)" fontSize={11} domain={["auto", "auto"]} unit="%" />
                    <YAxis yAxisId="pk" orientation="right" stroke="var(--muted-foreground)" fontSize={11} unit="%" />
                    <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)" }} />
                    <Line yAxisId="wr" dataKey="wr" name="Винрейт" stroke="var(--primary)" strokeWidth={2} dot={false} />
                    <Line yAxisId="pk" dataKey="pick" name="Популярность" stroke="var(--team-sapphire)" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </section>
          )}
          <div className="grid gap-4 lg:grid-cols-2">
            <List title="Взлетели" rows={risers} up />
            <List title="Просели" rows={fallers} up={false} />
          </div>
        </>
      )}
    </div>
  );
}
