import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Coins, Crosshair, HeartPulse, Shield, Swords, Zap } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";

import { HeroIcon, useHeroMap } from "@/components/dl";
import { GradeSeal } from "@/components/GradeReport";
import { globalAvgQuery } from "@/components/PlayerInsights";
import { LANE_NAMES, snapAt, type APlayer, type StatSnap } from "@/lib/analysis";
import { fmtDuration, fmtK } from "@/lib/format";
import { gradeVsGlobal } from "@/lib/grade";
import { globalAverages } from "@/lib/playerStats";
import { compareMetric } from "@/lib/matchMetrics";
import { cn } from "@/lib/utils";

type Names = Map<number, { personaname: string }> | undefined;
type P = APlayer & { level?: number };
const TEAM = ["Hidden King", "Archmother"] as const;
const teamText = (t: number) => (t === 0 ? "text-amber-team" : "text-sapphire-team");
const teamBg = (t: number) => (t === 0 ? "bg-amber-team" : "bg-sapphire-team");
const teamBorder = (t: number) => (t === 0 ? "border-amber-team" : "border-sapphire-team");
const last = (p: APlayer): Partial<StatSnap> => p.stats.at(-1) ?? {};
const fmtN = (v: number) => (Math.abs(v) >= 10000 ? fmtK(v) : Math.round(v).toLocaleString("ru-RU"));

