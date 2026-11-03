import { Link } from "@tanstack/react-router";
import { CheckCircle2, Info, XCircle } from "lucide-react";
import { useState } from "react";

import { HeroIcon, SectionTitle, useHeroMap } from "@/components/dl";
import { advantageSeries, laneResults, LANE_NAMES, LANE_TIME, playerTips, snapAt, type APlayer } from "@/lib/analysis";
import { fmtDuration, fmtK } from "@/lib/format";
import { cn } from "@/lib/utils";

type Names = Map<number, { personaname: string }> | undefined;

export function MatchAnalysis({ view, players, durationS, names }: { view: "lanes" | "tips"; players: APlayer[]; durationS: number; names: Names }) {
  return view === "lanes" ? (
    <div className="space-y-8">
      <AdvantageChart players={players} />
      <Lanes players={players} names={names} />
    </div>
  ) : (
    <Tips players={players} durationS={durationS} names={names} />
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
        <span className="text-amber-team">▲ Амбер впереди</span>
        <span>{series.slice(1).map((s) => `${fmtDuration(s.t)}: ${s.diff > 0 ? "+" : ""}${fmtK(s.diff)}`).join(" · ")}</span>
        <span className="text-sapphire-team">▼ Сапфир впереди</span>
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
                {l.winner === 0 ? "Амбер" : l.winner === 1 ? "Сапфир" : "Ничья"}
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
                          <span className="tabular text-primary">{fmtK(s?.net_worth)}</span>
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

function Tips({ players, durationS, names }: { players: APlayer[]; durationS: number; names: Names }) {
  const heroes = useHeroMap();
  const [sel, setSel] = useState(players[0]?.account_id);
  const p = players.find((x) => x.account_id === sel) ?? players[0];
  if (!p) return null;
  const tips = playerTips(p, players, durationS);
  const Icon = { good: CheckCircle2, bad: XCircle, info: Info };
  return (
    <section className="grid gap-6 lg:grid-cols-[260px_1fr]">
      <div className="panel space-y-1 p-2">
        {[...players].sort((a, b) => a.team - b.team).map((x) => (
          <button key={x.account_id} onClick={() => setSel(x.account_id)} className={cn("flex w-full items-center gap-2 rounded-md p-2 text-left text-sm", x.account_id === p.account_id ? "bg-primary/15 text-primary" : "hover:bg-secondary")}>
            <HeroIcon heroId={x.hero_id} size={28} />
            <span className={cn("h-2 w-2 shrink-0 rounded-full", x.team === 0 ? "bg-amber-team" : "bg-sapphire-team")} />
            <span className="truncate">{names?.get(x.account_id)?.personaname ?? `#${x.account_id}`}</span>
          </button>
        ))}
      </div>
      <div>
        <SectionTitle>Разбор: {names?.get(p.account_id)?.personaname ?? `#${p.account_id}`} · {heroes.get(p.hero_id)?.name}</SectionTitle>
        <div className="space-y-3">
          {tips.length === 0 && <p className="text-muted-foreground">Недостаточно данных для советов.</p>}
          {tips.map((t, i) => {
            const I = Icon[t.tone];
            return (
              <div key={i} className="panel flex gap-3 p-4">
                <I className={cn("mt-0.5 h-5 w-5 shrink-0", t.tone === "good" ? "text-win" : t.tone === "bad" ? "text-loss" : "text-primary")} />
                <div>
                  <p className="font-semibold">{t.title}</p>
                  <p className="text-sm text-muted-foreground">{t.text}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
