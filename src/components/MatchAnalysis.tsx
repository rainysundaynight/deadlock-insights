import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { HeroIcon, SectionTitle, useHeroMap } from "@/components/dl";
import { GradeSeal, MetricBar, TipColumns } from "@/components/GradeReport";
import { globalAvgQuery } from "@/components/PlayerInsights";
import { globalAverages } from "@/lib/playerStats";
import { AVG_MATCH_S, gradeVsGlobal, perfParts } from "@/lib/grade";
import { advantageSeries, laneResults, LANE_NAMES, LANE_TIME, playerTips, snapAt, type APlayer } from "@/lib/analysis";
import { fmtDuration, fmtK } from "@/lib/format";
import { cn } from "@/lib/utils";

type Names = Map<number, { personaname: string }> | undefined;

type Obj = { destroyed_time_s: number; team_objective_id: number; team: number };
type Boss = { team_killed: number; destroyed_time_s: number };
export function MatchAnalysis({ view, players, durationS, names, objectives, midBoss, winner }: { view: "lanes" | "tips"; players: APlayer[]; durationS: number; names: Names; objectives?: Obj[] | undefined; midBoss?: Boss[] | undefined; winner?: number | undefined }) {
  return view === "lanes" ? (
    <div className="space-y-8">
      <AdvantageChart players={players} />
      <Lanes players={players} names={names} />
    </div>
  ) : (
    <Tips players={players} durationS={durationS} names={names} winner={winner} />
  );
}

function AdvantageChart({ players }: { players: APlayer[] }) {
  const series = advantageSeries(players);
  const W = 800, H = 220;
  const maxT = Math.max(1, ...series.map((s) => s.t));
  const maxD = Math.max(1000, ...series.map((s) => Math.abs(s.diff)));
  const x = (t: number) => (t / maxT) * W;
  const y = (d: number) => H / 2 - (d / maxD) * (H / 2 - 10);
  const path = series.map((s, i) => `${i ? "L" : "M"}${x(s.t).toFixed(1)},${y(s.diff).toFixed(1)}`).join(" ");
  const area = `${path} L${W},${H / 2} L0,${H / 2} Z`;
  return (
    <section className="panel p-4">
      <SectionTitle right={<span className="text-xs text-muted-foreground">разница душ команд</span>}>Преимущество по душам</SectionTitle>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-56 w-full" preserveAspectRatio="none">
        <defs>
          <clipPath id="top"><rect x="0" y="0" width={W} height={H / 2} /></clipPath>
          <clipPath id="bot"><rect x="0" y={H / 2} width={W} height={H / 2} /></clipPath>
        </defs>
        <path d={area} clipPath="url(#top)" className="fill-amber-team/25" />
        <path d={area} clipPath="url(#bot)" className="fill-sapphire-team/25" />
        <line x1="0" x2={W} y1={H / 2} y2={H / 2} className="stroke-border" strokeDasharray="4 4" />
        <line x1={x(LANE_TIME)} x2={x(LANE_TIME)} y1="0" y2={H} className="stroke-primary/40" strokeDasharray="2 4" />
        <path d={path} fill="none" className="stroke-primary" strokeWidth="2" vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="mt-2 flex flex-wrap justify-between gap-2 text-xs text-muted-foreground">
        <span className="text-amber-team">▲ Hidden King впереди</span>
        <span>{series.slice(1).map((s) => `${fmtDuration(s.t)}: ${s.diff > 0 ? "+" : ""}${fmtK(s.diff)}`).join(" · ")}</span>
        <span className="text-sapphire-team">▼ Archmother впереди</span>
      </div>
    </section>
  );
}

