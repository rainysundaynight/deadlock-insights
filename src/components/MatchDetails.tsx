import { Link } from "@tanstack/react-router";

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

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
        {SOURCES.map((s) => <span key={s.k} className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm" style={{ background: s.c }} />{s.l}</span>)}
      </div>
      {[0, 1].map((team) => (
        <section key={team} className="panel overflow-x-auto p-0">
          <div className={cn("border-b border-border px-4 py-2 text-xs font-semibold uppercase tracking-wider", team === 0 ? "text-amber-team" : "text-sapphire-team")}>{team === 0 ? "Амбер" : "Сапфир"}</div>
          <table className="w-full min-w-[900px] text-sm">
            <thead className="text-[11px] uppercase tracking-wider text-muted-foreground">
              <tr className="[&>th]:px-3 [&>th]:py-2 [&>th]:text-left">
                <th>Игрок</th><th>Души/мин</th><th className="w-[28%]">Источники душ</th><th>Точность</th><th>Крит</th><th>Получено урона</th><th>Потеряно при смерти</th><th>Урон боссам</th>
              </tr>
            </thead>
            <tbody>
              {rows.filter((r) => r.p.team === team).sort((a, b) => b.spm - a.spm).map((r) => (
                <tr key={r.p.player_slot} className="border-t border-border/50 [&>td]:px-3 [&>td]:py-2">
                  <td>
                    <Link to="/players/$accountId" params={{ accountId: String(r.p.account_id) }} className="flex items-center gap-2 hover:text-primary">
                      <HeroIcon heroId={r.p.hero_id} size={28} />
                      <span className="max-w-36 truncate">{names?.get(r.p.account_id)?.personaname ?? heroes.get(r.p.hero_id)?.name}</span>
                    </Link>
                  </td>
                  <td><Bar v={r.spm} max={mx.spm} label={r.spm.toFixed(0)} cls="bg-primary" /></td>
                  <td>
                    <div className="flex h-3 overflow-hidden rounded-full bg-muted" title={SOURCES.map((s, i) => `${s.l}: ${fmtK(r.src[i] ?? 0)}`).join(" · ")}>
                      {r.src.map((v, i) => <div key={i} style={{ width: `${(v / r.total) * 100}%`, background: SOURCES[i]?.c }} />)}
                    </div>
                    <p className="tabular mt-1 text-[11px] text-muted-foreground">линия {Math.round(((r.src[0] ?? 0) / r.total) * 100)}% · лагеря {Math.round(((r.src[1] ?? 0) / r.total) * 100)}% · герои {Math.round(((r.src[2] ?? 0) / r.total) * 100)}%</p>
                  </td>
                  <td className="tabular">{(r.acc * 100).toFixed(0)}%</td>
                  <td className="tabular">{(r.crit * 100).toFixed(0)}%</td>
                  <td><Bar v={r.taken} max={mx.taken} label={fmtK(r.taken)} cls="bg-secondary-foreground/60" /></td>
                  <td><Bar v={r.lost} max={mx.lost} label={fmtK(r.lost)} cls="bg-loss" /></td>
                  <td className="tabular">{fmtK(r.boss)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ))}
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
