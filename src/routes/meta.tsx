import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import { Empty, ErrorBox, HeroLink, HeroSelect, Loading, PageHeader, SectionTitle, WinrateBar } from "@/components/dl";
import { api, heroesQuery } from "@/lib/api";
import { fmtInt } from "@/lib/format";

export const Route = createFileRoute("/meta")({
  head: () => ({
    meta: [
      { title: "Мета: контрпики и связки — Deadlock Stats" },
      { name: "description", content: "Лучшие и худшие матчапы героев Deadlock и самые сильные связки союзников." },
      { property: "og:title", content: "Мета: контрпики и связки — Deadlock Stats" },
      { property: "og:description", content: "Контрпики и синергии героев Deadlock по реальным матчам." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MetaPage,
});

interface Counter { hero_id: number; enemy_hero_id: number; wins: number; matches_played: number }
interface Synergy { hero_id1: number; hero_id2: number; wins: number; matches_played: number }

const week = () => Math.floor(Date.now() / 1000) - 14 * 86400;

function MetaPage() {
  const heroes = useQuery(heroesQuery);
  const [hero, setHero] = useState<number | null>(null);
  const h = hero ?? heroes.data?.[0]?.id ?? null;
  const counters = useQuery({ queryKey: ["counters"], queryFn: () => api<Counter[]>("/v1/analytics/hero-counter-stats", { min_matches: 200, min_unix_timestamp: week() }), staleTime: 3600_000 });
  const syn = useQuery({ queryKey: ["synergy"], queryFn: () => api<Synergy[]>("/v1/analytics/hero-synergy-stats", { min_matches: 200, min_unix_timestamp: week() }), staleTime: 3600_000 });

  const vs = (counters.data ?? []).filter((c) => c.hero_id === h).map((c) => ({ id: c.enemy_hero_id, wr: c.wins / c.matches_played, n: c.matches_played })).sort((a, b) => b.wr - a.wr);
  const allies = (syn.data ?? []).filter((s) => s.hero_id1 === h || s.hero_id2 === h).map((s) => ({ id: s.hero_id1 === h ? s.hero_id2 : s.hero_id1, wr: s.wins / s.matches_played, n: s.matches_played })).sort((a, b) => b.wr - a.wr);

  return (
    <div>
      <PageHeader eyebrow="Аналитика · 14 дней" title="Контрпики и связки">
        Выберите героя, чтобы увидеть, против кого он побеждает чаще всего, кого стоит опасаться и с кем лучше играть в паре.
      </PageHeader>
      <div className="mb-6"><HeroSelect value={h} onChange={setHero} allowAll={false} /></div>
      {(counters.isLoading || syn.isLoading) && <Loading />}
      {counters.error && <ErrorBox error={counters.error} />}
      {syn.error && <ErrorBox error={syn.error} />}
      {counters.data && syn.data && (
        <div className="grid gap-6 lg:grid-cols-3">
          <List title="Удобные соперники" rows={vs.slice(0, 8)} />
          <List title="Опасные контрпики" rows={[...vs].reverse().slice(0, 8)} />
          <List title="Лучшие союзники" rows={allies.slice(0, 8)} />
        </div>
      )}
    </div>
  );
}

function List({ title, rows }: { title: string; rows: { id: number; wr: number; n: number }[] }) {
  return (
    <section>
      <SectionTitle>{title}</SectionTitle>
      {rows.length === 0 ? <Empty>Мало данных</Empty> : (
        <div className="panel divide-y divide-border">
          {rows.map((r) => (
            <div key={r.id} className="flex items-center justify-between gap-3 p-3">
              <HeroLink heroId={r.id} size={32} />
              <div className="text-right">
                <WinrateBar value={r.wr} />
                <p className="tabular text-xs text-muted-foreground">{fmtInt(r.n)} матчей</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
