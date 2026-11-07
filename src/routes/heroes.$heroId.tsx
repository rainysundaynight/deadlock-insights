import { useQuery } from "@tanstack/react-query";
import { GameItem } from "@/components/GameItem";
import { Link, createFileRoute } from "@tanstack/react-router";
import { Heart } from "lucide-react";
import { useMemo } from "react";

import { Empty, ErrorBox, HeroIcon, Loading, SectionTitle, Stat, WinrateBar, useHeroMap, useItemMap } from "@/components/dl";
import { api, type HeroAnalytics, type Item } from "@/lib/api";
import { fmtAgo, fmtInt, fmtK, kda, stripHtml, winrate } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { BuildEntry } from "./builds";
import { HeroRankWinrates } from "@/components/RankMeta";
import { HeroFigure } from "@/components/HeroFigure";

export const Route = createFileRoute("/heroes/$heroId")({
  head: ({ params }) => ({
    meta: [
      { title: `Герой ${params.heroId} — The Deadlocked Gazette` },
      { name: "description", content: "Подробная статистика героя Deadlock: способности, контрпики, синергии, лучшие предметы и билды." },
      { property: "og:title", content: `Герой ${params.heroId} — The Deadlocked Gazette` },
      { property: "og:description", content: "Способности, контрпики, предметы и билды героя Deadlock." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: HeroPage,
});

const since = () => Math.floor(Date.now() / 1000 / 3600) * 3600 - 30 * 86400;

interface Counter { hero_id: number; enemy_hero_id: number; wins: number; matches_played: number }
interface Synergy { hero_id1: number; hero_id2: number; wins: number; matches_played: number }
interface ItemStat { item_id: number; wins: number; matches: number; avg_buy_time_s: number }

function HeroPage() {
  const { heroId } = Route.useParams();
  const id = Number(heroId);
  const heroes = useHeroMap();
  const hero = heroes.get(id);
  const items = useItemMap();

  const stats = useQuery({ queryKey: ["hero-stats-30", id], queryFn: () => api<HeroAnalytics[]>("/v1/analytics/hero-stats", { min_unix_timestamp: since() }) });
  const abilities = useQuery({ queryKey: ["abilities", id], queryFn: () => api<Item[]>(`/v1/assets/items/by-hero-id/${id}`, { language: "russian" }), staleTime: 86400000 });
  const counters = useQuery({ queryKey: ["counters"], queryFn: () => api<Counter[]>("/v1/analytics/hero-counter-stats", { min_unix_timestamp: since() }) });
  const synergy = useQuery({ queryKey: ["synergy"], queryFn: () => api<Synergy[]>("/v1/analytics/hero-synergy-stats", { min_unix_timestamp: since() }) });
  const itemStats = useQuery({ queryKey: ["item-stats", id], queryFn: () => api<ItemStat[]>("/v1/analytics/item-stats", { hero_id: id, min_unix_timestamp: since() }) });
  const builds = useQuery({ queryKey: ["hero-builds", id], queryFn: () => api<BuildEntry[]>("/v1/builds", { hero_id: id, sort_by: "favorites", limit: 6, only_latest: true }) });

  const me = stats.data?.find((s) => s.hero_id === id);
  const signatures = useMemo(() => {
    const names = ["signature1", "signature2", "signature3", "signature4"].map((k) => hero?.items?.[k]);
    return names.map((n) => abilities.data?.find((a) => a.class_name === n)).filter(Boolean) as Item[];
  }, [hero, abilities.data]);

  const vs = useMemo(() => {
    const rows = (counters.data ?? []).filter((c) => c.hero_id === id && c.matches_played > 200 && heroes.has(c.enemy_hero_id));
    const s = rows.map((r) => ({ id: r.enemy_hero_id, wr: winrate(r.wins, r.matches_played), n: r.matches_played })).sort((a, b) => b.wr - a.wr);
    return { best: s.slice(0, 5), worst: s.slice(-5).reverse() };
  }, [counters.data, id, heroes]);

  const syn = useMemo(() => {
    const rows = (synergy.data ?? [])
      .filter((r) => (r.hero_id1 === id || r.hero_id2 === id) && r.matches_played > 200)
      .map((r) => ({ id: r.hero_id1 === id ? r.hero_id2 : r.hero_id1, wr: winrate(r.wins, r.matches_played), n: r.matches_played }))
      .filter((r) => heroes.has(r.id));
    return rows.sort((a, b) => b.wr - a.wr).slice(0, 5);
  }, [synergy.data, id, heroes]);

  const topItems = useMemo(() => {
    const rows = (itemStats.data ?? []).filter((r) => items.has(r.item_id));
    const max = Math.max(1, ...rows.map((r) => r.matches));
    return rows
      .filter((r) => r.matches > max * 0.05)
      .map((r) => ({ ...r, wr: winrate(r.wins, r.matches), item: items.get(r.item_id)! }))
      .sort((a, b) => b.wr - a.wr)
      .slice(0, 12);
  }, [itemStats.data, items]);

  if (!hero) return <Loading />;

  return (
    <div className="space-y-12">
      <section className="hero-dossier-heading dossier-heading">
          <div className="dossier-heading-copy">
            <p className="game-status-plate mb-4 text-primary">{hero.hero_type ?? "Герой"} / Досье № {id}</p>
            <h1 className="font-masthead font-bold uppercase">{hero.name}</h1>
            <div className="mt-4 flex flex-wrap gap-2">{(hero.tags ?? []).slice(0, 3).map((tag) => <span key={tag} className="game-status-plate text-primary">{tag}</span>)}</div>
            {hero.description?.role && <p className="mt-2 text-lg text-foreground/90">{stripHtml(hero.description.role)}</p>}
            {hero.description?.playstyle && <p className="mt-2 text-sm text-muted-foreground">{stripHtml(hero.description.playstyle)}</p>}
            <Link to="/leaderboard" search={{ hero: id }} className="mt-4 inline-block text-sm text-primary hover:underline">
              Лучшие игроки на {hero.name} →
            </Link>
          </div>
          <HeroFigure hero={hero} />
      {me && (
        <div className="hero-dossier-stats grid grid-cols-2 gap-3 xl:grid-cols-4">
          <Stat variant="game" label="Винрейт · 30 дн" value={`${(winrate(me.wins, me.matches) * 100).toFixed(1)}%`} tone={me.wins / me.matches >= 0.5 ? "win" : "loss"} />
          <Stat variant="game" label="Матчей" value={fmtInt(me.matches)} />
          <Stat variant="game" label="KDA" value={kda(me.total_kills, me.total_deaths, me.total_assists)} tone="brass" />
          <Stat variant="game" label="Урон / матч" value={fmtK(me.total_player_damage / me.matches)} />
        </div>
      )}
      </section>

      {signatures.length > 0 && (
        <section>
          <SectionTitle>Способности</SectionTitle>
          <div className="grid gap-3 md:grid-cols-2">
            {signatures.map((a, i) => (
              <div key={a.id} className="panel flex gap-4 p-4">
                <div className="relative shrink-0">
                  <img src={a.image_webp ?? a.image} alt={a.name} className="h-14 w-14 rounded-md border border-primary/40 bg-muted p-1" />
                  <span className="absolute -bottom-1 -right-1 grid h-5 w-5 place-items-center rounded-full bg-primary text-xs font-bold text-primary-foreground">{i + 1}</span>
                </div>
                <div>
                  <p className="font-display text-lg uppercase">{a.name}</p>
                  <p className="text-sm text-muted-foreground">{stripHtml(a.description?.desc ?? "")}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section>
        <SectionTitle>Винрейт по рангам</SectionTitle>
        <HeroRankWinrates heroId={id} />
      </section>

      <section className="grid gap-6 lg:grid-cols-3">
        <MatchupList title="Силён против" rows={vs.best} loading={counters.isLoading} />
        <MatchupList title="Слаб против" rows={vs.worst} loading={counters.isLoading} />
        <MatchupList title="Лучшие союзники" rows={syn} loading={synergy.isLoading} />
      </section>

      <section>
        <SectionTitle>Предметы с лучшим винрейтом</SectionTitle>
        {itemStats.isLoading ? <Loading /> : itemStats.error ? <ErrorBox error={itemStats.error} /> : (
          <div className="hero-item-list grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {topItems.map((r) => (
              <div key={r.item_id} className="panel flex min-w-0 items-center gap-3 p-3">
                <GameItem item={r.item} size={40} variant="image" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{r.item.name}</p>
                  <p className="text-xs text-muted-foreground">{fmtInt(r.matches)} матчей · {fmtInt(r.item.cost)} душ</p>
                </div>
                <WinrateBar value={r.wr} />
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <SectionTitle right={<Link to="/builds" search={{ hero: id }} className="text-sm text-muted-foreground hover:text-primary">Все билды →</Link>}>Популярные билды</SectionTitle>
        {builds.isLoading ? <Loading /> : !builds.data?.length ? <Empty>Билдов нет</Empty> : (
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {builds.data.map((b) => (
              <div key={b.hero_build.hero_build_id} className="panel min-w-0 p-4">
                <p className="truncate font-display text-lg">{b.hero_build.name}</p>
                <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{b.hero_build.description || "Без описания"}</p>
                <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1 text-primary"><Heart className="h-3 w-3" />{fmtK(b.num_favorites)}</span>
                  <span>ID {b.hero_build.hero_build_id} · {fmtAgo(b.hero_build.last_updated_timestamp)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {hero.description?.lore && (
        <section className="panel p-6">
          <SectionTitle>История</SectionTitle>
          <p className="whitespace-pre-line leading-relaxed text-muted-foreground">{stripHtml(hero.description.lore)}</p>
        </section>
      )}
    </div>
  );
}

function MatchupList({ title, rows, loading }: { title: string; rows: { id: number; wr: number; n: number }[]; loading: boolean }) {
  return (
    <div className="panel p-4">
      <h3 className="mb-3 font-display text-sm uppercase tracking-widest text-primary">{title}</h3>
      {loading ? <Loading /> : (
        <div className="space-y-2">
          {rows.map((r) => (
            <Link key={r.id} to="/heroes/$heroId" params={{ heroId: String(r.id) }} className={cn("flex items-center justify-between rounded p-1 hover:bg-accent/50")}>
              <HeroIcon heroId={r.id} size={32} withName />
              <WinrateBar value={r.wr} />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
