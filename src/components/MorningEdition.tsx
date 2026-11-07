import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { TrendingDown, TrendingUp, Users } from "lucide-react";
import { useMemo } from "react";

import { HeroIcon, useHeroMap } from "@/components/dl";
import { api } from "@/lib/api";
import { dailyEdition, type DayRow } from "@/lib/trends";
import { cn } from "@/lib/utils";

/** «Утренний выпуск»: yesterday vs the day before — riser, faller and pick surge. */
export function MorningEdition() {
  const heroes = useHeroMap();
  const since = Math.floor(Date.now() / 86400_000) * 86400 - 3 * 86400;
  const q = useQuery({ queryKey: ["morning", since], queryFn: () => api<DayRow[]>("/v1/analytics/hero-stats", { bucket: "start_time_day", min_unix_timestamp: since }), staleTime: 3600_000 });
  const ed = useMemo(() => dailyEdition((q.data ?? []).filter((r) => heroes.has(r.hero_id)), Math.floor(Date.now() / 86400_000) * 86400), [q.data, heroes]);
  if (!ed) return null;
  const cards = [
    { k: "Герой дня", t: ed.riser, icon: TrendingUp, tone: "text-win", v: `${ed.riser.delta >= 0 ? "+" : ""}${(ed.riser.delta * 100).toFixed(1)} п.п.`, sub: `${(ed.riser.recentWr * 100).toFixed(1)}% побед` },
    { k: "Главный спад", t: ed.faller, icon: TrendingDown, tone: "text-loss", v: `${(ed.faller.delta * 100).toFixed(1)} п.п.`, sub: `${(ed.faller.recentWr * 100).toFixed(1)}% побед` },
    { k: "Взлёт популярности", t: ed.picked, icon: Users, tone: "text-primary", v: `+${(ed.picked.pickDelta * 100).toFixed(1)} п.п.`, sub: `${(ed.picked.recentPick * 100).toFixed(1)}% матчей` },
  ];
  return (
    <section className="border-y border-primary/40 py-5">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-masthead text-2xl text-primary">Утренний выпуск</h2>
        <p className="font-mono text-[10px] uppercase text-muted-foreground">вчера против позавчера · все ранги</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-3 sm:divide-x sm:divide-border">
        {cards.map(({ k, t, icon: Icon, tone, v, sub }) => (
          <Link key={k} to="/heroes/$heroId" params={{ heroId: String(t.hero_id) }} className="group flex items-center gap-4 sm:pl-4 sm:first:pl-0">
            <HeroIcon heroId={t.hero_id} size={56} className="rounded-none transition-transform group-hover:scale-105" />
            <div className="min-w-0">
              <p className="game-status-plate mb-1 text-[10px] text-muted-foreground"><Icon className={cn("mr-1 inline h-3 w-3", tone)} />{k}</p>
              <p className="truncate font-display text-lg font-bold">{heroes.get(t.hero_id)?.name}</p>
              <p className="text-xs"><span className={cn("tabular font-semibold", tone)}>{v}</span> <span className="text-muted-foreground">· {sub}</span></p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
