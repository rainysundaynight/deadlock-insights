import { useQuery } from "@tanstack/react-query";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { Activity, ArrowRight, Crown, GitCompare, LayoutGrid, Radio, Swords, Trophy } from "lucide-react";
import { useMemo, useState } from "react";

import cityArtwork from "@/assets/gazette-city.jpg";
import { MagneticButton, RollingNumber } from "@/components/GazetteMotion";
import { PlayerSearch } from "@/components/PlayerSearch";
import { HeroIcon, SectionTitle, inputClass, useHeroMap } from "@/components/dl";
import { api, type HeroAnalytics } from "@/lib/api";
import { fmtInt, fmtK } from "@/lib/format";
import { buildTierList } from "@/lib/tier";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "The Deadlocked Gazette — статистика и разбор матчей" },
      { name: "description", content: "Найдите игрока Deadlock, разберите матч по линиям, смотрите живую статистику и актуальный тир-лист героев." },
      { property: "og:title", content: "The Deadlocked Gazette — статистика Deadlock" },
      { property: "og:description", content: "Профили, разбор матчей, live-статистика и тир-лист Deadlock." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

interface Active { match_id: number; spectators: number; net_worth_team_0: number; net_worth_team_1: number; players: { hero_id: number; team: number }[] }

const TOOLS = [
  { to: "/tierlist", label: "Тир-лист", desc: "Сильнейшие герои по рангам", icon: Crown },
  { to: "/compare", label: "Сравнение", desc: "Два игрока бок о бок", icon: GitCompare },
  { to: "/meta", label: "Контрпики", desc: "Кого брать против кого", icon: LayoutGrid },
  { to: "/leaderboard", label: "Лидерборд", desc: "Топ игроков регионов", icon: Trophy },
] as const;

function Index() {
  const heroes = useHeroMap();
  const navigate = useNavigate();
  const [matchId, setMatchId] = useState("");
  const { data: stats } = useQuery({
    queryKey: ["tier", 80, 7],
    queryFn: () => api<HeroAnalytics[]>("/v1/analytics/hero-stats", { min_unix_timestamp: Math.floor(Date.now() / 1000 / 3600) * 3600 - 7 * 86400, min_average_badge: 80 }),
  });
  const live = useQuery({ queryKey: ["active"], queryFn: () => api<Active[]>("/v1/matches/active"), refetchInterval: 60_000 });
  const tiers = useMemo(() => buildTierList((stats ?? []).filter((s) => heroes.has(s.hero_id))), [stats, heroes]);
  const featured = useMemo(() => [...(live.data ?? [])].sort((a, b) => b.spectators - a.spectators).slice(0, 4), [live.data]);
  const totalMatches = useMemo(() => (stats ?? []).reduce((s, r) => s + r.matches, 0) / 12, [stats]);
  const ticker = [
    live.data ? `В ЭФИРЕ: ${fmtInt(live.data.length)} матчей` : "ПРЯМАЯ СВЯЗЬ · DEADLOCK",
    ...tiers.slice(0, 4).map((r) => `${heroes.get(r.hero_id)?.name.toUpperCase()} · ${(r.winrate * 100).toFixed(1)}% ПОБЕД · ${r.tier}-ТИР`),
    "МЕТА НЕДЕЛИ · ORACLE+",
  ];

  return (
    <div className="space-y-12">
      <section className="relative -mx-4 -mt-8 border-b border-border px-4 pb-8 pt-10 lg:-mx-8 lg:px-8">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <img src={cityArtwork} alt="" width={1920} height={1024} className="h-full w-full object-cover object-center" />
          <div className="gazette-hero absolute inset-0" />
        </div>
        <div className="relative mx-auto text-center">
          <div className="mb-7 flex items-center justify-between border-y border-primary/40 py-2 text-[10px] uppercase text-primary md:text-xs"><span>Независимое издание</span><span className="hidden sm:inline">Нью-Йорк · По ту сторону завесы</span><span>Deadlock · Спецвыпуск</span></div>
          <p className="mb-2 font-masthead text-sm text-primary">The</p>
          <h1 className="gazette-masthead text-[36px] font-semibold leading-[1.05] text-foreground sm:text-6xl xl:text-[80px]">DEADLOCKED<br /><span className="text-primary">GAZETTE</span></h1>
          <div className="mx-auto my-6 flex max-w-md items-center gap-4 text-primary"><span className="h-px flex-1 bg-primary/40" /><span>◆</span><span className="h-px flex-1 bg-primary/40" /></div>
          <p className="mx-auto max-w-xl font-display text-base italic text-foreground/80 md:text-xl">Все души учтены. Каждая история имеет значение.</p>
          <div className="relative mx-auto mt-7 max-w-xl text-left"><PlayerSearch /></div>
          <form className="mx-auto mt-3 flex max-w-xl gap-2" onSubmit={(e) => { e.preventDefault(); if (/^\d+$/.test(matchId.trim())) navigate({ to: "/matches/$matchId", params: { matchId: matchId.trim() } }); }}>
            <input aria-label="ID матча" value={matchId} onChange={(e) => setMatchId(e.target.value)} placeholder="Номер дела · ID матча" className={cn(inputClass, "bg-background/80")} />
            <MagneticButton type="submit" variant="outline" className="h-10 border-primary/40 text-primary">Открыть <ArrowRight /></MagneticButton>
          </form>
          <div className="mx-auto mt-7 grid max-w-xl grid-cols-3 divide-x divide-border border-y border-border py-4">
            <div><p className="tabular text-xl text-primary">{totalMatches ? fmtK(totalMatches) : "—"}</p><p className="mt-1 text-[10px] uppercase text-muted-foreground">матчей Oracle+ / нед.</p></div>
            <div><p className="tabular text-xl text-foreground">{heroes.size ? <RollingNumber value={heroes.size} /> : "—"}</p><p className="mt-1 text-[10px] uppercase text-muted-foreground">героев в архиве</p></div>
            <div><p className="tabular text-xl text-telemetry">{live.data ? fmtInt(live.data.reduce((s, m) => s + m.spectators, 0)) : "—"}</p><p className="mt-1 text-[10px] uppercase text-muted-foreground">зрителей сейчас</p></div>
          </div>
        </div>
      </section>
      <div className="!-mt-12 flex overflow-hidden border-b border-border bg-sidebar" aria-label="Новости меты">
        <span className="z-10 flex shrink-0 items-center gap-2 border-r border-border bg-telemetry/10 px-4 text-[10px] font-semibold uppercase text-telemetry"><Radio className="h-3 w-3" /> Телеграф</span>
        <div className="min-w-0 flex-1 overflow-hidden"><div className="ticker-track" aria-hidden="true">{[0, 1].map((copy) => <div key={copy} className="flex shrink-0 items-center">{ticker.map((t, i) => <span key={i} className="whitespace-nowrap px-6 py-3 font-mono text-[10px] text-muted-foreground">{t}<span className="ml-6 text-primary">✦</span></span>)}</div>)}</div><span className="sr-only">{ticker.join(". ")}</span></div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="border-t border-primary/40 pt-5 lg:col-span-2">
          <SectionTitle right={<Link to="/tierlist" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary">Тир-лист <ArrowRight className="h-4 w-4" /></Link>}>Мета недели · Oracle+</SectionTitle>
          <div className="grid gap-2 sm:grid-cols-2">
            {tiers.slice(0, 8).map((r, i) => (
              <Link key={r.hero_id} to="/heroes/$heroId" params={{ heroId: String(r.hero_id) }} className="flex items-center gap-3 rounded-lg p-2 transition-colors hover:bg-accent">
                <span className="tabular w-5 text-sm text-muted-foreground">{i + 1}</span>
                <HeroIcon heroId={r.hero_id} size={40} className="rounded-lg" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{heroes.get(r.hero_id)?.name}</p>
                  <p className="text-xs text-muted-foreground">{fmtInt(r.matches)} матчей</p>
                </div>
                <span className="tier-seal inline-grid h-7 w-7 place-items-center text-xs font-bold">{r.tier}</span>
                <span className="tabular w-14 text-right text-sm text-win">{(r.winrate * 100).toFixed(1)}%</span>
              </Link>
            ))}
          </div>
        </section>
        <section className="border-t border-primary/40 pt-5 lg:border-l lg:border-border lg:pl-6">
          <SectionTitle right={<Link to="/live" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary">Все <ArrowRight className="h-4 w-4" /></Link>}>
            <span className="inline-flex items-center gap-2"><Radio className="h-4 w-4 text-telemetry" /> В эфире</span>
          </SectionTitle>
          <div className="space-y-2">
            {featured.map((m) => {
              const tot = m.net_worth_team_0 + m.net_worth_team_1 || 1;
              return (
                <Link key={m.match_id} to="/matches/$matchId" params={{ matchId: String(m.match_id) }} className="block rounded-lg border border-border p-3 transition-colors hover:border-primary/50">
                  <div className="flex items-center justify-between text-xs text-muted-foreground"><span>#{m.match_id}</span><span className="inline-flex items-center gap-1"><Activity className="h-3 w-3" />{m.spectators}</span></div>
                  <div className="mt-2 flex -space-x-1.5">{m.players.slice(0, 12).map((p, i) => <HeroIcon key={i} heroId={p.hero_id} size={22} className={cn("rounded-full", p.team === 0 ? "border-amber-team/70" : "border-sapphire-team/70")} />)}</div>
                  <div className="mt-2 flex h-1 overflow-hidden rounded-full"><div className="bg-amber-team" style={{ width: `${(m.net_worth_team_0 / tot) * 100}%` }} /><div className="flex-1 bg-sapphire-team" /></div>
                </Link>
              );
            })}
            {!featured.length && <p className="text-sm text-muted-foreground">Загрузка…</p>}
          </div>
        </section>
      </div>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {TOOLS.map((s) => (
          <Link key={s.to} to={s.to} className="panel panel-hover gazette-frame group p-5">
            <span className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary"><s.icon className="h-5 w-5" /></span>
            <p className="mt-4 font-display font-semibold">{s.label}</p>
            <p className="text-sm text-muted-foreground">{s.desc}</p>
          </Link>
        ))}
      </section>
      <p className="flex items-center gap-2 text-xs text-muted-foreground"><Swords className="h-3.5 w-3.5" /> Статистика героев обновляется каждый час.</p>
    </div>
  );
}
