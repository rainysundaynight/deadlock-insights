import { useState } from "react";
import { motion } from "framer-motion";

import { Chip, HeroIcon, SectionTitle, useHeroMap } from "@/components/dl";
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

const METRICS = [["net_worth", "Души"], ["creep_kills", "Крипы"], ["player_damage", "Урон"]] as const;
type Metric = (typeof METRICS)[number][0];

/** Cell shading: team-tinted background scaled by how big the value is. */
function heat(team: number, v: number, max: number) {
  const a = max > 0 ? Math.min(1, v / max) : 0;
  return { background: `color-mix(in oklab, var(--${team === 0 ? "color-amber" : "color-sapphire"}-team) ${(a * 26).toFixed(1)}%, transparent)` };
}

/** Lead across minutes as a small centered area chart. */
function LeadSpark({ lead }: { lead: number[] }) {
  const W = 720, H = 56, mid = H / 2;
  const max = Math.max(1, ...lead.map((v) => Math.abs(v)));
  const x = (i: number) => (i / Math.max(1, lead.length - 1)) * W;
  const y = (v: number) => mid - (v / max) * (mid - 4);
  const line = lead.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-14 w-full" preserveAspectRatio="none" aria-hidden>
      <line x1="0" y1={mid} x2={W} y2={mid} stroke="var(--border)" strokeWidth="1" />
      {lead.map((v, i) => (
        <rect key={i} x={x(i) - 3} y={Math.min(mid, y(v))} width={6} height={Math.abs(mid - y(v))} fill={`var(--${v >= 0 ? "amber" : "sapphire"}-team)`} opacity={0.55} />
      ))}
      <path d={`${line} L${W},${mid} L0,${mid} Z`} fill="none" stroke="var(--primary)" strokeWidth="1.2" opacity={0.8} />
  );
}

export function LaneMinutes({ players, names }: { players: APlayer[]; names?: Map<number, { personaname: string }> | undefined }) {
  const heroes = useHeroMap();
  const lanes = [...new Set(players.map((p) => p.assigned_lane))].filter((l) => LANE_NAMES[l]).sort();
  const [lane, setLane] = useState(lanes[0] ?? 1);
  const [metric, setMetric] = useState<Metric>("net_worth");
  const lp = players.filter((p) => p.assigned_lane === lane).sort((a, b) => a.team - b.team);
  const sum = (t: number, m: number) => lp.filter((p) => p.team === t).reduce((s, p) => s + ((snapAt(p.stats, m)?.[metric] as number) ?? 0), 0);
  const lead = MINUTES.map((m) => sum(0, m) - sum(1, m));
  const cellMax = Math.max(1, ...lp.flatMap((p) => MINUTES.map((m) => (snapAt(p.stats, m)?.[metric] as number) ?? 0)));
  const leadMax = Math.max(1, ...lead.map((v) => Math.abs(v)));

  return (
    <section className="panel overflow-x-auto p-5">
      <SectionTitle>Линия по минутам</SectionTitle>

      <div className="mb-4 flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-border">
        <div className="flex flex-wrap items-center gap-1">
          <span className="mr-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Линия</span>
          {lanes.map((l) => <Chip key={l} active={lane === l} onClick={() => setLane(l)}>{LANE_NAMES[l]}</Chip>)}
        </div>
        <div className="flex flex-wrap items-center gap-1">
          <span className="mr-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Показатель</span>
          {METRICS.map(([k, l]) => <Chip key={k} active={metric === k} onClick={() => setMetric(k)}>{l}</Chip>)}
        </div>
      </div>

      <table className="w-full min-w-[760px] text-sm">
        <thead className="text-xs text-muted-foreground">
          <tr className="border-b border-border">
            <th className="p-2 text-left font-mono text-[10px] uppercase tracking-widest">Игрок</th>
            {MINUTES.map((m) => <th key={m} className="tabular p-2 text-right font-mono text-[10px] font-normal">{m}'</th>)}
          </tr>
        </thead>
        <tbody>
          {lp.map((p) => (
            <tr key={p.account_id} className="border-b border-border/40">
              <td className="p-2">
                <div className="flex items-center gap-2">
                  <span className={cn("h-6 w-1 rounded-full", p.team === 0 ? "bg-amber-team" : "bg-sapphire-team")} />
                  <HeroIcon heroId={p.hero_id} size={26} />
                  <span className="max-w-32 truncate">{names?.get(p.account_id)?.personaname ?? heroes.get(p.hero_id)?.name}</span>
                </div>
              </td>
              {MINUTES.map((m) => {
                const s = snapAt(p.stats, m);
                const prev = snapAt(p.stats, m - 1);
                const died = !!s && !!prev && s.deaths > prev.deaths;
                const v = s ? ((metric === "creep_kills" ? s.creep_kills : (s[metric] as number)) ?? 0) : 0;
                return (
                  <td key={m} className={cn("tabular p-2 text-right", died && "font-semibold text-loss")} title={died ? "Умер на этой минуте" : undefined} style={s ? heat(p.team, v, cellMax) : undefined}>
                    {s ? (metric === "creep_kills" ? s.creep_kills : fmtK(v)) : "—"}
                  </td>
                );
              })}
            </tr>
          ))}
          <tr className="border-t border-primary/40">
            <td className="p-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Перевес HK</td>
            {lead.map((d, i) => (
              <td key={MINUTES[i]} className="p-2 text-right">
                <div className="mx-auto flex w-10 flex-col items-center gap-1">
                  <span className={cn("tabular font-mono text-[11px] font-semibold", d > 0 ? "text-amber-team" : d < 0 ? "text-sapphire-team" : "text-muted-foreground")}>
                    {d > 0 ? "+" : ""}{metric === "creep_kills" ? d : fmtK(d)}
                  </span>
                  <span aria-hidden className={cn("h-1 w-full rounded-full", d >= 0 ? "bg-amber-team/70" : "bg-sapphire-team/70")} style={{ opacity: 0.35 + 0.65 * (Math.abs(d) / leadMax) }} />
                </div>
              </td>
            ))}
          </tr>
        </tbody>
      </table>

      <div className="mt-4">
        <div className="mb-1 flex items-center justify-between font-mono text-[10px] uppercase tracking-widest">
          <span className="text-amber-team">Hidden King впереди</span>
          <span className="text-sapphire-team">Archmother впереди</span>
        </div>
        <LeadSpark lead={lead} />
      </div>

      <p className="mt-2 text-xs text-muted-foreground">
        Красным — минута, на которой игрок умер. Цвет ячейки показывает силу показателя относительно лучших значений на линии.
      </p>
    </section>
  );
}
