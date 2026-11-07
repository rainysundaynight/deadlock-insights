import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Crown } from "lucide-react";
import { useMemo } from "react";

import { HeroIcon, RankBadge, useHeroMap } from "@/components/dl";
import { globalAvgQuery } from "@/components/PlayerInsights";
import type { StatSnap } from "@/lib/analysis";
import { fmtDate, fmtDuration, fmtK, GAME_MODES, MATCH_MODES } from "@/lib/format";
import { gradeTone, gradeVsGlobal } from "@/lib/grade";
import { globalAverages } from "@/lib/playerStats";
import { cn } from "@/lib/utils";
import { TeamIdentity } from "@/components/TeamIdentity";

interface P { account_id: number; team: number; hero_id: number; kills: number; deaths: number; assists: number; net_worth: number; last_hits: number; stats: StatSnap[] }
interface Props {
  m: { match_id: number; duration_s: number; start_time: number; winning_team: number; game_mode: number; match_mode: number; average_badge_team0?: number | undefined; average_badge_team1?: number | undefined; objectives?: { destroyed_time_s: number; team_objective_id: number; team: number }[] | undefined; mid_boss?: { team_killed: number; destroyed_time_s: number }[] | undefined };
  players: P[];
  names?: Map<number, { personaname: string }> | undefined;
}

const NAMES = ["Hidden King", "Archmother"];
const TONE = ["text-amber-team", "text-sapphire-team"];
const BG = ["bg-amber-team", "bg-sapphire-team"];

