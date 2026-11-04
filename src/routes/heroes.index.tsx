import { useQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { ArrowDown } from "lucide-react";
import { useMemo, useState } from "react";

import { Chip, ErrorBox, RankRangeFilter, rankParams, type RankRange, HeroIcon, Loading, PageHeader, WinrateBar, useHeroMap } from "@/components/dl";
import { api, heroesQuery, type HeroAnalytics } from "@/lib/api";
import { fmtInt, fmtK, fmtPct, kda, winrate } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/heroes/")({
  head: () => ({
    meta: [
      { title: "Герои Deadlock — винрейт и пикрейт" },
      { name: "description", content: "Актуальная мета героев Deadlock: винрейт, пикрейт, KDA по рангам и периодам." },
      { property: "og:title", content: "Герои Deadlock — винрейт и пикрейт" },
      { property: "og:description", content: "Мета героев Deadlock по рангам и периодам." },
    ],
  }),
  component: HeroesPage,
});

const PERIODS = [
  { d: 7, label: "7 дней" },
  { d: 30, label: "30 дней" },
  { d: 90, label: "90 дней" },
];
type SortKey = "winrate" | "pickrate" | "matches" | "kda" | "nw";

function HeroesPage() {
  const [period, setPeriod] = useState(7);
  const [range, setRange] = useState<RankRange>([0, 11]);
  const [sort, setSort] = useState<SortKey>("winrate");
  const [view, setView] = useState<"table" | "grid">("table");
  const heroes = useHeroMap();
  const heroList = useQuery(heroesQuery);

  const q = useQuery({
    queryKey: ["hero-stats", period, range],
    queryFn: () =>
      api<HeroAnalytics[]>("/v1/analytics/hero-stats", {
        min_unix_timestamp: Math.floor(Date.now() / 1000 / 3600) * 3600 - period * 86400,
        ...rankParams(range),
      }),
  });

  const rows = useMemo(() => {
    const data = (q.data ?? []).filter((s) => heroes.has(s.hero_id));
    const total = data.reduce((s, r) => s + r.matches, 0) / 12;
    const mapped = data.map((s) => ({
      ...s,
      wr: winrate(s.wins, s.matches),
      pr: total ? s.matches / total : 0,
      kdaV: (s.total_kills + s.total_assists) / Math.max(1, s.total_deaths),
      nw: s.total_net_worth / Math.max(1, s.matches),
    }));
    const key = { winrate: "wr", pickrate: "pr", matches: "matches", kda: "kdaV", nw: "nw" }[sort] as "wr";
    return mapped.sort((a, b) => b[key] - a[key]);
  }, [q.data, heroes, sort]);

  const Th = ({ k, children }: { k: SortKey; children: string }) => (
    <th className="p-3">
      <button onClick={() => setSort(k)} className={cn("inline-flex items-center gap-1 uppercase", sort === k && "text-primary")}>
        {children}
        {sort === k && <ArrowDown className="h-3 w-3" />}
      </button>
    </th>
  );

  return (
    <div>
      <PageHeader eyebrow="Мета" title="Герои">
        Статистика по всем героям на основе публичных матчей.
      </PageHeader>
      <div className="mb-6 flex flex-wrap items-center gap-2">
        {PERIODS.map((p) => (
          <Chip key={p.d} active={period === p.d} onClick={() => setPeriod(p.d)}>{p.label}</Chip>
        ))}
        <span className="mx-2 h-6 w-px bg-border" />
        <RankRangeFilter value={range} onChange={setRange} />
        <span className="ml-auto flex gap-2">
          <Chip active={view === "table"} onClick={() => setView("table")}>Таблица</Chip>
          <Chip active={view === "grid"} onClick={() => setView("grid")}>Карточки</Chip>
        </span>
      </div>

      {view === "grid" ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {heroList.data?.map((h) => {
            const s = rows.find((r) => r.hero_id === h.id);
            return (
              <Link key={h.id} to="/heroes/$heroId" params={{ heroId: String(h.id) }} className="panel panel-hover group overflow-hidden">
                <div className="aspect-[3/4] overflow-hidden bg-muted">
                  <img src={h.images.icon_hero_card_webp ?? h.images.icon_hero_card} alt={h.name} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" loading="lazy" />
                </div>
                <div className="p-3">
                  <p className="font-display uppercase">{h.name}</p>
                  {s && <p className={cn("tabular text-xs", s.wr >= 0.5 ? "text-win" : "text-loss")}>{fmtPct(s.wr)}</p>}
                </div>
              </Link>
            );
          })}
        </div>
      ) : q.isLoading ? (
        <Loading />
      ) : q.error ? (
        <ErrorBox error={q.error} />
      ) : (
        <div className="panel overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs tracking-wider text-muted-foreground">
              <tr className="border-b border-border">
                <th className="p-3">#</th>
                <th className="p-3 uppercase">Герой</th>
                <Th k="winrate">Винрейт</Th>
                <Th k="pickrate">Пикрейт</Th>
                <Th k="matches">Матчи</Th>
                <Th k="kda">KDA</Th>
                <Th k="nw">Душ за матч</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.hero_id} className="border-b border-border/50 last:border-0 hover:bg-accent/40">
                  <td className="tabular p-3 text-muted-foreground">{i + 1}</td>
                  <td className="p-3">
                    <Link to="/heroes/$heroId" params={{ heroId: String(r.hero_id) }} className="hover:text-primary">
                      <HeroIcon heroId={r.hero_id} size={36} withName />
                    </Link>
                  </td>
                  <td className="p-3"><WinrateBar value={r.wr} /></td>
                  <td className="tabular p-3">{fmtPct(r.pr)}</td>
                  <td className="tabular p-3">{fmtInt(r.matches)}</td>
                  <td className="tabular p-3">{kda(r.total_kills, r.total_deaths, r.total_assists)}</td>
                  <td className="tabular p-3 text-primary">{fmtK(r.nw)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
