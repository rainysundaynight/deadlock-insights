import { useQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { ChevronDown, Eye, Radio, RefreshCw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { LayoutItem } from "@/components/GazetteMotion";
import { Chip, ErrorBox, HeroIcon, Loading, PageHeader } from "@/components/dl";
import { api } from "@/lib/api";
import { fmtAgo, fmtK } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/live")({
  head: () => ({
    meta: [
      { title: "Live матчи Deadlock — игры прямо сейчас" },
      { name: "description", content: "Матчи Deadlock, которые идут прямо сейчас: составы, души команд, зрители." },
      { property: "og:title", content: "Live матчи Deadlock" },
      { property: "og:description", content: "Матчи Deadlock в реальном времени." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LivePage,
});

interface ActiveMatch {
  match_id: number;
  start_time: number;
  spectators: number;
  net_worth_team_0: number;
  net_worth_team_1: number;
  match_mode_parsed: string;
  game_mode_parsed: string;
  region_mode_parsed: string;
  match_score: number;
  players: { account_id: number; team: number; hero_id: number }[];
}

const REGION_RU: Record<string, string> = { europe: "Европа", row: "Америка", south_america: "Юж. Америка", russia: "Россия", oceania: "Океания", asia: "Азия" };

type Kind = "all" | "ranked" | "brawl" | "unranked";
const KINDS: [Kind, string][] = [["all", "Все типы"], ["ranked", "Рейтинговые"], ["unranked", "Обычные"], ["brawl", "Street Brawl"]];
const kindOf = (m: { match_mode_parsed: string; game_mode_parsed: string }): Exclude<Kind, "all"> =>
  m.game_mode_parsed.includes("StreetBrawl") ? "brawl" : m.match_mode_parsed === "Ranked" ? "ranked" : "unranked";

function LivePage() {
  const [open, setOpen] = useState<number | null>(null);
  const [history, setHistory] = useState<Record<number, number[]>>({});
  const reduce = useReducedMotion();
  const [region, setRegion] = useState<string | null>(null);
  const [kind, setKind] = useState<Kind>("all");
  const q = useQuery({ queryKey: ["active"], queryFn: () => api<ActiveMatch[]>("/v1/matches/active"), refetchInterval: 60_000 });
  useEffect(() => {
    if (!q.data) return;
    setHistory((prev) => Object.fromEntries((q.data ?? []).map((m) => [m.match_id, [...(prev[m.match_id] ?? []), m.net_worth_team_0 - m.net_worth_team_1].slice(-30)])));
  }, [q.dataUpdatedAt]);
  const regions = useMemo(() => [...new Set((q.data ?? []).map((m) => m.region_mode_parsed))], [q.data]);
  const list = useMemo(
    () => (q.data ?? []).filter((m) => (!region || m.region_mode_parsed === region) && (kind === "all" || kindOf(m) === kind)).sort((a, b) => b.match_score - a.match_score).slice(0, 60),
    [q.data, region, kind],
  );

  return (
    <div>
      <PageHeader eyebrow="Прямо сейчас" title={<span className="inline-flex items-center gap-3"><span className="h-3 w-3 animate-pulse rounded-full bg-telemetry" /> Live матчи</span>}>
        Топ матчей по рейтингу, которые идут прямо сейчас. Обновляется каждую минуту.
      </PageHeader>
      <div className="mb-3 flex flex-wrap items-center gap-2 border-b border-border">
        {KINDS.map(([k, l]) => <Chip key={k} active={kind === k} onClick={() => setKind(k)}>{l} {k !== "all" && <span className="text-muted-foreground">{(q.data ?? []).filter((m) => kindOf(m) === k).length}</span>}</Chip>)}
      </div>
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <Chip active={!region} onClick={() => setRegion(null)}>Все регионы</Chip>
        {regions.map((r) => <Chip key={r} active={region === r} onClick={() => setRegion(r)}>{REGION_RU[r] ?? r}</Chip>)}
        <Button variant="ghost" onClick={() => q.refetch()} className="ml-auto inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary">
          <RefreshCw className={cn("h-4 w-4", q.isFetching && "animate-spin")} /> Обновить
        </Button>
      </div>
      {q.isLoading ? <Loading /> : q.error ? <ErrorBox error={q.error} /> : (
        <div className="grid gap-3 lg:grid-cols-2">
          {list.map((m) => {
            const total = m.net_worth_team_0 + m.net_worth_team_1 || 1;
            return (
              <LayoutItem key={m.match_id}>
                <article className="live-match-sheet group overflow-hidden border border-border bg-card/60 transition-colors hover:border-telemetry/50">
                  <div className="h-0.5 bg-telemetry/60" />
                  <div className="p-5">
                  <div className="mb-4 flex items-start justify-between gap-3 border-b border-border pb-3">
                    <div><p className="font-mono text-xs text-primary">ДЕЛО № {m.match_id}</p><p className="mt-1 text-[10px] text-muted-foreground">{KINDS.find(([k]) => k === kindOf(m))?.[1]} · {REGION_RU[m.region_mode_parsed] ?? m.region_mode_parsed} · {fmtAgo(m.start_time)}</p></div>
                    <span className="inline-flex shrink-0 items-center gap-2 text-[10px] text-telemetry"><Radio className="h-3 w-3 animate-pulse" /> LIVE <Eye className="h-3 w-3" />{m.spectators}</span>
                  </div>
                  <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                    <div><p className="font-mono text-[10px] text-amber-team">THE AMBER HAND</p><p className="mt-2 font-mono text-2xl text-amber-team">{fmtK(m.net_worth_team_0)}</p></div>
                    <span className="font-display text-xl italic text-muted-foreground/40">vs</span>
                    <div className="text-right"><p className="font-mono text-[10px] text-sapphire-team">THE SAPPHIRE FLAME</p><p className="mt-2 font-mono text-2xl text-sapphire-team">{fmtK(m.net_worth_team_1)}</p></div>
                  </div>
                  <div className="mt-3 flex h-1 overflow-hidden rounded-sm"><div className="bg-amber-team" style={{ width: `${(m.net_worth_team_0 / total) * 100}%` }} /><div className="flex-1 bg-sapphire-team" /></div>
                  {(history[m.match_id]?.length ?? 0) > 1 && <AdvantageSparkline values={history[m.match_id] ?? []} />}
                  <div className="mt-2 flex items-center justify-between border-t border-border pt-3">
                    <Button variant="ghost" className="h-8 px-0 text-xs text-muted-foreground" aria-expanded={open === m.match_id} onClick={() => setOpen(open === m.match_id ? null : m.match_id)}>Боевой отчёт <ChevronDown className={cn("transition-transform", open === m.match_id && "rotate-180")} /></Button>
                    <Button asChild variant="outline" size="sm"><Link to="/matches/$matchId" params={{ matchId: String(m.match_id) }} search={{ from: "/live" }}>В эфир →</Link></Button>
                  </div>
                  <AnimatePresence>{open === m.match_id && <motion.div initial={reduce ? false : { height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden"><div className="space-y-3 border-t border-border pt-4">{[0, 1].map((t) => <div key={t}><p className={cn("mb-2 font-mono text-[10px]", t === 0 ? "text-amber-team" : "text-sapphire-team")}>{t === 0 ? "AMBER" : "SAPPHIRE"}</p><div className="flex flex-wrap gap-2">{m.players.filter((p) => p.team === t).map((p) => <Link key={p.account_id} to="/players/$accountId" params={{ accountId: String(p.account_id) }} className="rounded-sm hover:ring-1 hover:ring-primary" title={`Игрок ${p.account_id}`}><HeroIcon heroId={p.hero_id} size={36} /></Link>)}</div></div>)}</div></motion.div>}</AnimatePresence>
                  </div>
                </article>
              </LayoutItem>
            );
          })}
        </div>
      )}
    </div>
  );
}

function AdvantageSparkline({ values }: { values: number[] }) {
  const reduce = useReducedMotion();
  const max = Math.max(1000, ...values.map(Math.abs));
  const points = values.map((v, i) => `${8 + (i / Math.max(1, values.length - 1)) * 284},${28 - (v / max) * 22}`).join(" ");
  return <div className="mt-3"><div className="flex justify-between text-[9px] text-muted-foreground"><span>ПЕРЕВЕС ПО ДУШАМ</span><span>{values.length > 1 ? `${values.length} замеров · 1 мин` : "История с открытия страницы"}</span></div><svg viewBox="0 0 300 56" className="h-14 w-full" role="img" aria-label="Динамика перевеса по душам"><path d="M8 28 H292" stroke="var(--border)" strokeDasharray="3 5" />{values.length > 1 ? <motion.polyline points={points} fill="none" stroke="var(--telemetry)" strokeWidth="2" initial={reduce ? false : { pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.5 }} /> : <circle cx="8" cy={28 - ((values[0] ?? 0) / max) * 22} r="3" fill="var(--telemetry)" />}</svg></div>;
}