export function MatchHero({ m, players, names }: Props) {
  const heroes = useHeroMap();
  const gq = useQuery(globalAvgQuery);
  const ga = gq.data ? globalAverages(gq.data) : null;
  const team = (t: number) => players.filter((p) => p.team === t).sort((a, b) => b.net_worth - a.net_worth);
  const sum = (t: number, f: (p: P) => number) => team(t).reduce((s, p) => s + f(p), 0);

  const graded = useMemo(() => players.map((p) => ({ p, g: ga ? gradeVsGlobal({ k: p.kills, d: p.deaths, a: p.assists, nw: p.net_worth, lh: p.last_hits, won: p.team === m.winning_team }, ga, m.duration_s) : null })), [players, ga, m]);
  const mvp = [...graded].sort((a, b) => (b.g?.score ?? 0) - (a.g?.score ?? 0))[0];
  const bg = mvp ? heroes.get(mvp.p.hero_id)?.images.background_image_webp ?? heroes.get(mvp.p.hero_id)?.images.icon_hero_card_webp : undefined;

  // soul lead curve (Hidden King − Archmother)
  const lead = useMemo(() => {
    const n = Math.min(...players.map((p) => p.stats.length));
    if (!isFinite(n) || n < 2) return [];
    return Array.from({ length: n }, (_, i) => {
      let d = 0; let t = 0;
      players.forEach((p) => { const s = p.stats[i]!; t = s.time_stamp_s; d += p.team === 0 ? s.net_worth : -s.net_worth; });
      return { t, d };
    });
  }, [players]);
  const maxLead = Math.max(1, ...lead.map((x) => Math.abs(x.d)));

  const events = [
    ...(m.objectives ?? []).filter((o) => o.destroyed_time_s > 0).map((o) => ({ t: o.destroyed_time_s, by: 1 - o.team, kind: "tower" as const })),
    ...(m.mid_boss ?? []).map((b) => ({ t: b.destroyed_time_s, by: b.team_killed, kind: "boss" as const })),
  ].sort((a, b) => a.t - b.t);

  const rows: { label: string; f: (p: P) => number; fmt: (n: number) => string }[] = [
    { label: "Убийства", f: (p) => p.kills, fmt: String },
    { label: "Души", f: (p) => p.net_worth, fmt: fmtK },
    { label: "Урон по героям", f: (p) => p.stats.at(-1)?.player_damage ?? 0, fmt: fmtK },
    { label: "Лечение", f: (p) => p.stats.at(-1)?.player_healing ?? 0, fmt: fmtK },
    { label: "Крипы", f: (p) => p.last_hits, fmt: String },
  ];
  const W = 600, H = 70;
  const path = lead.map((x, i) => `${i ? "L" : "M"}${(x.t / m.duration_s) * W},${H / 2 - (x.d / maxLead) * (H / 2 - 4)}`).join(" ");

  return (
    <section className="match-hero relative overflow-hidden border-y border-primary/40">
      {bg && <motion.div aria-hidden initial={{ opacity: 0, scale: 1.08 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 1.2 }} className="dossier-backdrop absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${bg})` }} />}
      <div className="relative z-[1] space-y-6 px-1 py-6 md:px-4">
        <div className="flex flex-wrap items-center justify-between gap-3 font-mono text-[10px] uppercase tracking-widest">
          <span className="text-primary">Итоги матча / Дело № {m.match_id}</span>
          <span className="flex flex-wrap gap-2 text-muted-foreground">
            <span>{fmtDate(m.start_time)}</span>
            <span>· {fmtDuration(m.duration_s)}</span>
            <span className="game-status-plate text-primary">{GAME_MODES[m.game_mode] ?? m.game_mode} · {MATCH_MODES[m.match_mode] ?? m.match_mode}</span>
          </span>
        </div>

        <div className="match-team-grid grid items-center gap-4 md:grid-cols-[1fr_auto_1fr]">
          {[0, 1].map((t) => (
            <motion.div key={t} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.25 }} className={cn("team-banner min-w-0", t === 1 && "team-banner-mother md:order-3 md:text-right")}>
              <h2><TeamIdentity team={t} /></h2>
              <div className={cn("mt-3 flex flex-wrap items-center gap-2 font-mono text-[10px] uppercase", t === 1 && "md:justify-end")}>
                <span className={cn("game-status-plate", m.winning_team === t ? "text-win" : "text-loss")}>{m.winning_team === t ? "Победа" : "Поражение"}</span>
                <span className="text-muted-foreground">· {fmtK(sum(t, (p) => p.net_worth))} душ</span>
                {(t === 0 ? m.average_badge_team0 : m.average_badge_team1) ? <RankBadge badge={t === 0 ? m.average_badge_team0 : m.average_badge_team1} size={18} /> : null}
              </div>
              <div className={cn("team-lineup mt-4 flex flex-wrap gap-1.5", t === 1 && "md:justify-end")}>
                {team(t).map((p) => {
                  const g = graded.find((x) => x.p === p)?.g;
                  const isMvp = mvp?.p === p;
                  return (
                    <Link key={p.account_id} to="/players/$accountId" params={{ accountId: String(p.account_id) }} title={`${names?.get(p.account_id)?.personaname ?? p.account_id} · ${heroes.get(p.hero_id)?.name ?? ""}`} className="group relative">
                      <HeroIcon heroId={p.hero_id} size={44} className={cn("transition-transform group-hover:-translate-y-0.5", isMvp && "ring-2 ring-primary")} />
                      {isMvp && <Crown className="absolute -top-2 left-1/2 h-3.5 w-3.5 -translate-x-1/2 fill-primary text-primary" />}
                      {g && <span className={cn("absolute -bottom-1 -right-1 bg-background px-0.5 font-display text-[10px] font-black", gradeTone(g.grade))}>{g.grade}</span>}
                    </Link>
                  );
                })}
              </div>
            </motion.div>
          ))}
          <div className="match-team-score text-center md:order-2">
            <div className="flex items-baseline justify-center gap-4 font-display font-black">
              <motion.span initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={cn("text-6xl sm:text-7xl", TONE[0])}>{sum(0, (p) => p.kills)}</motion.span>
              <span className="text-sm text-muted-foreground">VS</span>
              <motion.span initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={cn("text-6xl sm:text-7xl", TONE[1])}>{sum(1, (p) => p.kills)}</motion.span>
            </div>
            <p className={cn("game-status-plate mt-2", m.winning_team === 0 ? "text-amber-team" : "text-sapphire-team")}>Победа {NAMES[m.winning_team]}</p>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
          <div className="panel bg-card/80 p-4 backdrop-blur-sm">
            <div className="mb-2 flex justify-between font-mono text-[10px] uppercase tracking-widest text-muted-foreground"><span>◆ Перевес по душам и ключевые события</span><span>{fmtDuration(m.duration_s)}</span></div>
            {lead.length > 1 && (
              <svg viewBox={`0 0 ${W} ${H}`} className="h-20 w-full" preserveAspectRatio="none">
                <line x1="0" x2={W} y1={H / 2} y2={H / 2} className="stroke-border" strokeDasharray="3 3" />
                <motion.path d={path} fill="none" strokeWidth="2" className="stroke-primary" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.2 }} vectorEffect="non-scaling-stroke" />
              </svg>
            )}
            <div className="relative mt-1 h-6 border-t border-border">
              {events.map((e, i) => (
                <span key={i} title={`${fmtDuration(e.t)} · ${e.kind === "boss" ? "Мид-босс" : "Строение"} · ${NAMES[e.by]}`} className={cn("absolute top-1 -translate-x-1/2", e.kind === "boss" ? "h-3 w-3 rotate-45" : "h-2.5 w-1", BG[e.by] ?? "bg-muted")} style={{ left: `${(e.t / m.duration_s) * 100}%` }} />
              ))}
            </div>
            <div className="flex flex-wrap gap-3 font-mono text-[9px] uppercase text-muted-foreground"><span>▮ строение</span><span>◆ мид-босс</span><span className="ml-auto">вверх — Hidden King, вниз — Archmother</span></div>
          </div>
          <div className="panel bg-card/80 p-4 backdrop-blur-sm">
            <p className="mb-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">◆ Команды в цифрах</p>
            <div className="space-y-2.5">
              {rows.map((r, i) => {
                const a = sum(0, r.f), b = sum(1, r.f), tot = a + b || 1;
                return (
                  <div key={r.label}>
                    <div className="mb-1 flex justify-between text-xs"><span className={cn("tabular font-mono", TONE[0], a > b && "font-bold")}>{r.fmt(a)}</span><span className="text-muted-foreground">{r.label}</span><span className={cn("tabular font-mono", TONE[1], b > a && "font-bold")}>{r.fmt(b)}</span></div>
                    <div className="flex h-1.5 gap-px bg-secondary">
                      <motion.div initial={{ width: 0 }} animate={{ width: `${(a / tot) * 100}%` }} transition={{ delay: i * 0.06, duration: 0.6 }} className={BG[0]} />
                      <motion.div initial={{ width: 0 }} animate={{ width: `${(b / tot) * 100}%` }} transition={{ delay: i * 0.06, duration: 0.6 }} className={cn("ml-auto", BG[1])} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
