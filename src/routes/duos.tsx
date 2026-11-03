import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import { Empty, HeroIcon, HeroSelect, Loading, PageHeader, WinrateBar, useHeroMap } from "@/components/dl";
import { api } from "@/lib/api";
import { fmtInt } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/duos")({
  head: () => ({
    meta: [
      { title: "Дуо-линии Deadlock — винрейт пары героев против пары" },
      { name: "description", content: "Выберите двух союзников и двух соперников на линии и узнайте винрейт связки в Deadlock." },
      { property: "og:title", content: "Дуо-линии Deadlock" },
      { property: "og:description", content: "Винрейт пары героев против пары соперников." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Duos,
});

interface Comb { hero_ids: number[]; wins: number; losses: number; matches: number }
interface Counter { hero_id: number; enemy_hero_id: number; wins: number; matches_played: number }
const since = () => Math.floor(Date.now() / 1000 / 86400) * 86400 - 30 * 86400;

function Duos() {
  const heroes = useHeroMap();
  const [sel, setSel] = useState<(number | null)[]>([null, null, null, null]);
  const set = (i: number) => (v: number | null) => setSel((s) => s.map((x, j) => (j === i ? v : x)));
  const [a1, a2, e1, e2] = sel;
  const ready = !!(a1 && a2 && a1 !== a2);
  const enemies = [e1, e2].filter(Boolean) as number[];

  const pair = useQuery({
    queryKey: ["duo", a1, a2, enemies.join(",")],
    enabled: ready,
    queryFn: async () => {
      const rows = await api<Comb[]>("/v1/analytics/hero-comb-stats", { comb_size: 2, include_hero_ids: `${a1},${a2}`, include_enemy_hero_ids: enemies.join(",") || undefined, min_unix_timestamp: since(), min_matches: 1 });
      return rows.find((r) => r.hero_ids.includes(a1!) && r.hero_ids.includes(a2!)) ?? null;
    },
  });
  const counters = useQuery({
    queryKey: ["duo-counters", a1, a2],
    enabled: ready && enemies.length > 0,
    queryFn: () => api<Counter[]>("/v1/analytics/hero-counter-stats", { min_unix_timestamp: since(), same_lane_filter: true }),
    staleTime: 3600_000,
  });

  const slots = [["Союзник 1", 0], ["Союзник 2", 1], ["Соперник 1", 2], ["Соперник 2", 3]] as const;
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Мета" title="Дуо-линии">Двое ваших героев против двух соперников на линии — данные за 30 дней.</PageHeader>
      <div className="grid gap-4 md:grid-cols-2">
        {[0, 1].map((side) => (
          <section key={side} className={cn("panel space-y-3 p-4", side === 0 ? "border-amber-team/40" : "border-sapphire-team/40")}>
            <h2 className={cn("font-display text-sm uppercase tracking-wider", side === 0 ? "text-amber-team" : "text-sapphire-team")}>{side === 0 ? "Ваша пара" : "Пара соперников (необязательно)"}</h2>
            {slots.filter(([, i]) => (side === 0 ? i < 2 : i >= 2)).map(([l, i]) => (
              <div key={i} className="flex items-center gap-3">
                {sel[i] ? <HeroIcon heroId={sel[i]!} size={36} /> : <span className="h-9 w-9 rounded-lg border border-dashed border-border" />}
                <div className="flex-1"><p className="mb-1 text-xs text-muted-foreground">{l}</p><HeroSelect value={sel[i] ?? null} onChange={set(i)} allowAll={false} /></div>
              </div>
            ))}
          </section>
        ))}
      </div>
      {!ready ? <Empty>Выберите двух разных героев своей пары.</Empty> : pair.isLoading ? <Loading /> : !pair.data ? <Empty>Слишком мало матчей с такой связкой за 30 дней.</Empty> : (
        <section className="panel p-5">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex -space-x-2"><HeroIcon heroId={a1!} size={48} /><HeroIcon heroId={a2!} size={48} /></div>
            {enemies.length > 0 && <><span className="font-display text-muted-foreground">против</span><div className="flex -space-x-2">{enemies.map((e) => <HeroIcon key={e} heroId={e} size={48} />)}</div></>}
            <div className="ml-auto text-right">
              <p className={cn("tabular font-display text-4xl font-bold", pair.data.wins / pair.data.matches >= 0.5 ? "text-win" : "text-loss")}>{((pair.data.wins / pair.data.matches) * 100).toFixed(1)}%</p>
              <p className="text-xs text-muted-foreground">{fmtInt(pair.data.matches)} матчей</p>
            </div>
          </div>
          <div className="mt-4"><WinrateBar value={pair.data.wins / pair.data.matches} /></div>
          {pair.data.matches < 50 && <p className="mt-3 text-xs text-muted-foreground">Мало матчей — результат может быть случайным.</p>}
          {enemies.length > 0 && counters.data && (
            <div className="mt-5 grid gap-2 sm:grid-cols-2">
              {[a1!, a2!].flatMap((a) => enemies.map((e) => {
                const c = counters.data.find((r) => r.hero_id === a && r.enemy_hero_id === e);
                const wr = c && c.matches_played ? c.wins / c.matches_played : null;
                return (
                  <div key={`${a}-${e}`} className="flex items-center gap-2 rounded-lg border border-border p-2 text-sm">
                    <HeroIcon heroId={a} size={24} /><span className="text-muted-foreground">vs</span><HeroIcon heroId={e} size={24} />
                    <span className="truncate">{heroes.get(a)?.name} против {heroes.get(e)?.name}</span>
                    <span className={cn("tabular ml-auto font-semibold", wr === null ? "text-muted-foreground" : wr >= 0.5 ? "text-win" : "text-loss")}>{wr === null ? "—" : `${(wr * 100).toFixed(1)}%`}</span>
                  </div>
                );
              }))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
