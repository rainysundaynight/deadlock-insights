import { useQuery } from "@tanstack/react-query";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { Activity, ArrowRight, Crown, GitCompare, LayoutGrid, Radio, Swords, Trophy } from "lucide-react";
import { useMemo, useState, type CSSProperties } from "react";

import cityArtwork from "@/assets/gazette-city.jpg";
import { LayoutItem, MagneticButton, RollingNumber } from "@/components/GazetteMotion";
import { motion, useReducedMotion } from "framer-motion";
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
  const reduce = useReducedMotion();
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
      <section onMouseMove={(e) => { const r = e.currentTarget.getBoundingClientRect(); e.currentTarget.style.setProperty("--mx", String((e.clientX - r.left) / r.width - 0.5)); e.currentTarget.style.setProperty("--my", String((e.clientY - r.top) / r.height - 0.5)); }} onMouseLeave={(e) => { e.currentTarget.style.setProperty("--mx", "0"); e.currentTarget.style.setProperty("--my", "0"); }} className="relative -mx-4 -mt-8 overflow-x-clip border-b border-border px-4 pb-8 pt-10 lg:-mx-8 lg:px-8">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <img src={cityArtwork} alt="" width={1920} height={1024} className="h-full w-full object-cover object-center" />
          <div className="gazette-hero absolute inset-0" />
        </div>
        {tiers.length >= 4 && (["left", "right"] as const).map((side) => (
          <div key={side} style={{ transform: `translate(calc(var(--mx, 0) * ${side === "left" ? 14 : 14}px), calc(var(--my, 0) * 6px))` }} className={cn("absolute bottom-0 z-[3] hidden items-end transition-transform duration-700 ease-out min-[1400px]:flex", side === "left" ? "left-0" : "right-0 flex-row-reverse")}>
            <div aria-hidden className="hero-stage pointer-events-none absolute inset-x-0 bottom-0 top-[-30%]">
              <div className="hero-stage-beam absolute inset-0" />
              <div className="absolute inset-x-[10%] bottom-0 h-6 rounded-[50%] blur-md" style={{ background: "radial-gradient(closest-side, color-mix(in oklab, var(--primary) 45%, transparent), transparent)" }} />
              <div className="absolute inset-x-[5%] bottom-0 h-px" style={{ background: "linear-gradient(90deg, transparent, var(--primary), transparent)" }} />
              {Array.from({ length: 8 }).map((_, k) => <span key={k} className="hero-ember" style={{ left: `${10 + k * 11}%`, animationDelay: `${(k * 0.9) % 6}s`, animationDuration: `${5 + (k % 3)}s` }} />)}
            </div>
            {tiers.slice(side === "left" ? 0 : 2, side === "left" ? 2 : 4).map((r, i) => {
              const h = heroes.get(r.hero_id);
              if (!h) return null;
              const rank = tiers.indexOf(r) + 1;
              const alt = h.images.hero_card_gloat_webp ?? h.images.hero_card_gloat;
              return (
                <motion.div key={r.hero_id} className={cn("relative hover:!z-20", i === 0 ? "z-10" : "z-0", i > 0 && (side === "left" ? "-ml-14" : "-mr-14"))} initial={reduce ? false : { opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.3 + i * 0.12 }}>
                  <Link to="/heroes/$heroId" params={{ heroId: String(h.id) }} style={{ "--hero": h.colors?.style_hex ?? "var(--primary)" } as CSSProperties} className={cn("group relative block transition-transform duration-500 hover:-translate-y-2", i === 0 ? "w-44 2xl:w-52" : "w-36 2xl:w-44")}>
                    <div aria-hidden className="hero-spot pointer-events-none absolute -inset-x-4 -top-10 bottom-0" />
                    <div className="hero-side relative aspect-[3/4]" style={{ transform: side === "left" ? "perspective(700px) rotateY(24deg)" : "perspective(700px) rotateY(-24deg) scaleX(-1)" }}>
                      <div className="absolute inset-x-2 bottom-0 h-2/3 rounded-t-full opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-70" style={{ background: "var(--hero)" }} />
                      <div className="hero-card-clip hero-breathe absolute inset-0" style={{ animationDelay: `${i * 1.3}s` }}>
                        <img src={h.images.icon_hero_card_webp ?? h.images.icon_hero_card} alt={h.name} className="hero-pose hero-pose-idle absolute inset-0 h-full w-full object-cover object-bottom" />
                        {alt && <img src={alt} alt="" aria-hidden className="hero-pose hero-pose-alt absolute inset-0 h-full w-full object-cover object-bottom" />}
                      </div>
                    </div>
                    <div className="hero-plate pointer-events-none absolute bottom-1 left-1/2 z-10 -translate-x-1/2 transition-opacity duration-300 group-hover:opacity-0"><span className="font-masthead text-sm leading-none">№{rank}</span></div>
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 translate-y-2 pb-2 text-center [text-shadow:0_1px_3px_var(--background),0_0_12px_var(--background)] opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100">
                      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-primary">№{rank} · {r.tier}-тир</p>
                      <p className="font-display text-base uppercase leading-tight text-foreground drop-shadow">{h.name}</p>
                      <p className="tabular text-xs text-win">{(r.winrate * 100).toFixed(1)}%</p>
                    </div>
                  </Link>
                </motion.div>
              );
            })}
          </div>
        ))}
        <div className="relative z-[2] mx-auto text-center">
          <div className="mb-7 flex items-center justify-between border-y border-primary/40 py-2 text-[10px] uppercase text-primary md:text-xs"><span>Независимое издание</span><span className="hidden sm:inline">Нью-Йорк · По ту сторону завесы</span><span>Deadlock · Спецвыпуск</span></div>
          <p className="mb-2 font-masthead text-sm text-primary">The</p>
          <motion.h1 initial={reduce ? false : { opacity: 0, y: 28 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }} className="gazette-masthead text-[36px] font-semibold leading-[1.05] text-foreground sm:text-6xl xl:text-[80px]">DEADLOCKED<br /><span className="text-primary">GAZETTE</span></motion.h1>
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

      <div className="grid gap-8 lg:grid-cols-[1.4fr_1fr]">
        <section className="border-t border-primary/40 pt-5">
          <SectionTitle right={<Link to="/tierlist" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary">Тир-лист <ArrowRight className="h-4 w-4" /></Link>}>Мета недели · Oracle+</SectionTitle>
          <div className="space-y-1">
            {tiers.slice(0, 8).map((r, i) => (
              <LayoutItem key={r.hero_id}><Link to="/heroes/$heroId" params={{ heroId: String(r.hero_id) }} className="meta-ledger-row group flex items-center gap-3 border-b border-border py-3 transition-colors hover:bg-primary/5">
                <span className="font-display w-7 text-xl italic text-primary/60">{String(i + 1).padStart(2, "0")}</span>
                <HeroIcon heroId={r.hero_id} size={44} className="rounded-none transition-transform group-hover:scale-110" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{heroes.get(r.hero_id)?.name}</p>
                  <p className="text-xs text-muted-foreground">{fmtInt(r.matches)} матчей</p>
                </div>
                <span className="tier-seal inline-grid h-7 w-7 place-items-center text-xs font-bold">{r.tier}</span>
                <div className="text-right"><span className="tabular text-lg text-win">{(r.winrate * 100).toFixed(1)}%</span><p className="font-mono text-[9px] uppercase text-muted-foreground">побед</p></div><ArrowRight className="hidden h-4 w-4 text-primary/50 transition-transform group-hover:translate-x-1 sm:block" />
              </Link></LayoutItem>
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
                <Link key={m.match_id} to="/matches/$matchId" params={{ matchId: String(m.match_id) }} search={{ from: "/" }} className="live-dispatch group block border-l-2 border-telemetry/50 bg-card/50 p-4 transition-colors hover:bg-telemetry/5">
                  <div className="flex items-center justify-between font-mono text-[10px] text-muted-foreground"><span>ДЕЛО № {m.match_id}</span><span className="inline-flex items-center gap-1 text-telemetry"><Activity className="h-3 w-3 animate-pulse" />{m.spectators}</span></div>
                  <div className="mt-3 flex items-center justify-between gap-3">{[0,1].map((t) => <div key={t} className="flex -space-x-1">{m.players.filter((p) => p.team === t).slice(0,6).map((p,i) => <HeroIcon key={i} heroId={p.hero_id} size={26} className={cn("rounded-none", t === 0 ? "border-amber-team/70" : "border-sapphire-team/70")} />)}</div>)}</div>
                  <div className="mt-3 flex justify-between font-mono text-xs"><span className="text-amber-team">{fmtK(m.net_worth_team_0)}</span><span className="text-sapphire-team">{fmtK(m.net_worth_team_1)}</span></div>
                  <div className="mt-2 flex h-0.5 overflow-hidden"><div className="bg-amber-team" style={{ width: `${(m.net_worth_team_0 / tot) * 100}%` }} /><div className="flex-1 bg-sapphire-team" /></div>
                </Link>
              );
            })}
            {!featured.length && <p className="text-sm text-muted-foreground">Загрузка…</p>}
          </div>
        </section>
      </div>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {TOOLS.map((s) => (
          <LayoutItem key={s.to}><Link to={s.to} className="edition-tool group relative flex h-full flex-col border-t-2 border-primary/40 py-6 transition-colors hover:border-primary">
            <div className="flex items-center justify-between"><s.icon className="h-7 w-7 text-primary transition-transform duration-300 group-hover:-rotate-12" /><ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-2 group-hover:text-primary" /></div>
            <p className="mt-5 font-display text-xl font-semibold">{s.label}</p>
            <p className="mt-2 text-sm text-muted-foreground">{s.desc}</p>
          </Link></LayoutItem>
        ))}
      </section>
      <p className="flex items-center gap-2 text-xs text-muted-foreground"><Swords className="h-3.5 w-3.5" /> Статистика героев обновляется каждый час.</p>
    </div>
  );
}
