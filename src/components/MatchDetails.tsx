import { Link } from "@tanstack/react-router";
import { motion } from "framer-motion";

import { HeroIcon, useHeroMap } from "@/components/dl";
import { fmtK } from "@/lib/format";
import { cn } from "@/lib/utils";

type K = "gold_lane_creep"|"gold_lane_creep_orbs"|"gold_neutral_creep"|"gold_neutral_creep_orbs"|"gold_player"|"gold_player_orbs"|"gold_boss"|"gold_boss_orb"|"gold_treasure"|"shots_hit"|"shots_missed"|"net_worth"|"hero_bullets_hit"|"hero_bullets_hit_crit"|"player_damage_taken"|"player_healing"|"gold_death_loss"|"gold_denied"|"boss_damage"|"weapon_power"|"tech_power";
type Snap = Partial<Record<K, number>>;
interface P { account_id: number; player_slot: number; team: number; hero_id: number; stats: unknown[] }

const SOURCES = [
  { k: "lane", l: "Линия", c: "oklch(0.78 0.15 75)", f: (s: Snap) => n(s.gold_lane_creep) + n(s.gold_lane_creep_orbs) },
  { k: "neutral", l: "Лагеря", c: "oklch(0.72 0.14 150)", f: (s: Snap) => n(s.gold_neutral_creep) + n(s.gold_neutral_creep_orbs) },
  { k: "player", l: "Герои", c: "oklch(0.65 0.21 25)", f: (s: Snap) => n(s.gold_player) + n(s.gold_player_orbs) },
  { k: "boss", l: "Боссы", c: "oklch(0.65 0.2 300)", f: (s: Snap) => n(s.gold_boss) + n(s.gold_boss_orb) },
  { k: "treasure", l: "Сундуки/урна", c: "oklch(0.75 0.13 210)", f: (s: Snap) => n(s.gold_treasure) },
];
const n = (v: unknown) => (typeof v === "number" ? v : 0);

