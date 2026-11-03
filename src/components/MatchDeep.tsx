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
