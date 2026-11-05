import { useState } from "react";
import { motion } from "framer-motion";

import { HeroIcon, SectionTitle, useHeroMap, useItemMap } from "@/components/dl";
import type { StatSnap } from "@/lib/analysis";
import { fmtDuration, fmtK } from "@/lib/format";
import { cn } from "@/lib/utils";

export interface DeepPlayer {
  account_id: number; team: number; hero_id: number;
  items: { game_time_s: number; item_id: number; sold_time_s: number }[];
  stats: StatSnap[];
}

type Names = Map<number, { personaname: string }> | undefined;

const TEAM_TONE = ["amber-team", "sapphire-team"] as const;
const TEAM_NAME = ["Hidden King", "Archmother"];

const METRICS = [
  { key: "player_damage", label: "Урон по героям", hint: "по самим героям" },
  { key: "player_damage_taken", label: "Получено урона", hint: "сколько выдержал" },
  { key: "player_healing", label: "Лечение", hint: "вылечено союзникам" },
  { key: "net_worth", label: "Души", hint: "итоговый доход" },
] as const;

type MetricKey = (typeof METRICS)[number]["key"];

/** Minutes of match time covered by the snapshot list. */
function matchMinutes(players: DeepPlayer[]) {
  const s = Math.max(0, ...players.map((p) => p.stats.at(-1)?.time_stamp_s ?? 0));
  return Math.max(1, s / 60);
}