function Lanes({ players, names }: { players: APlayer[]; names: Names }) {
  const lanes = laneResults(players);
  return (
    <section>
      <SectionTitle right={<span className="text-xs text-muted-foreground">по душам на 9-й минуте</span>}>Стадия линий</SectionTitle>
      <div className="grid gap-4 lg:grid-cols-3">
        {lanes.map((l) => (
          <div key={l.lane} className="panel p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-display uppercase tracking-wider">{LANE_NAMES[l.lane] ?? `Линия ${l.lane}`}</h3>
              <span className={cn("rounded px-2 py-0.5 text-xs font-semibold uppercase", l.winner === 0 ? "bg-amber-team/20 text-amber-team" : l.winner === 1 ? "bg-sapphire-team/20 text-sapphire-team" : "bg-muted text-muted-foreground")}>
                {l.winner === 0 ? "Hidden King" : l.winner === 1 ? "Archmother" : "Ничья"}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[l.team0, l.team1].map((side, ti) => (
                <div key={ti} className="space-y-2">
                  {side.map((p) => {
                    const s = snapAt(p, LANE_TIME);
                    return (
                      <div key={p.account_id} className="flex items-center gap-2">
                        <HeroIcon heroId={p.hero_id} size={32} />
                        <div className="min-w-0 text-xs">
                          <Link to="/players/$accountId" params={{ accountId: String(p.account_id) }} className="block truncate font-medium hover:text-primary">
                            {names?.get(p.account_id)?.personaname ?? `#${p.account_id}`}
                          </Link>
                          <span className={cn("tabular", p.team === 0 ? "text-amber-team" : "text-sapphire-team")}>{fmtK(s?.net_worth)}</span>
                          <span className="tabular text-muted-foreground"> · {s?.kills ?? 0}/{s?.deaths ?? 0}/{s?.assists ?? 0} · {s?.creep_kills ?? 0}🗡</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
            <div className="mt-3 flex h-2 overflow-hidden rounded-full bg-muted">
              <div className="bg-amber-team" style={{ width: `${(l.souls0 / Math.max(1, l.souls0 + l.souls1)) * 100}%` }} />
              <div className="flex-1 bg-sapphire-team" />
            </div>
            <p className="tabular mt-1 text-center text-xs text-muted-foreground">
              {fmtK(l.souls0)} vs {fmtK(l.souls1)} ({l.diff > 0 ? "+" : ""}{fmtK(l.diff)})
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

function Tips({ players, durationS, names, winner }: { players: APlayer[]; durationS: number; names: Names; winner?: number | undefined }) {
  const heroes = useHeroMap();
  const g = useQuery(globalAvgQuery);
  const [sel, setSel] = useState(players[0]?.account_id);
  const p = players.find((x) => x.account_id === sel) ?? players[0];
  if (!p) return null;
  const tips = playerTips(p, players, durationS);
  const ga = g.data ? globalAverages(g.data) : null;
  const f = (durationS || AVG_MATCH_S) / AVG_MATCH_S;
  const won = p.team === winner;
  const inp = { k: p.kills, d: p.deaths, a: p.assists, nw: p.net_worth, lh: p.last_hits, won: !!won };
  const graded = ga ? gradeVsGlobal(inp, ga, durationS) : null;
  const parts = ga ? perfParts(inp, { k: ga.k * f, d: ga.d * f, a: ga.a * f, nw: ga.nw * f, lh: ga.lh * f }) : [];
  const name = names?.get(p.account_id)?.personaname ?? `#${p.account_id}`;
  return (
    <section className="space-y-4">
      <div className="flex gap-2 overflow-x-auto pb-1">
        {[...players].sort((a, b) => a.team - b.team).map((x) => (
          <button key={x.account_id} onClick={() => setSel(x.account_id)}
            className={cn("flex w-16 shrink-0 flex-col items-center gap-1 border p-1.5 transition-colors", x.account_id === p.account_id ? "border-primary bg-primary/10" : "border-border/50 hover:border-border", x.team === 0 ? "border-b-amber-team" : "border-b-sapphire-team")}>
            <HeroIcon heroId={x.hero_id} size={36} />
            <span className="w-full truncate text-center text-[10px]">{names?.get(x.account_id)?.personaname ?? `#${x.account_id}`}</span>
          </button>
        ))}
      </div>
      <div className="panel grid p-0 lg:grid-cols-[240px_1fr]">
        <div className="flex flex-col items-center gap-3 border-b border-border/60 p-6 lg:border-b-0 lg:border-r">
          <HeroIcon heroId={p.hero_id} size={56} className={p.team === 0 ? "border-amber-team" : "border-sapphire-team"} />
          <div className="text-center">
            <p className="font-display text-lg font-bold">{name}</p>
            <p className={cn("font-mono text-[10px] uppercase tracking-wider", p.team === 0 ? "text-amber-team" : "text-sapphire-team")}>{heroes.get(p.hero_id)?.name} · {p.team === 0 ? "Hidden King" : "Archmother"}</p>
          </div>
          {graded && <GradeSeal score={graded.score} size="md" caption={`${graded.score.toFixed(0)} / 100`} />}
          <p className="tabular font-mono text-sm">{p.kills} / {p.deaths} / {p.assists} · {fmtK(p.net_worth)}</p>
        </div>
        <div className="space-y-5 p-5">
          {parts.length > 0 && (
            <div>
              <p className="mb-1 font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Против среднего игрока · из чего сложилась оценка</p>
              {parts.map((x) => <MetricBar key={x.label} label={x.label} v={x.v * 100} sub={`вес ${Math.round(x.w * 100)}%`} />)}
            </div>
          )}
          <TipColumns tips={tips} empty="Недостаточно данных для советов." />
        </div>
      </div>
    </section>
  );
}