export function MatchDetails({ players, names, durationS }: { players: P[]; names?: Map<number, { personaname: string }> | undefined; durationS: number }) {
  const heroes = useHeroMap();
  const rows = players.map((p) => {
    const s = (p.stats[p.stats.length - 1] ?? {}) as Snap;
    const src = SOURCES.map((x) => x.f(s));
    const total = src.reduce((a, b) => a + b, 0) || 1;
    const hit = n(s.shots_hit), miss = n(s.shots_missed);
    return {
      p, src, total,
      spm: n(s.net_worth) / Math.max(1, durationS / 60),
      acc: hit + miss ? hit / (hit + miss) : 0,
      crit: n(s.hero_bullets_hit) ? n(s.hero_bullets_hit_crit) / n(s.hero_bullets_hit) : 0,
      taken: n(s.player_damage_taken), heal: n(s.player_healing), lost: n(s.gold_death_loss), denied: n(s.gold_denied),
      boss: n(s.boss_damage), wp: n(s.weapon_power), tp: n(s.tech_power),
    };
  });
  const max = (f: (r: (typeof rows)[number]) => number) => Math.max(1, ...rows.map(f));
  const mx = { spm: max((r) => r.spm), taken: max((r) => r.taken), lost: max((r) => r.lost) };

  const team = (t: number) => rows.filter((r) => r.p.team === t);
  const tsum = (t: number, f: (r: (typeof rows)[number]) => number) => team(t).reduce((x, r) => x + f(r), 0);
  const cards = [
    { l: "Души в минуту", f: (r: (typeof rows)[number]) => r.spm, fmt: (v: number) => v.toFixed(0) },
    { l: "Потеряно при смерти", f: (r: (typeof rows)[number]) => r.lost, fmt: fmtK },
    { l: "Получено урона", f: (r: (typeof rows)[number]) => r.taken, fmt: fmtK },
    { l: "Урон боссам", f: (r: (typeof rows)[number]) => r.boss, fmt: fmtK },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-px overflow-hidden border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => {
          const a = tsum(0, c.f), b = tsum(1, c.f), tot = a + b || 1;
          return (
            <div key={c.l} className="bg-card p-4">
              <p className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">{c.l}</p>
              <div className="mt-2 flex items-baseline justify-between font-display text-2xl font-black">
                <span className="tabular text-amber-team">{c.fmt(a)}</span><span className="tabular text-sapphire-team">{c.fmt(b)}</span>
              </div>
              <div className="mt-2 flex h-1 gap-px bg-secondary"><div className="bg-amber-team" style={{ width: `${(a / tot) * 100}%` }} /><div className="ml-auto bg-sapphire-team" style={{ width: `${(b / tot) * 100}%` }} /></div>
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-4 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
        <span className="text-primary">◆ Источники душ</span>
        {SOURCES.map((s) => <span key={s.k} className="flex items-center gap-1.5"><i className="h-2.5 w-2.5" style={{ background: s.c }} />{s.l}</span>)}
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        {[0, 1].map((t) => {
          const tSrc = SOURCES.map((_, i) => tsum(t, (r) => r.src[i] ?? 0));
          const tTot = tSrc.reduce((x, y) => x + y, 0) || 1;
          return (
            <section key={t} className="panel relative overflow-hidden">
              <span aria-hidden className={cn("absolute inset-y-0 left-0 w-1", t === 0 ? "bg-amber-team" : "bg-sapphire-team")} />
              <div className="border-b border-border px-5 py-4">
                <div className="flex items-baseline justify-between">
                  <h3 className={cn("font-display text-xl font-black uppercase", t === 0 ? "text-amber-team" : "text-sapphire-team")}>{t === 0 ? "Hidden King" : "Archmother"}</h3>
                  <span className="tabular font-mono text-xs text-muted-foreground">{fmtK(tTot)} душ из источников</span>
                </div>
                <div className="mt-3 flex h-2.5 overflow-hidden bg-muted">
                  {tSrc.map((v, i) => <motion.div key={i} initial={{ width: 0 }} animate={{ width: `${(v / tTot) * 100}%` }} transition={{ duration: 0.7, delay: i * 0.05 }} title={`${SOURCES[i]?.l}: ${fmtK(v)}`} style={{ background: SOURCES[i]?.c }} />)}
                </div>
              </div>
              <div className="divide-y divide-border/60">
                {team(t).sort((a, b) => b.spm - a.spm).map((r) => (
                  <div key={r.p.player_slot} className="grid grid-cols-[auto_1fr] items-center gap-4 px-5 py-3 transition-colors hover:bg-accent/30 sm:grid-cols-[180px_1fr_auto]">
                    <Link to="/players/$accountId" params={{ accountId: String(r.p.account_id) }} className="flex min-w-0 items-center gap-2 hover:text-primary">
                      <HeroIcon heroId={r.p.hero_id} size={34} />
                      <span className="min-w-0"><span className="block truncate text-sm font-medium">{names?.get(r.p.account_id)?.personaname ?? heroes.get(r.p.hero_id)?.name}</span><span className="tabular font-mono text-[10px] text-muted-foreground">{r.spm.toFixed(0)} душ/мин</span></span>
                    </Link>
                    <div className="col-span-2 sm:col-span-1">
                      <div className="flex h-2 overflow-hidden bg-muted" title={SOURCES.map((s, i) => `${s.l}: ${fmtK(r.src[i] ?? 0)}`).join(" · ")}>
                        {r.src.map((v, i) => <div key={i} style={{ width: `${(v / r.total) * 100}%`, background: SOURCES[i]?.c }} />)}
                      </div>
                      <div className="mt-1.5 flex flex-wrap gap-x-3 font-mono text-[10px] text-muted-foreground">
                        <span>точн. {(r.acc * 100).toFixed(0)}%</span><span>крит {(r.crit * 100).toFixed(0)}%</span><span>получено {fmtK(r.taken)}</span><span className="text-loss">−{fmtK(r.lost)} при смерти</span>
                      </div>
                    </div>
                    <div className="hidden text-right sm:block">
                      <Bar v={r.spm} max={mx.spm} label="" cls={t === 0 ? "bg-amber-team" : "bg-sapphire-team"} />
                    </div>
                  </div>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function Bar({ v, max, label, cls }: { v: number; max: number; label: string; cls: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted"><div className={cn("h-full rounded-full", cls)} style={{ width: `${(v / max) * 100}%` }} /></div>
      <span className="tabular text-xs">{label}</span>
    </div>
  );
}
