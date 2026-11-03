import { useState } from "react";

import { HeroIcon, SectionTitle, useHeroMap } from "@/components/dl";
import { LANE_NAMES, type APlayer, type StatSnap } from "@/lib/analysis";
import { fmtK } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Snapshot at or just before minute `m`. */
export function snapAt(stats: StatSnap[], m: number): StatSnap | undefined {
  let best: StatSnap | undefined;
  for (const s of stats) if (s.time_stamp_s <= m * 60) best = s;
  return best;
}

const MINUTES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

export function LaneMinutes({ players, names }: { players: APlayer[]; names?: Map<number, { personaname: string }> | undefined }) {
  const heroes = useHeroMap();
  const lanes = [...new Set(players.map((p) => p.assigned_lane))].filter((l) => LANE_NAMES[l]).sort();
  const [lane, setLane] = useState(lanes[0] ?? 1);
  const [metric, setMetric] = useState<"net_worth" | "creep_kills" | "player_damage">("net_worth");
  const lp = players.filter((p) => p.assigned_lane === lane).sort((a, b) => a.team - b.team);
  const sum = (t: number, m: number) => lp.filter((p) => p.team === t).reduce((s, p) => s + ((snapAt(p.stats, m)?.[metric] as number) ?? 0), 0);

  return (
    <section className="panel overflow-x-auto p-5">
      <SectionTitle right={
        <div className="flex flex-wrap gap-2">
          {lanes.map((l) => <button key={l} onClick={() => setLane(l)} className={cn("rounded-full border px-3 py-1 text-xs", lane === l ? "border-primary/60 bg-primary/15 text-primary" : "border-border text-muted-foreground")}>{LANE_NAMES[l]}</button>)}
          <span className="w-2" />
          {([["net_worth", "Души"], ["creep_kills", "Крипы"], ["player_damage", "Урон"]] as const).map(([k, l]) => <button key={k} onClick={() => setMetric(k)} className={cn("rounded-full border px-3 py-1 text-xs", metric === k ? "border-primary/60 bg-primary/15 text-primary" : "border-border text-muted-foreground")}>{l}</button>)}
        </div>
      }>Линия по минутам</SectionTitle>
      <table className="w-full min-w-[720px] text-sm">
        <thead className="text-xs text-muted-foreground">
          <tr className="border-b border-border"><th className="p-2 text-left">Игрок</th>{MINUTES.map((m) => <th key={m} className="tabular p-2 text-right">{m}'</th>)}</tr>
        </thead>
        <tbody>
          {lp.map((p) => (
            <tr key={p.account_id} className="border-b border-border/50">
              <td className="p-2"><div className="flex items-center gap-2"><span className={cn("h-5 w-1 rounded-full", p.team === 0 ? "bg-amber-team" : "bg-sapphire-team")} /><HeroIcon heroId={p.hero_id} size={26} /><span className="max-w-32 truncate">{names?.get(p.account_id)?.personaname ?? heroes.get(p.hero_id)?.name}</span></div></td>
              {MINUTES.map((m) => {
                const s = snapAt(p.stats, m);
                const prev = snapAt(p.stats, m - 1);
                const died = s && prev && s.deaths > prev.deaths;
                return <td key={m} className={cn("tabular p-2 text-right", died && "text-loss")} title={died ? "Умер на этой минуте" : undefined}>{s ? (metric === "creep_kills" ? s.creep_kills : fmtK(s[metric])) : "—"}</td>;
              })}
            </tr>
          ))}
          <tr>
            <td className="p-2 text-xs uppercase tracking-wider text-muted-foreground">Перевес</td>
            {MINUTES.map((m) => {
              const d = sum(0, m) - sum(1, m);
              return <td key={m} className={cn("tabular p-2 text-right font-semibold", d > 0 ? "text-amber-team" : d < 0 ? "text-sapphire-team" : "text-muted-foreground")}>{d > 0 ? "+" : ""}{metric === "creep_kills" ? d : fmtK(d)}</td>;
            })}
          </tr>
        </tbody>
      </table>
      <p className="mt-3 text-xs text-muted-foreground">Красным — минута, на которой игрок умер. Перевес считается по команде Амбер.</p>
    </section>
  );
}
