import { useState } from "react";

import { HeroIcon, SectionTitle, useHeroMap, useItemMap } from "@/components/dl";
import type { StatSnap } from "@/lib/analysis";
import { fmtDuration, fmtK } from "@/lib/format";
import { cn } from "@/lib/utils";

export interface DeepPlayer {
  account_id: number; team: number; hero_id: number;
  items: { game_time_s: number; item_id: number; sold_time_s: number }[];
  stats: StatSnap[];
}

const METRICS = [
  { key: "player_damage", label: "Урон по героям" },
  { key: "player_damage_taken", label: "Получено урона" },
  { key: "player_healing", label: "Лечение" },
  { key: "net_worth", label: "Души" },
] as const;

export function DamageView({ players, names }: { players: DeepPlayer[]; names?: Map<number, { personaname: string }> | undefined }) {
  const heroes = useHeroMap();
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {METRICS.map((m) => {
        const rows = players.map((p) => ({ p, v: (p.stats.at(-1)?.[m.key] as number | undefined) ?? 0 })).sort((a, b) => b.v - a.v);
        const max = rows[0]?.v || 1;
        return (
          <section key={m.key} className="panel p-5">
            <SectionTitle>{m.label}</SectionTitle>
            <div className="space-y-2">
              {rows.map(({ p, v }) => (
                <div key={p.account_id} className="flex items-center gap-3">
                  <HeroIcon heroId={p.hero_id} size={28} />
                  <div className="min-w-0 flex-1">
                    <div className="flex justify-between text-xs"><span className="truncate">{names?.get(p.account_id)?.personaname ?? heroes.get(p.hero_id)?.name}</span><span className="tabular">{fmtK(v)}</span></div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted"><div className={cn("h-full", p.team === 0 ? "bg-amber-team" : "bg-sapphire-team")} style={{ width: `${(v / max) * 100}%` }} /></div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        );
      })}
      <AccuracyView players={players} names={names} />
      <DuelMatrix players={players} names={names} />
      <PowerSpikes players={players} names={names} />
    </div>
  );
}

function AccuracyView({ players, names }: { players: DeepPlayer[]; names?: Map<number, { personaname: string }> | undefined }) {
  const heroes = useHeroMap();
  const rows = players.map((p) => {
    const l = p.stats.at(-1);
    const shots = (l?.shots_hit ?? 0) + (l?.shots_missed ?? 0);
    return { p, acc: shots ? (l!.shots_hit / shots) * 100 : 0 };
  }).sort((a, b) => b.acc - a.acc);
  return (
    <section className="panel p-5 lg:col-span-2">
      <SectionTitle>Точность стрельбы</SectionTitle>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map(({ p, acc }) => (
          <div key={p.account_id} className="flex items-center gap-3 rounded-lg bg-secondary/60 p-2">
            <HeroIcon heroId={p.hero_id} size={28} />
            <span className="flex-1 truncate text-sm">{names?.get(p.account_id)?.personaname ?? heroes.get(p.hero_id)?.name}</span>
            <span className={cn("tabular text-sm font-semibold", p.team === 0 ? "text-amber-team" : "text-sapphire-team")}>{acc.toFixed(1)}%</span>
          </div>
        ))}
      </div>
    </section>
  );
}

export function ItemsTimeline({ players, names }: { players: DeepPlayer[]; names?: Map<number, { personaname: string }> | undefined }) {
  const items = useItemMap();
  const heroes = useHeroMap();
  const [sel, setSel] = useState(players[0]?.account_id);
  const p = players.find((x) => x.account_id === sel) ?? players[0];
  if (!p) return null;
  const bought = p.items.filter((i) => items.has(i.item_id)).sort((a, b) => a.game_time_s - b.game_time_s);
  return (
    <div className="grid gap-4 lg:grid-cols-[240px_1fr]">
      <div className="panel space-y-1 p-2">
        {players.map((x) => (
          <button key={x.account_id} onClick={() => setSel(x.account_id)} className={cn("flex w-full items-center gap-2 rounded-lg p-2 text-left text-sm", x.account_id === p.account_id ? "bg-primary/15 text-primary" : "hover:bg-accent")}>
            <span className={cn("h-6 w-1 rounded-full", x.team === 0 ? "bg-amber-team" : "bg-sapphire-team")} />
            <HeroIcon heroId={x.hero_id} size={26} />
            <span className="truncate">{names?.get(x.account_id)?.personaname ?? heroes.get(x.hero_id)?.name}</span>
          </button>
        ))}
      </div>
      <section className="panel p-5">
        <SectionTitle>Порядок покупки предметов</SectionTitle>
        <ol className="relative space-y-3 border-l border-border pl-6">
          {bought.map((i, idx) => {
            const it = items.get(i.item_id)!;
            return (
              <li key={`${i.item_id}-${idx}`} className="relative flex items-center gap-3">
                <span className="absolute -left-[29px] h-2.5 w-2.5 rounded-full border-2 border-background bg-primary" />
                <span className="tabular w-12 text-xs text-muted-foreground">{fmtDuration(i.game_time_s)}</span>
                <img src={it.shop_image_webp ?? it.image_webp ?? it.image} alt="" className={cn("h-8 w-8 rounded-md border p-0.5", it.item_slot_type === "weapon" && "border-amber-team/60 bg-amber-team/10", it.item_slot_type === "vitality" && "border-win/60 bg-win/10", it.item_slot_type === "spirit" && "border-chart-5/60 bg-chart-5/10")} />
                <span className={cn("text-sm", i.sold_time_s > 0 && "text-muted-foreground line-through")}>{it.name}</span>
                {i.sold_time_s > 0 && <span className="text-xs text-muted-foreground">продан {fmtDuration(i.sold_time_s)}</span>}
                {it.cost != null && <span className="tabular ml-auto text-xs text-primary">{fmtK(it.cost)}</span>}
              </li>
            );
          })}
        </ol>
      </section>
    </div>
  );
}

type DuelPlayer = DeepPlayer & { player_slot?: number; death_details?: { game_time_s: number; killer_player_slot: number }[] };

/** Who-killed-whom matrix: rows = killers (Amber), cols = victims (Sapphire) and vice versa. */
export function DuelMatrix({ players, names }: { players: DuelPlayer[]; names?: Map<number, { personaname: string }> | undefined }) {
  const heroes = useHeroMap();
  const bySlot = new Map(players.map((p) => [p.player_slot, p]));
  const kills = new Map<string, number>();
  for (const v of players) for (const d of v.death_details ?? []) {
    const k = bySlot.get(d.killer_player_slot); if (!k || k.team === v.team) continue;
    const key = `${k.player_slot}-${v.player_slot}`; kills.set(key, (kills.get(key) ?? 0) + 1);
  }
  const amber = players.filter((p) => p.team === 0), sapph = players.filter((p) => p.team === 1);
  const max = Math.max(1, ...kills.values());
  const nm = (p: DuelPlayer) => names?.get(p.account_id)?.personaname ?? heroes.get(p.hero_id)?.name ?? "";
  const nemesis = (p: DuelPlayer) => {
    const enemies = p.team === 0 ? sapph : amber;
    const best = enemies.map((e) => ({ e, n: kills.get(`${e.player_slot}-${p.player_slot}`) ?? 0 })).sort((a, b) => b.n - a.n)[0];
    return best && best.n > 0 ? best : null;
  };
  return (
    <section className="panel p-5 lg:col-span-2">
      <SectionTitle>Матрица дуэлей · кто кого убил</SectionTitle>
      <div className="overflow-x-auto">
        <table className="text-xs">
          <thead><tr><th className="p-1 text-left font-normal text-muted-foreground">Hidden King ↓ убил · Archmother →</th>{sapph.map((s) => <th key={s.player_slot} className="p-1"><HeroIcon heroId={s.hero_id} size={28} className="border-sapphire-team" /></th>)}</tr></thead>
          <tbody>{amber.map((a) => (
            <tr key={a.player_slot}>
              <td className="flex items-center gap-2 p-1"><HeroIcon heroId={a.hero_id} size={28} className="border-amber-team" /><span className="max-w-28 truncate">{nm(a)}</span></td>
              {sapph.map((s) => {
                const ab = kills.get(`${a.player_slot}-${s.player_slot}`) ?? 0, ba = kills.get(`${s.player_slot}-${a.player_slot}`) ?? 0;
                return (
                  <td key={s.player_slot} className="p-1">
                    <div className="tabular flex h-9 w-14 items-center justify-center gap-1 rounded-md bg-secondary/60" title={`${nm(a)} убил ${nm(s)}: ${ab} · обратно: ${ba}`}
                      style={{ boxShadow: `inset 0 0 0 999px color-mix(in oklab, var(--${ab >= ba ? "amber-team" : "sapphire-team"}) ${(Math.max(ab, ba) / max) * 45}%, transparent)` }}>
                      <span className="text-amber-team">{ab}</span><span className="text-muted-foreground">:</span><span className="text-sapphire-team">{ba}</span>
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}</tbody>
        </table>
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {players.map((p) => { const n = nemesis(p); return n ? (
          <div key={p.player_slot} className="flex items-center gap-2 rounded-lg bg-secondary/50 p-2 text-xs">
            <HeroIcon heroId={p.hero_id} size={24} /><span className="truncate">{nm(p)}</span>
            <span className="ml-auto text-muted-foreground">главный обидчик</span><HeroIcon heroId={n.e.hero_id} size={24} /><span className="tabular text-loss">×{n.n}</span>
          </div>) : null; })}
      </div>
    </section>
  );
}

/** Minute each player completed their first T3 and T4 item. */
export function PowerSpikes({ players, names }: { players: DeepPlayer[]; names?: Map<number, { personaname: string }> | undefined }) {
  const heroes = useHeroMap();
  const items = useItemMap();
  const rows = players.map((p) => {
    const first = (t: number) => p.items.filter((i) => items.get(i.item_id)?.item_tier === t).sort((a, b) => a.game_time_s - b.game_time_s)[0];
    return { p, t3: first(3), t4: first(4) };
  }).sort((a, b) => (a.t4?.game_time_s ?? 1e9) - (b.t4?.game_time_s ?? 1e9) || (a.t3?.game_time_s ?? 1e9) - (b.t3?.game_time_s ?? 1e9));
  const maxT = Math.max(60, ...rows.flatMap((r) => [r.t3?.game_time_s ?? 0, r.t4?.game_time_s ?? 0]));
  return (
    <section className="panel p-5 lg:col-span-2">
      <SectionTitle right={<span className="text-xs text-muted-foreground">◆ первый T3 · ★ первый T4</span>}>Пики силы</SectionTitle>
      <div className="space-y-2">
        {rows.map(({ p, t3, t4 }) => (
          <div key={p.account_id} className="flex items-center gap-3">
            <HeroIcon heroId={p.hero_id} size={28} className={p.team === 0 ? "border-amber-team" : "border-sapphire-team"} />
            <span className="w-28 truncate text-xs">{names?.get(p.account_id)?.personaname ?? heroes.get(p.hero_id)?.name}</span>
            <div className="relative h-6 flex-1 rounded-full bg-muted/60">
              {[t3, t4].map((it, i) => it ? (
                <div key={i} className="absolute top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center gap-1" style={{ left: `${(it.game_time_s / maxT) * 100}%` }} title={`${items.get(it.item_id)?.name} · ${fmtDuration(it.game_time_s)}`}>
                  <span className={cn("text-sm", i ? "text-primary" : p.team === 0 ? "text-amber-team" : "text-sapphire-team")}>{i ? "★" : "◆"}</span>
                </div>) : null)}
            </div>
            <span className="tabular w-24 text-right text-[11px] text-muted-foreground">{t3 ? fmtDuration(t3.game_time_s) : "—"} / {t4 ? fmtDuration(t4.game_time_s) : "—"}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
