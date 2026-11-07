import { useMemo } from "react";
import type { MatchHistoryEntry } from "@/lib/api";
import { heroProgress } from "@/lib/heroProgress";
import { HeroIcon, useHeroMap } from "@/components/dl";
import { cn } from "@/lib/utils";

function Spark({ data }: { data: number[] }) {
  if (data.length < 2) return null;
  const w = 120, h = 28;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - v * h}`).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-7 w-full" preserveAspectRatio="none">
      <line x1="0" x2={w} y1={h / 2} y2={h / 2} className="stroke-border" strokeDasharray="2 3" />
      <polyline points={pts} fill="none" className="stroke-primary" strokeWidth="1.5" />
    </svg>
  );
}

function Delta({ now, prev, pct, digits = 1 }: { now: number; prev?: number; pct?: boolean; digits?: number }) {
  const fmt = (v: number) => (pct ? `${(v * 100).toFixed(0)}%` : v.toFixed(digits));
  if (prev === undefined) return <span className="tabular">{fmt(now)}</span>;
  const d = now - prev;
  return (
    <span className="tabular">
      {fmt(now)}{" "}
      <span className={cn("text-[10px]", d > 0 ? "text-win" : d < 0 ? "text-loss" : "text-muted-foreground")}>
        {d > 0 ? "▲" : d < 0 ? "▼" : "•"}{pct ? `${Math.abs(d * 100).toFixed(0)}` : Math.abs(d).toFixed(digits)}
      </span>
    </span>
  );
}

export function HeroProgressPanel({ history }: { history: MatchHistoryEntry[] }) {
  const heroes = useHeroMap();
  const rows = useMemo(() => heroProgress(history), [history]);
  if (!rows.length) return null;
  return (
    <section className="mb-6">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h3 className="font-display text-xl">Прогресс на героях</h3>
        <p className="text-xs text-muted-foreground">последние игры против предыдущих · из {history.length} загруженных матчей</p>
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {rows.map((r) => {
          const hero = heroes.get(r.heroId);
          return (
            <div key={r.heroId} className="panel p-4">
              <div className="flex items-center gap-3">
                <HeroIcon hero={hero} className="h-10 w-10" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-display">{hero?.name ?? `#${r.heroId}`}</p>
                  <p className="text-[11px] text-muted-foreground">{r.total} игр</p>
                </div>
                <span className={cn("game-status-plate", r.trend === "up" ? "text-win" : r.trend === "down" ? "text-loss" : "text-muted-foreground")}>
                  {r.trend === "up" ? "Растёт" : r.trend === "down" ? "Спад" : "Стабильно"}
                </span>
              </div>
              <div className="mt-3"><Spark data={r.series} /></div>
              <div className="mt-2 grid grid-cols-3 gap-2 text-sm">
                <div><p className="text-[10px] uppercase text-muted-foreground">Винрейт</p><Delta now={r.recent.winrate} prev={r.previous?.winrate} pct /></div>
                <div><p className="text-[10px] uppercase text-muted-foreground">KDA</p><Delta now={r.recent.kda} prev={r.previous?.kda} /></div>
                <div><p className="text-[10px] uppercase text-muted-foreground">Души/мин</p><Delta now={r.recent.soulsPerMin} prev={r.previous?.soulsPerMin} digits={0} /></div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