/* ---------------- Player picker ---------------- */
function Picker({ players, sel, onSel, names }: { players: P[]; sel: number; onSel: (id: number) => void; names: Names }) {
  const heroes = useHeroMap();
  return (
    <div className="panel grid gap-px p-0 md:grid-cols-[1fr_auto_1fr]">
      {[0, 1].map((t) => (
        <div key={t} className={cn("p-3", t === 1 && "md:order-3")}>
          <p className={cn("mb-2 flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.25em]", teamText(t), t === 1 && "md:justify-end")}>
            <i className={cn("h-3 w-1", teamBg(t))} />{TEAM[t]}
          </p>
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
            {players.filter((p) => p.team === t).map((p) => (
              <button key={p.account_id} onClick={() => onSel(p.account_id)}
                className={cn("group flex min-w-0 items-center gap-2 border p-1.5 text-left transition-all",
                  p.account_id === sel ? cn(teamBorder(t), "bg-primary/10 shadow-[inset_3px_0_0] shadow-current") : "border-border/40 hover:border-border hover:bg-card")}>
                <HeroIcon heroId={p.hero_id} size={32} />
                <span className="min-w-0">
                  <span className={cn("block truncate text-xs font-semibold", p.account_id === sel && teamText(t))}>{names?.get(p.account_id)?.personaname ?? `#${p.account_id}`}</span>
                  <span className="block truncate text-[10px] text-muted-foreground">{heroes.get(p.hero_id)?.name}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      ))}
      <div className="hidden items-center md:order-2 md:flex"><span className="grid h-9 w-9 rotate-45 place-items-center border border-border bg-card"><span className="-rotate-45 font-mono text-[10px] text-muted-foreground">VS</span></span></div>
    </div>
  );
}

/* ---------------- Category card ---------------- */
interface Row { label: string; v: number; avg: number; fmt?: (v: number) => string; lowerBetter?: boolean; rank?: number; count?: number }
function CategoryCard({ icon, title, main, rows, rank, of, lobbyRank, lobbyCount, tone, delay }: { icon: ReactNode; title: string; main: Row; rows: Row[]; rank: number; of: number; lobbyRank: number; lobbyCount: number; tone: "good" | "bad" | "neutral"; delay: number }) {
  const f = main.fmt ?? fmtN;
  const diff = main.v - main.avg;
  const max = Math.max(main.v, main.avg) * 1.25 || 1;
  return (
    <motion.section data-motion-owner initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay, duration: 0.35 }}
      className="panel flex flex-col p-0">
      <header className="flex items-center justify-between border-b border-border/60 px-4 py-2.5">
        <p className="flex items-center gap-2 font-display text-sm font-bold uppercase tracking-wider">{icon}{title}</p>
        <span title="Место по основному показателю; цвет полосы — положение в команде, а не отклонение от среднего" className={cn("shrink-0 border px-1.5 py-0.5 text-right font-mono text-[10px]", rank === 1 ? "border-primary text-primary" : "border-border text-muted-foreground")}>#{rank}/{of} команда<br />#{lobbyRank}/{lobbyCount} лобби</span>
      </header>
      <div className="px-4 pt-3">
        <p className="text-xs text-muted-foreground">{main.label}</p>
        <p className="tabular font-display text-4xl font-black leading-tight">{f(main.v)}</p>
        <p className="text-xs text-muted-foreground"><span>{diff >= 0 ? "↑" : "↓"} {f(Math.abs(diff))}</span> <span>{diff >= 0 ? "выше" : "ниже"} среднего по команде ({f(main.avg)})</span></p>
        <div className="relative mt-3 h-1.5 bg-muted/60">
          <motion.span className={cn("absolute inset-y-0 left-0", tone === "good" ? "bg-win" : tone === "bad" ? "bg-loss/80" : "bg-muted-foreground")} initial={{ width: 0 }} animate={{ width: `${(main.v / max) * 100}%` }} transition={{ duration: 0.7, delay }} />
          <span className="absolute -inset-y-1 w-0.5 bg-foreground/70" style={{ left: `${(main.avg / max) * 100}%` }} />
        </div>
      </div>
      <dl className="mt-3 divide-y divide-border/40 px-4 pb-2">
        {rows.map((r) => {
          const ff = r.fmt ?? fmtN;
          const top = r.rank === 1 && (r.count ?? 0) > 1;
          return (
            <div key={r.label} className="flex items-center justify-between py-2">
              <dt className="flex items-center gap-2 text-sm">{r.label}{top && <span className="border border-primary/60 px-1 font-mono text-[9px] uppercase text-primary">Топ</span>}</dt>
              <dd className="text-right"><span className="tabular font-semibold">{ff(r.v)}</span><span className="block font-mono text-[10px] text-muted-foreground">в команде: {ff(r.avg)}</span></dd>
            </div>
          );
        })}
      </dl>
    </motion.section>
  );
}

/* ---------------- Dossier ---------------- */
export function PlayerDossier({ players, names, durationS, winner }: { players: P[]; names: Names; durationS: number; winner: number }) {
  const heroes = useHeroMap();
  const g = useQuery(globalAvgQuery);
  const [sel, setSel] = useState(players[0]?.account_id ?? 0);
  const p = players.find((x) => x.account_id === sel) ?? players[0];
  const min = Math.max(1, durationS / 60);

  const data = useMemo(() => {
    if (!p) return null;
    const mates = players.filter((x) => x.team === p.team);
    const teamKills = mates.reduce((s, x) => s + x.kills, 0) || 1;
    const metric = (fn: (x: P) => number, lowerBetter = false) => {
      const vals = mates.map(fn);
      const v = fn(p);
      const direction = lowerBetter ? "lower" : "higher";
      const team = compareMetric(v, vals, direction);
      const lobby = compareMetric(v, players.map(fn), direction);
      return { v, ...team, lobbyRank: lobby.rank, lobbyCount: lobby.count };
    };
    const at10 = (x: APlayer) => snapAt(x, 600) ?? ({} as Partial<StatSnap>);
    const M = {
      spm: metric((x) => x.net_worth / min),
      nw: metric((x) => x.net_worth),
      lh: metric((x) => x.last_hits),
      dn: metric((x) => x.denies),
      dmg: metric((x) => last(x).player_damage ?? 0),
      dpm: metric((x) => (last(x).player_damage ?? 0) / min),
      dpl: metric((x) => (last(x).player_damage ?? 0) / (x.deaths + 1)),
      taken: metric((x) => last(x).player_damage_taken ?? 0, true),
      tank: metric((x) => last(x).player_damage_taken ?? 0),
      tpm: metric((x) => (last(x).player_damage_taken ?? 0) / min),
      heal: metric((x) => last(x).player_healing ?? 0),
      deaths: metric((x) => x.deaths, true),
      as: metric((x) => x.assists),
      kp: metric((x) => (x.kills + x.assists) / teamKills),
      e_dmg: metric((x) => at10(x).player_damage ?? 0),
      e_k: metric((x) => at10(x).kills ?? 0),
      e_nw: metric((x) => at10(x).net_worth ?? 0),
      e_lh: metric((x) => at10(x).creep_kills ?? 0),
    };
    const l = last(p);
    const shots = (l.shots_hit ?? 0) + (l.shots_missed ?? 0);
    return { M, of: mates.length, kp: (p.kills + p.assists) / teamKills, acc: shots ? (l.shots_hit ?? 0) / shots : 0 };
  }, [p, players, min]);

  if (!p || !data) return null;
  const { M, of } = data;
  const ga = g.data ? globalAverages(g.data) : null;
  const grade = ga ? gradeVsGlobal({ k: p.kills, d: p.deaths, a: p.assists, nw: p.net_worth, lh: p.last_hits, won: p.team === winner }, ga, durationS) : null;
  const name = names?.get(p.account_id)?.personaname ?? `#${p.account_id}`;
  const kdaV = (p.kills + p.assists) / Math.max(1, p.deaths);
  const pct = (v: number) => `${Math.round(v * 100)}%`;
  const role = [["Фармер", M.nw.rank], ["Боец", M.dmg.rank], ["Танк", M.tank.rank], ["Поддержка", M.as.rank]].sort((a, b) => (a[1] as number) - (b[1] as number))[0]?.[0] ?? "Универсал";

  return (
    <div className="space-y-4">
      <Picker players={players} sel={p.account_id} onSel={setSel} names={names} />

      {/* Header */}
      <motion.section key={p.account_id} data-motion-owner initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}
        className={cn("panel relative overflow-hidden border-l-4 p-0", teamBorder(p.team))}>
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-primary/10 via-transparent to-transparent" />
        <div className="relative flex flex-wrap items-center gap-6 p-6">
          <div className="relative">
            <HeroIcon heroId={p.hero_id} size={96} />
            {p.level != null && <span className={cn("absolute -bottom-2 left-1/2 -translate-x-1/2 whitespace-nowrap px-2 py-0.5 font-mono text-[10px] font-bold text-background", teamBg(p.team))}>LVL {p.level}</span>}
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground">Досье / {TEAM[p.team]} / {LANE_NAMES[p.assigned_lane] ?? "линия ?"}</p>
            <Link to="/players/$accountId" params={{ accountId: String(p.account_id) }} className="block truncate font-display text-4xl font-black uppercase hover:text-primary">{name}</Link>
            <p className={cn("font-display text-lg", teamText(p.team))}>{heroes.get(p.hero_id)?.name}</p>
            <div className="mt-3 flex flex-wrap gap-2 font-mono text-[10px] uppercase">
              <span className="border border-primary/60 bg-primary/10 px-2 py-1 text-primary">◆ {role}</span>
              <span className={cn("border px-2 py-1", p.team === winner ? "border-win/60 text-win" : "border-loss/60 text-loss")}>{p.team === winner ? "Победа" : "Поражение"}</span>
              <span className="border border-border px-2 py-1 text-muted-foreground">Матч {fmtDuration(durationS)}</span>
            </div>
          </div>
          {grade && <GradeSeal score={grade.score} caption={`Рейтинг · ${grade.score.toFixed(0)}`} />}
        </div>
      </motion.section>

      {/* K / D / A */}
      <section className="panel grid grid-cols-3 p-0">
        {([["Убийства", p.kills, "text-win", M.e_k], ["Смерти", p.deaths, "text-loss", M.deaths], ["Помощь", p.assists, "text-telemetry", M.as]] as const).map(([l, v, c], i) => (
          <div key={l} className={cn("p-5 text-center", i < 2 && "border-r border-border/60")}>
            <p className={cn("font-mono text-[10px] uppercase tracking-[0.3em]", c)}>{l}</p>
            <motion.p key={`${p.account_id}${l}`} initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", delay: i * 0.06 }} className="tabular font-display text-6xl font-black">{v}</motion.p>
          </div>
        ))}
        <div className="col-span-3 grid grid-cols-2 border-t border-border/60 font-mono text-xs sm:grid-cols-4">
          {[["KDA", kdaV.toFixed(2)], ["Участие в убийствах", pct(data.kp)], ["Точность", pct(data.acc)], ["Души/мин", fmtN(M.spm.v)]].map(([l, v]) => (
            <div key={l} className="flex items-baseline justify-between gap-2 px-4 py-3"><span className="text-[10px] uppercase tracking-wider text-muted-foreground">{l}</span><span className="text-lg font-bold">{v}</span></div>
          ))}
        </div>
      </section>

      {/* Category cards */}
      <div className="grid gap-4 md:grid-cols-2">
        <CategoryCard delay={0} icon={<Coins className="h-4 w-4 text-primary" />} title="Экономика" {...M.spm} of={of}
          main={{ label: "Души в минуту", v: M.spm.v, avg: M.spm.avg }}
          rows={[{ label: "Всего душ", ...M.nw }, { label: "Крипы", ...M.lh }, { label: "Денаи", ...M.dn }]} />
        <CategoryCard delay={0.05} icon={<Crosshair className="h-4 w-4 text-primary" />} title="Урон" {...M.dmg} of={of}
          main={{ label: "Урон по героям", v: M.dmg.v, avg: M.dmg.avg }}
          rows={[{ label: "В минуту", ...M.dpm }, { label: "На отрезок между смертями", ...M.dpl }]} />
        <CategoryCard delay={0.1} icon={<Shield className="h-4 w-4 text-primary" />} title="Живучесть" {...M.deaths} of={of}
          main={{ label: "Смерти · меньше лучше", v: M.deaths.v, avg: M.deaths.avg, lowerBetter: true }}
          rows={[{ label: "Получено урона", v: M.taken.v, avg: M.taken.avg, lowerBetter: true }, { label: "Получено / мин", v: M.tpm.v, avg: M.tpm.avg, lowerBetter: true }, { label: "Лечение", v: M.heal.v, avg: M.heal.avg }]} />
        <CategoryCard delay={0.15} icon={<Zap className="h-4 w-4 text-primary" />} title="Ранняя игра · 0–10 мин" {...M.e_nw} of={of}
          main={{ label: "Души к 10 минуте", v: M.e_nw.v, avg: M.e_nw.avg }}
          rows={[{ label: "Урон 0–10", ...M.e_dmg }, { label: "Убийства 0–10", ...M.e_k }, { label: "Крипы 0–10", ...M.e_lh }]} />
        <CategoryCard delay={0.2} icon={<HeartPulse className="h-4 w-4 text-primary" />} title="Командная игра" {...M.kp} of={of}
          main={{ label: "Участие в убийствах", v: M.kp.v, avg: M.kp.avg, fmt: pct }}
          rows={[{ label: "Помощь", ...M.as }, { label: "Лечение", ...M.heal }]} />
        <LaneDuelMini p={p} players={players} names={names} />
      </div>
    </div>
  );
}

