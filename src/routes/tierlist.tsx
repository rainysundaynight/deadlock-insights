import { useQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";

import { Chip, ErrorBox, RankFilter, rankParams, HeroIcon, Loading, PageHeader, useHeroMap } from "@/components/dl";
import { api, type HeroAnalytics } from "@/lib/api";
import { fmtInt } from "@/lib/format";
import { buildTierList, type Tier } from "@/lib/tier";
import { cn } from "@/lib/utils";
import { LayoutGroup, motion } from "framer-motion";

export const Route = createFileRoute("/tierlist")({
  head: () => ({
    meta: [
      { title: "Тир-лист героев Deadlock — Deadlock Stats" },
      { name: "description", content: "Актуальный тир-лист героев Deadlock по рангам: винрейт, популярность, тиры S–D." },
      { property: "og:title", content: "Тир-лист героев Deadlock" },
      { property: "og:description", content: "Кто сильнее всех в текущей мете Deadlock — по данным реальных матчей." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TierPage,
});

const PERIODS = [{ label: "7 дней", d: 7 }, { label: "14 дней", d: 14 }, { label: "30 дней", d: 30 }];

const TIER_STYLE: Record<Tier, string> = {
  S: "bg-loss text-primary-foreground",
  A: "bg-primary text-primary-foreground",
  B: "bg-win text-primary-foreground",
  C: "bg-sapphire-team text-primary-foreground",
  D: "bg-muted text-muted-foreground",
};

function TierPage() {
  const heroes = useHeroMap();
  const [range, setRange] = useState<number | null>(null);
  const [days, setDays] = useState(7);
  const [view, setView] = useState<"tiers" | "table">("tiers");
  const q = useQuery({
    queryKey: ["tier", range, days],
    queryFn: () =>
      api<HeroAnalytics[]>("/v1/analytics/hero-stats", {
        min_unix_timestamp: Math.floor(Date.now() / 1000 / 3600) * 3600 - days * 86400,
        ...rankParams(range),
      }),
  });
  const rows = useMemo(() => buildTierList((q.data ?? []).filter((r) => heroes.has(r.hero_id))), [q.data, heroes]);

  return (
    <div>
      <PageHeader eyebrow="Мета" title="Тир-лист героев">
        Оценка учитывает винрейт (сглаженный по числу матчей) и популярность героя в выбранном ранге.
      </PageHeader>
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <RankFilter value={range} onChange={setRange} />
        <span className="mx-2 h-5 w-px bg-border" />
        {PERIODS.map((p) => <Chip key={p.d} active={days === p.d} onClick={() => setDays(p.d)}>{p.label}</Chip>)}
        <span className="ml-auto flex gap-2">
          <Chip active={view === "tiers"} onClick={() => setView("tiers")}>Тиры</Chip>
          <Chip active={view === "table"} onClick={() => setView("table")}>Таблица</Chip>
        </span>
      </div>
      {q.isLoading ? <Loading /> : q.error ? <ErrorBox error={q.error} /> : view === "tiers" ? (
        <LayoutGroup><div className="space-y-6">
          {(["S", "A", "B", "C", "D"] as Tier[]).map((t) => {
            const list = rows.filter((r) => r.tier === t);
            if (!list.length) return null;
            return (
              <div key={t} className="flex border-t border-primary/30 pt-4">
                <div className="flex w-16 shrink-0 items-start justify-center pt-4"><span className={cn("tier-seal grid h-11 w-11 place-items-center text-2xl font-bold", t === "S" && "tier-seal-high")}>{t}</span></div>
                <div className="flex flex-1 flex-wrap gap-3 p-4">
                  {list.map((r) => (
                    <motion.div layout layoutId={`tier-hero-${r.hero_id}`} key={r.hero_id}><Link to="/heroes/$heroId" params={{ heroId: String(r.hero_id) }} className="gazette-frame group block w-24 bg-card p-2 text-center">
                      <HeroIcon heroId={r.hero_id} size={64} className="mx-auto rounded-sm transition-transform group-hover:scale-105 group-hover:border-primary" />
                      <p className="mt-1 truncate text-xs font-medium">{heroes.get(r.hero_id)?.name}</p>
                      <p className={cn("tabular text-[11px]", r.winrate >= 0.5 ? "text-win" : "text-loss")}>{(r.winrate * 100).toFixed(1)}%</p>
                    </Link></motion.div>
                  ))}
                </div>
              </div>
            );
          })}
        </div></LayoutGroup>
      ) : (
        <div className="panel overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr className="border-b border-border"><th className="p-3">#</th><th className="p-3">Тир</th><th className="p-3">Герой</th><th className="p-3">Винрейт</th><th className="p-3">Пикрейт</th><th className="p-3">Матчи</th><th className="p-3">Оценка</th></tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.hero_id} className="border-b border-border/50 last:border-0 hover:bg-accent/40">
                  <td className="tabular p-3 text-muted-foreground">{i + 1}</td>
                  <td className="p-3"><span className={cn("inline-grid h-7 w-7 place-items-center rounded-md font-display text-sm font-bold", TIER_STYLE[r.tier])}>{r.tier}</span></td>
                  <td className="p-3"><Link to="/heroes/$heroId" params={{ heroId: String(r.hero_id) }} className="hover:text-primary"><HeroIcon heroId={r.hero_id} size={32} withName /></Link></td>
                  <td className={cn("tabular p-3", r.winrate >= 0.5 ? "text-win" : "text-loss")}>{(r.winrate * 100).toFixed(2)}%</td>
                  <td className="tabular p-3">{(r.pickrate * 100 * 12).toFixed(1)}%</td>
                  <td className="tabular p-3 text-muted-foreground">{fmtInt(r.matches)}</td>
                  <td className="tabular p-3">{r.score.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