/** One metric: team split on top, ranked ledger rows below. */
function MetricPanel({ metric, players, names, mins }: { metric: (typeof METRICS)[number]; players: DeepPlayer[]; names: Names; mins: number }) {
  const heroes = useHeroMap();
  const val = (p: DeepPlayer) => (p.stats.at(-1)?.[metric.key] as number | undefined) ?? 0;
  const rows = [...players].map((p) => ({ p, v: val(p) })).sort((a, b) => b.v - a.v);
  const max = rows[0]?.v || 1;
  const t0 = players.filter((p) => p.team === 0).reduce((s, p) => s + val(p), 0);
  const t1 = players.filter((p) => p.team === 1).reduce((s, p) => s + val(p), 0);
  const tot = t0 + t1 || 1;
  const best = rows[0]?.p.account_id;

  return (
    <section className="panel relative overflow-hidden p-5">
      <span aria-hidden className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-primary/70 via-primary/20 to-transparent" />
      <SectionTitle right={<span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{metric.hint}</span>}>{metric.label}</SectionTitle>

      <div className="mb-4">
        <div className="flex items-baseline justify-between font-mono text-[10px] uppercase tracking-widest">
          <span className="text-amber-team">{TEAM_NAME[0]}</span>
          <span className="text-sapphire-team">{TEAM_NAME[1]}</span>
        </div>
        <div className="mt-1 flex h-1.5 overflow-hidden rounded-full bg-muted">
          <motion.div className="bg-amber-team" initial={{ width: 0 }} whileInView={{ width: `${(t0 / tot) * 100}%` }} viewport={{ once: true }} transition={{ duration: 0.7, ease: "easeOut" }} />
          <motion.div className="bg-sapphire-team" initial={{ width: 0 }} whileInView={{ width: `${(t1 / tot) * 100}%` }} viewport={{ once: true }} transition={{ duration: 0.7, ease: "easeOut" }} />
        </div>
        <div className="mt-1 flex justify-between tabular text-xs text-muted-foreground">
          <span>{fmtK(t0)} · {(t0 / mins).toFixed(0)}/мин</span>
          <span className={cn(t0 >= t1 ? "text-amber-team" : "text-sapphire-team")}>{t0 >= t1 ? "◆ перевес" : "перевес ◆"}</span>
          <span>{fmtK(t1)} · {(t1 / mins).toFixed(0)}/мин</span>
        </div>
      </div>

      <div className="space-y-1">
        {rows.map(({ p, v }, i) => (
          <div key={p.account_id} className="group grid grid-cols-[18px_32px_1fr_74px] items-center gap-3 border-b border-border/40 py-2 last:border-0">
            <span className={cn("tabular font-mono text-[10px]", i === 0 ? "text-primary" : "text-muted-foreground")}>{i + 1}</span>
            <HeroIcon heroId={p.hero_id} size={28} className={cn(p.team === 0 ? "border-amber-team/50" : "border-sapphire-team/50")} />
            <div className="min-w-0">
              <div className="flex items-baseline justify-between gap-2">
                <span className="truncate text-sm">{names?.get(p.account_id)?.personaname ?? heroes.get(p.hero_id)?.name}</span>
                {p.account_id === best && <span className="border border-primary/50 px-1 font-mono text-[8px] uppercase text-primary">макс</span>}
              </div>
              <div className="mt-1 h-1 overflow-hidden rounded-full bg-muted/70">
                <motion.div
                  className={cn("h-full", p.team === 0 ? "bg-amber-team" : "bg-sapphire-team")}
                  initial={{ width: 0 }} whileInView={{ width: `${(v / max) * 100}%` }} viewport={{ once: true }} transition={{ duration: 0.6, ease: "easeOut", delay: i * 0.04 }}
                />
              </div>
            </div>
            <div className="text-right">
              <p className="tabular font-display text-sm font-bold">{fmtK(v)}</p>
              <p className="tabular font-mono text-[9px] text-muted-foreground">{(v / mins).toFixed(0)}/мин</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export function DamageView({ players, names }: { players: DeepPlayer[]; names?: Names }) {
  const mins = matchMinutes(players);
  return (
    <div className="space-y-5">
      <div className="grid gap-4 lg:grid-cols-2">
        {METRICS.map((m) => <MetricPanel key={m.key} metric={m} players={players} names={names} mins={mins} />)}
      </div>
      <AccuracyView players={players} names={names} />
      <DuelMatrix players={players} names={names} />
      <PowerSpikes players={players} names={names} />
    </div>
  );
}

function AccuracyView({ players, names }: { players: DeepPlayer[]; names: Names }) {
  const heroes = useHeroMap();
  const rows = players.map((p) => {
    const l = p.stats.at(-1);
    const shots = (l?.shots_hit ?? 0) + (l?.shots_missed ?? 0);
    return { p, acc: shots ? (l!.shots_hit / shots) * 100 : 0, shots };
  }).sort((a, b) => b.acc - a.acc);
  const avg = rows.length ? rows.reduce((s, r) => s + r.acc, 0) / rows.length : 0;
  const max = Math.max(1, ...rows.map((r) => r.acc));

  return (
    <section className="panel relative overflow-hidden p-5">
      <span aria-hidden className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-primary/70 via-primary/20 to-transparent" />
      <SectionTitle right={<span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">среднее {avg.toFixed(1)}%</span>}>Точность стрельбы</SectionTitle>
      <div className="grid gap-x-8 gap-y-1 sm:grid-cols-2">
        {rows.map(({ p, acc, shots }, i) => {
          const d = acc - avg;
          return (
            <div key={p.account_id} className="grid grid-cols-[18px_28px_1fr_92px] items-center gap-3 border-b border-border/40 py-2 last:border-0">
              <span className="tabular font-mono text-[10px] text-muted-foreground">{i + 1}</span>
              <HeroIcon heroId={p.hero_id} size={26} />
              <div className="min-w-0">
                <span className="block truncate text-sm">{names?.get(p.account_id)?.personaname ?? heroes.get(p.hero_id)?.name}</span>
                <div className="relative mt-1 h-1 overflow-hidden rounded-full bg-muted/70">
                  <motion.div
                    className={cn("h-full", p.team === 0 ? "bg-amber-team" : "bg-sapphire-team")}
                    initial={{ width: 0 }} whileInView={{ width: `${(acc / max) * 100}%` }} viewport={{ once: true }} transition={{ duration: 0.6, ease: "easeOut" }}
                  />
                  <span className="absolute inset-y-[-3px] w-px bg-foreground/50" style={{ left: `${(avg / max) * 100}%` }} title="среднее по матчу" />
                </div>
              </div>
              <div className="text-right">
                <p className={cn("tabular font-display text-sm font-bold", p.team === 0 ? "text-amber-team" : "text-sapphire-team")}>{acc.toFixed(1)}%</p>
                <p className={cn("tabular font-mono text-[9px]", d >= 0 ? "text-win" : "text-loss")}>{d >= 0 ? "+" : ""}{d.toFixed(1)} · {fmtK(shots)} выстр.</p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export function ItemsTimeline({ players, names }: { players: DeepPlayer[]; names?: Names }) {
  const items = useItemMap();
  const heroes = useHeroMap();
  const [sel, setSel] = useState(players[0]?.account_id);
  const p = players.find((x) => x.account_id === sel) ?? players[0];
  if (!p) return null;
  const bought = p.items.filter((i) => items.has(i.item_id) && items.get(i.item_id)?.type === "upgrade").sort((a, b) => a.game_time_s - b.game_time_s);
  const final = bought.filter((i) => !i.sold_time_s);
  const end = Math.max(1, p.stats.at(-1)?.time_stamp_s ?? bought.at(-1)?.game_time_s ?? 1);
  const phases = [["Ранняя игра", "0–10 мин", 0, 600], ["Середина", "10–25 мин", 600, 1500], ["Поздняя", "25+ мин", 1500, 1e9]] as const;
  const slotBorder = (s?: string) => s === "weapon" ? "border-amber-team/70" : s === "vitality" ? "border-win/70" : s === "spirit" ? "border-chart-5/70" : "border-border";
  const Img = ({ id, size = 36, dim }: { id: number; size?: number; dim?: boolean }) => {
    const it = items.get(id)!;
    return <img src={it.shop_image_webp ?? it.image_webp ?? it.image} alt={it.name} title={it.name} style={{ width: size, height: size }} className={cn("border-2 bg-secondary p-0.5", slotBorder(it.item_slot_type), dim && "opacity-40 grayscale")} />;
  };
  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-2">
        {[0, 1].map((t) => (
          <div key={t} className="panel relative p-3">
            <span aria-hidden className={cn("absolute inset-x-0 top-0 h-0.5", t === 0 ? "bg-amber-team" : "bg-sapphire-team")} />
            <p className={cn("mb-2 font-mono text-[10px] uppercase tracking-widest", t === 0 ? "text-amber-team" : "text-sapphire-team")}>{TEAM_NAME[t]}</p>
            <div className="grid grid-cols-6 gap-2">
              {players.filter((x) => x.team === t).map((x) => (
                <button key={x.account_id} onClick={() => setSel(x.account_id)} className={cn("group text-center transition-opacity", x.account_id !== p.account_id && "opacity-60 hover:opacity-100")}>
                  <HeroIcon heroId={x.hero_id} size={44} className={cn("mx-auto", x.account_id === p.account_id && "ring-2 ring-primary")} />
                  <span className="mt-1 block truncate text-[10px]">{names?.get(x.account_id)?.personaname ?? heroes.get(x.hero_id)?.name}</span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <section className="panel p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <HeroIcon heroId={p.hero_id} size={48} />
            <div>
              <p className="font-display text-xl font-bold">{names?.get(p.account_id)?.personaname ?? heroes.get(p.hero_id)?.name}</p>
              <p className="font-mono text-[10px] uppercase text-muted-foreground">{heroes.get(p.hero_id)?.name} · {bought.length} покупок · {fmtK(final.reduce((s, i) => s + (items.get(i.item_id)?.cost ?? 0), 0))} душ в сборке</p>
            </div>
          </div>
        </div>
        <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-primary">◆ Финальная сборка</p>
        <div className="flex flex-wrap gap-2">
          {final.map((i, k) => (
            <div key={k} className="text-center"><Img id={i.item_id} size={52} /><p className="tabular mt-0.5 font-mono text-[10px] text-muted-foreground">{fmtDuration(i.game_time_s)}</p></div>
          ))}
        </div>

        <p className="mb-2 mt-6 font-mono text-[10px] uppercase tracking-widest text-primary">◆ Шкала покупок</p>
        <div className="relative h-14 border-b border-border">
          {bought.map((i, k) => (
            <span key={k} className="absolute bottom-1 -translate-x-1/2" style={{ left: `${(i.game_time_s / end) * 100}%`, bottom: (k % 2) * 22 + 2 }}><Img id={i.item_id} size={20} dim={i.sold_time_s > 0} /></span>
          ))}
        </div>
        <div className="flex justify-between font-mono text-[9px] text-muted-foreground"><span>0:00</span><span>{fmtDuration(end / 2)}</span><span>{fmtDuration(end)}</span></div>

        <div className="mt-6 grid gap-3 md:grid-cols-3">
          {phases.map(([l, sub, from, to]) => {
            const list = bought.filter((i) => i.game_time_s >= from && i.game_time_s < to);
            return (
              <div key={l} className="border border-border p-3">
                <div className="mb-2 flex items-baseline justify-between border-b border-border pb-1.5"><p className="font-display font-bold">{l}</p><p className="font-mono text-[10px] text-muted-foreground">{sub} · {fmtK(list.reduce((s, i) => s + (items.get(i.item_id)?.cost ?? 0), 0))}</p></div>
                <div className="flex flex-wrap gap-1.5">{list.length ? list.map((i, k) => <Img key={k} id={i.item_id} size={32} dim={i.sold_time_s > 0} />) : <span className="text-xs text-muted-foreground">—</span>}</div>
              </div>
            );
          })}
        </div>
        {bought.some((i) => i.sold_time_s > 0) && (
          <p className="mt-4 font-mono text-[10px] uppercase text-muted-foreground">Продано: {bought.filter((i) => i.sold_time_s > 0).map((i) => `${items.get(i.item_id)?.name} (${fmtDuration(i.sold_time_s)})`).join(" · ")}</p>
        )}
      </section>
    </div>
  );
}

type DuelPlayer = DeepPlayer & { player_slot?: number; death_details?: { game_time_s: number; killer_player_slot: number }[] };

/** Who-killed-whom matrix: rows = Hidden King killers, cols = Archmother victims. */
export function DuelMatrix({ players, names }: { players: DuelPlayer[]; names: Names }) {
  const heroes = useHeroMap();
  const bySlot = new Map(players.map((p) => [p.player_slot, p]));
  const kills = new Map<string, number>();
  for (const v of players) for (const d of v.death_details ?? []) {
    const k = bySlot.get(d.killer_player_slot); if (!k || k.team === v.team) continue;
    const key = `${k.player_slot}-${v.player_slot}`; kills.set(key, (kills.get(key) ?? 0) + 1);
  }
  const hk = players.filter((p) => p.team === 0), am = players.filter((p) => p.team === 1);
  const max = Math.max(1, ...kills.values());
  const nm = (p: DuelPlayer) => names?.get(p.account_id)?.personaname ?? heroes.get(p.hero_id)?.name ?? "";
  const nemesis = (p: DuelPlayer) => {
    const enemies = p.team === 0 ? am : hk;
    const best = enemies.map((e) => ({ e, n: kills.get(`${e.player_slot}-${p.player_slot}`) ?? 0 })).sort((a, b) => b.n - a.n)[0];
    return best && best.n > 0 ? best : null;
  };
  return (
    <section className="panel gazette-frame relative overflow-hidden p-5">
      <span aria-hidden className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-primary/70 via-primary/20 to-transparent" />
      <SectionTitle right={<span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">строка убил · столбец погиб</span>}>Матрица дуэлей</SectionTitle>
      <div className="overflow-x-auto">
        <table className="text-xs">
          <thead>
            <tr>
              <th className="p-1 text-left font-mono text-[10px] font-normal uppercase tracking-widest text-amber-team">Hidden King ↓</th>
              {am.map((s) => <th key={s.player_slot} className="p-1"><HeroIcon heroId={s.hero_id} size={28} className="mx-auto border-sapphire-team" /></th>)}
            </tr>
          </thead>
          <tbody>{hk.map((a) => (
            <tr key={a.player_slot}>
              <td className="flex items-center gap-2 p-1"><HeroIcon heroId={a.hero_id} size={28} className="border-amber-team" /><span className="max-w-28 truncate">{nm(a)}</span></td>
              {am.map((s) => {
                const ab = kills.get(`${a.player_slot}-${s.player_slot}`) ?? 0, ba = kills.get(`${s.player_slot}-${a.player_slot}`) ?? 0;
                return (
                  <td key={s.player_slot} className="p-1">
                    <div className="tabular flex h-9 w-14 items-center justify-center gap-1 border border-border/70" title={`${nm(a)} убил ${nm(s)}: ${ab} · обратно: ${ba}`}
                      style={{ boxShadow: `inset 0 0 0 999px color-mix(in oklab, var(--${ab >= ba ? "color-amber-team" : "color-sapphire-team"}) ${(Math.max(ab, ba) / max) * 45}%, transparent)` }}>
                      <span className="text-amber-team">{ab}</span><span className="text-muted-foreground">:</span><span className="text-sapphire-team">{ba}</span>
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}</tbody>
        </table>
      </div>
      <div className="mt-5 grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
        {players.map((p) => { const n = nemesis(p); return n ? (
          <div key={p.player_slot} className="grid grid-cols-[24px_1fr_24px_auto] items-center gap-2 border-b border-border/40 py-2 text-xs">
            <HeroIcon heroId={p.hero_id} size={24} />
            <span className="truncate">{nm(p)}</span>
            <HeroIcon heroId={n.e.hero_id} size={24} className="border-loss/60" />
            <span className="tabular text-loss">×{n.n}</span>
          </div>) : null; })}
      </div>
    </section>
  );
}

/** Minute each player completed their first T3 and T4 item. */
export function PowerSpikes({ players, names }: { players: DeepPlayer[]; names: Names }) {
  const heroes = useHeroMap();
  const items = useItemMap();
  const rows = players.map((p) => {
    const first = (t: number) => p.items.filter((i) => items.get(i.item_id)?.item_tier === t).sort((a, b) => a.game_time_s - b.game_time_s)[0];
    return { p, t3: first(3), t4: first(4) };
  }).sort((a, b) => (a.t4?.game_time_s ?? 1e9) - (b.t4?.game_time_s ?? 1e9) || (a.t3?.game_time_s ?? 1e9) - (b.t3?.game_time_s ?? 1e9));
  const maxT = Math.max(60, ...rows.flatMap((r) => [r.t3?.game_time_s ?? 0, r.t4?.game_time_s ?? 0]));
  const ticks = Array.from({ length: Math.floor(maxT / 300) + 1 }, (_, i) => i * 300);

  return (
    <section className="panel relative overflow-hidden p-5">
      <span aria-hidden className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-primary/70 via-primary/20 to-transparent" />
      <SectionTitle right={<span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">◆ первый T3 · ★ первый T4</span>}>Пики силы</SectionTitle>
      <div className="space-y-1">
        {rows.map(({ p, t3, t4 }, i) => (
          <div key={p.account_id} className="grid grid-cols-[28px_110px_1fr_110px] items-center gap-3 border-b border-border/40 py-2 last:border-0">
            <HeroIcon heroId={p.hero_id} size={26} className={p.team === 0 ? "border-amber-team/50" : "border-sapphire-team/50"} />
            <span className="truncate text-xs">{names?.get(p.account_id)?.personaname ?? heroes.get(p.hero_id)?.name}</span>
            <div className="relative h-7 border-x border-border/60">
              {ticks.map((t) => <span key={t} aria-hidden className="absolute inset-y-0 w-px bg-border/50" style={{ left: `${(t / maxT) * 100}%` }} />)}
              {[t3, t4].map((it, k) => it ? (
                <motion.div
                  key={k}
                  className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2"
                  initial={{ opacity: 0, scale: 0.5 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} transition={{ delay: 0.1 + i * 0.03 + k * 0.1, type: "spring", stiffness: 260, damping: 18 }}
                  style={{ left: `${(it.game_time_s / maxT) * 100}%` }}
                  title={`${items.get(it.item_id)?.name} · ${fmtDuration(it.game_time_s)}`}
                >
                  <img src={items.get(it.item_id)?.shop_image_webp ?? items.get(it.item_id)?.image_webp ?? items.get(it.item_id)?.image} alt="" className={cn("h-6 w-6 border-2 bg-secondary p-0.5", k ? "border-primary" : p.team === 0 ? "border-amber-team" : "border-sapphire-team")} />
                </motion.div>) : null)}
            </div>
            <span className="tabular text-right font-mono text-[10px] text-muted-foreground">T3 {t3 ? fmtDuration(t3.game_time_s) : "—"} · T4 {t4 ? fmtDuration(t4.game_time_s) : "—"}</span>
          </div>
        ))}
      </div>
      <div className="mt-2 flex justify-between font-mono text-[9px] text-muted-foreground">
        {ticks.map((t) => <span key={t}>{Math.round(t / 60)}'</span>)}
      </div>
    </section>
  );
}
