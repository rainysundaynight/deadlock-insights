import { useQuery } from "@tanstack/react-query";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { Activity, ArrowRight, Crown, GitCompare, LayoutGrid, Radio, Swords, Trophy } from "lucide-react";
import { useMemo, useState } from "react";

import { PlayerSearch } from "@/components/PlayerSearch";
import { HeroIcon, SectionTitle, inputClass, useHeroMap } from "@/components/dl";
import { api, type HeroAnalytics } from "@/lib/api";
import { fmtInt, fmtK } from "@/lib/format";
import { buildTierList } from "@/lib/tier";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Deadlock Stats — профили игроков, тир-лист и разбор матчей" },
      { name: "description", content: "Найдите игрока Deadlock, разберите матч по линиям, смотрите живую статистику и актуальный тир-лист героев." },
      { property: "og:title", content: "Deadlock Stats — статистика Deadlock" },
      { property: "og:description", content: "Профили, разбор матчей, live-статистика и тир-лист Deadlock." },
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
  const bg = heroes.get(tiers[0]?.hero_id ?? 0)?.images.background_image_webp;

  return (
    <div className="space-y-12">
      <section className="hud-grid relative -mx-4 -mt-8 overflow-hidden border-b border-border px-4 pb-14 pt-16 lg:-mx-8 lg:px-8">
        {bg && <img src={bg} alt="" className="pointer-events-none absolute -right-20 top-0 h-full w-2/3 object-cover opacity-25 grayscale contrast-125 mix-blend-multiply [mask-image:linear-gradient(to_left,black,transparent)]" />}
        <div className="relative max-w-2xl">
          <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-border bg-secondary/60 px-3 py-1 text-xs text-muted-foreground">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-win" />
            {live.data ? `${live.data.length} матчей идут прямо сейчас` : "Данные в реальном времени"}
          </p>
          <p className="mb-3 border-y-4 border-double border-foreground/80 py-1 text-[11px] font-bold uppercase tracking-[0.35em]">Экстренный выпуск · Мета недели</p>
          <h1 className="font-display text-5xl font-black leading-[0.95] md:text-7xl">
            Играй умнее.<br /><span className="italic text-primary">Побеждай чаще.</span>
          </h1>
          <p className="mt-5 max-w-lg text-lg text-muted-foreground">Разбор каждого матча по линиям, персональные советы, живая статистика игроков и мета по рангам.</p>
          <div className="mt-8"><PlayerSearch autoFocus /></div>
          <form className="mt-3 flex max-w-sm gap-2" onSubmit={(e) => { e.preventDefault(); if (/^\d+$/.test(matchId.trim())) navigate({ to: "/matches/$matchId", params: { matchId: matchId.trim() } }); }}>
            <input value={matchId} onChange={(e) => setMatchId(e.target.value)} placeholder="или ID матча" className={cn(inputClass, "rounded-full")} />
            <button className="rounded-full border border-primary/50 px-5 text-sm font-medium text-primary hover:bg-primary hover:text-primary-foreground">Открыть</button>
          </form>
          <div className="mt-10 flex gap-10">
            <div><p className="tabular font-display text-2xl font-bold">{totalMatches ? fmtK(totalMatches) : "—"}</p><p className="text-xs text-muted-foreground">матчей Oracle+ за неделю</p></div>
            <div><p className="tabular font-display text-2xl font-bold">{heroes.size || "—"}</p><p className="text-xs text-muted-foreground">героев</p></div>
            <div><p className="tabular font-display text-2xl font-bold">{live.data ? fmtInt(live.data.reduce((s, m) => s + m.spectators, 0)) : "—"}</p><p className="text-xs text-muted-foreground">зрителей сейчас</p></div>
          </div>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="panel p-5 lg:col-span-2">
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
                <span className="rounded-md bg-primary/15 px-2 py-0.5 font-display text-xs font-bold text-primary">{r.tier}</span>
                <span className="tabular w-14 text-right text-sm text-win">{(r.winrate * 100).toFixed(1)}%</span>
              </Link>
            ))}
          </div>
        </section>
        <section className="panel p-5">
          <SectionTitle right={<Link to="/live" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary">Все <ArrowRight className="h-4 w-4" /></Link>}>
            <span className="inline-flex items-center gap-2"><Radio className="h-4 w-4 text-loss" /> В эфире</span>
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
          <Link key={s.to} to={s.to} className="panel panel-hover group p-5">
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