/* Compact lane duel for the selected player's lane at 10 minutes */
function LaneDuelMini({ p, players, names }: { p: P; players: P[]; names: Names }) {
  return <LaneDuel lane={p.assigned_lane} players={players} names={names} t={600} compact />;
}

/* ---------------- Lane duel (mirrored bars) ---------------- */
const DUEL_ROWS: [string, (s: Partial<StatSnap>) => number][] = [
  ["Души", (s) => s.net_worth ?? 0],
  ["Убийства", (s) => s.kills ?? 0],
  ["Смерти", (s) => s.deaths ?? 0],
  ["Крипы", (s) => s.creep_kills ?? 0],
  ["Денаи", (s) => s.denies ?? 0],
  ["Урон", (s) => s.player_damage ?? 0],
  ["Получено", (s) => s.player_damage_taken ?? 0],
];

export function LaneDuel({ lane, players, names, t, compact }: { lane: number; players: P[]; names: Names; t: number; compact?: boolean }) {
  const side = (team: number) => players.filter((x) => x.assigned_lane === lane && x.team === team);
  const sum = (arr: P[], f: (s: Partial<StatSnap>) => number) => arr.reduce((a, x) => a + f(snapAt(x, t) ?? {}), 0);
  const a = side(0), b = side(1);
  const sa = sum(a, DUEL_ROWS[0]![1]), sb = sum(b, DUEL_ROWS[0]![1]);
  const lead = sa - sb;
  const share = sa + sb ? sa / (sa + sb) : 0.5;
  return (
    <section className="panel p-0">
      <header className="flex items-center justify-between border-b border-border/60 px-4 py-2.5">
        <p className="flex items-center gap-2 font-display text-sm font-bold uppercase tracking-wider"><Swords className="h-4 w-4 text-primary" />{LANE_NAMES[lane] ?? "Линия"} · дуэль</p>
        <span className={cn("font-mono text-[10px] uppercase tracking-wider", lead >= 0 ? "text-amber-team" : "text-sapphire-team")}>{lead >= 0 ? "Hidden King" : "Archmother"} впереди · {fmtDuration(t)}</span>
      </header>
      <div className="p-4">
        <div className="mb-3 grid grid-cols-[1fr_auto_1fr] items-end gap-3">
          <div className="flex items-center justify-end gap-2">{a.map((x) => <span key={x.account_id} title={names?.get(x.account_id)?.personaname}><HeroIcon heroId={x.hero_id} size={compact ? 28 : 36} /></span>)}</div>
          <span className="font-mono text-[10px] text-muted-foreground">VS</span>
          <div className="flex items-center gap-2">{b.map((x) => <span key={x.account_id} title={names?.get(x.account_id)?.personaname}><HeroIcon heroId={x.hero_id} size={compact ? 28 : 36} /></span>)}</div>
        </div>
        <div className="grid grid-cols-[1fr_auto_1fr] items-baseline gap-3 text-center">
          <p className="tabular text-right font-display text-3xl font-black text-amber-team">{fmtK(sa)}</p>
          <p className={cn("font-mono text-sm font-bold", lead >= 0 ? "text-amber-team" : "text-sapphire-team")}>{lead >= 0 ? "+" : "−"}{fmtK(Math.abs(lead))}</p>
          <p className="tabular text-left font-display text-3xl font-black text-sapphire-team">{fmtK(sb)}</p>
        </div>
        <div className="relative my-3 flex h-1">
          <motion.span className="bg-amber-team" initial={{ width: "50%" }} animate={{ width: `${share * 100}%` }} transition={{ duration: 0.8 }} />
          <span className="flex-1 bg-sapphire-team" />
          <motion.span className="absolute -inset-y-1 w-0.5 bg-foreground" initial={{ left: "50%" }} animate={{ left: `${share * 100}%` }} transition={{ duration: 0.8 }} />
        </div>
        <div className="space-y-1">
          {DUEL_ROWS.slice(1).map(([label, f]) => {
            const va = sum(a, f), vb = sum(b, f);
            const mx = Math.max(va, vb) || 1;
            const lowBetter = label === "Смерти" || label === "Получено";
            const aWin = lowBetter ? va < vb : va > vb, bWin = lowBetter ? vb < va : vb > va;
            return (
              <div key={label} className="grid grid-cols-[1fr_84px_1fr] items-center gap-2">
                <div className="flex h-6 justify-end bg-muted/20">
                  <motion.div className={cn("flex items-center justify-end border-r-2 border-amber-team px-2 font-mono text-xs font-bold", aWin ? "bg-gradient-to-l from-amber-team/40 to-transparent text-amber-team" : "text-muted-foreground")}
                    initial={{ width: 0 }} whileInView={{ width: `${Math.max(18, (va / mx) * 100)}%` }} viewport={{ once: true }}>{fmtN(va)}</motion.div>
                </div>
                <span className="text-center font-mono text-[9px] uppercase tracking-[0.15em] text-muted-foreground">{label}</span>
                <div className="flex h-6 bg-muted/20">
                  <motion.div className={cn("flex items-center border-l-2 border-sapphire-team px-2 font-mono text-xs font-bold", bWin ? "bg-gradient-to-r from-sapphire-team/40 to-transparent text-sapphire-team" : "text-muted-foreground")}
                    initial={{ width: 0 }} whileInView={{ width: `${Math.max(18, (vb / mx) * 100)}%` }} viewport={{ once: true }}>{fmtN(vb)}</motion.div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* Full lane duel board with lane and time-window selectors */
export function LaneDuelBoard({ players, names, durationS }: { players: P[]; names: Names; durationS: number }) {
  const lanes = [...new Set(players.map((x) => x.assigned_lane))].filter((l) => LANE_NAMES[l]).sort((x, y) => x - y);
  const [lane, setLane] = useState(lanes[0] ?? 1);
  const windows = [5, 10, 15, 20, 30].filter((m) => m * 60 <= durationS);
  const [t, setT] = useState(Math.min(600, durationS));
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1">
          {lanes.map((l) => (
            <button key={l} onClick={() => setLane(l)} className={cn("border px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider transition-colors", l === lane ? "border-primary bg-primary text-primary-foreground" : "border-border hover:border-primary/60")}>{LANE_NAMES[l]}</button>
          ))}
        </div>
        <div className="flex items-center gap-1 font-mono text-[11px]">
          <span className="mr-1 uppercase tracking-wider text-muted-foreground">Момент</span>
          {[...windows.map((m) => [m * 60, `${m}м`] as const), [durationS, "Итог"] as const].map(([v, l]) => (
            <button key={l} onClick={() => setT(v)} className={cn("border px-2 py-1", v === t ? "border-foreground bg-foreground text-background" : "border-border hover:border-foreground/50")}>{l}</button>
          ))}
        </div>
      </div>
      <LaneDuel lane={lane} players={players} names={names} t={t} />
    </div>
  );
}
