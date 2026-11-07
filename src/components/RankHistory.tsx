import { Link } from "@tanstack/react-router";
import { RankBadge } from "@/components/dl";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { MatchHistoryEntry } from "@/lib/api";
import { badgeToIdx } from "@/lib/potentialRank";
import { cn } from "@/lib/utils";

type Pt = { t: number; badge: number; delta: number | null; matchId: number };

/** Rank history from the badge recorded on each ranked match in the player's history. */
export function RankHistory({ history, backTo }: { history: MatchHistoryEntry[]; backTo?: string }) {
  const pts: Pt[] = history
    .filter((m) => (m.ranked_display_badge ?? 0) > 10)
    .sort((a, b) => a.start_time - b.start_time)
    .map((m) => ({ t: m.start_time, badge: m.ranked_display_badge as number, delta: m.ranked_delta ?? null, matchId: m.match_id }));

  return (
    <section className="mt-6 border-t border-border pt-5">
      <p className="game-status-plate mb-3 text-primary">История ранга</p>
      {pts.length < 2 ? (
        <p className="text-sm text-muted-foreground">
          {pts.length ? "Пока только один ранговый матч в истории — графику нужно больше." : "В истории нет ранговых матчей с записанным рангом."}
        </p>
      ) : (
        <Chart pts={pts} backTo={backTo} />
      )}
    </section>
  );
}

function Chart({ pts, backTo }: { pts: Pt[]; backTo?: string }) {
  const W = 800, H = 160, P = 12;
  const idx = pts.map((p) => badgeToIdx(p.badge));
  const lo = Math.min(...idx) - 1, hi = Math.max(...idx) + 1;
  const x = (i: number) => P + (i / (pts.length - 1)) * (W - 2 * P);
  const y = (v: number) => H - P - ((v - lo) / (hi - lo)) * (H - 2 * P);
  const d = idx.map((v, i) => `${i ? "L" : "M"}${x(i)},${y(v)}`).join(" ");
  const first = pts[0]!, last = pts[pts.length - 1]!;
  const peak = pts[idx.indexOf(Math.max(...idx))]!;
  const fmt = (t: number) => new Date(t * 1000).toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
  const fmtFull = (t: number) => new Date(t * 1000).toLocaleString("ru-RU", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-6 text-sm">
        <span className="flex items-center gap-2 text-muted-foreground">Начало <RankBadge badge={first.badge} size={32} /></span>
        <span className="flex items-center gap-2 text-muted-foreground">Пик <RankBadge badge={peak.badge} size={32} /></span>
        <span className="flex items-center gap-2 text-muted-foreground">Сейчас <RankBadge badge={last.badge} size={32} /></span>
      </div>
      <div className="relative">
        <svg viewBox={`0 0 ${W} ${H}`} className="h-40 w-full" preserveAspectRatio="none" aria-hidden>
          <path d={d} fill="none" stroke="hsl(var(--primary))" strokeWidth={2} vectorEffect="non-scaling-stroke" className="stroke-primary" />
          {idx.map((v, i) => (
            <circle key={i} cx={x(i)} cy={y(v)} r={3} className="fill-primary" />
          ))}
        </svg>
        {/* Hit areas: every point opens the match it was recorded in. */}
        <div className="absolute inset-0">
          <TooltipProvider delayDuration={120}>
            {pts.map((p, i) => (
              <Tooltip key={p.matchId}>
                <TooltipTrigger asChild>
                  <Link
                    to="/matches/$matchId"
                    params={{ matchId: String(p.matchId) }}
                    {...(backTo ? { search: { from: backTo } } : {})}
                    aria-label={`Матч от ${fmtFull(p.t)} — открыть`}
                    className={cn(
                      "absolute h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-1 ring-transparent",
                      "transition-[background-color,box-shadow,transform] duration-150 hover:bg-primary/25 hover:ring-primary/70",
                      "focus-visible:bg-primary/25 focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none",
                    )}
                    style={{ left: `${(x(i) / W) * 100}%`, top: `${(y(idx[i]!) / H) * 100}%` }}
                  />
                </TooltipTrigger>
                <TooltipContent side="top" collisionPadding={12} className="w-56 border border-border bg-popover p-3 text-xs text-popover-foreground shadow-lg">
                  <span className="mb-1 block font-semibold">{fmtFull(p.t)}</span>
                  <span className="mb-1 flex items-center gap-2"><RankBadge badge={p.badge} size={28} /></span>
                  {p.delta != null && (
                    <span className={cn("block font-mono", p.delta > 0 ? "text-win" : p.delta < 0 ? "text-loss" : "text-muted-foreground")}>
                      {p.delta > 0 ? "+" : ""}{p.delta} к рангу
                    </span>
                  )}
                  <span className="mt-1 block text-muted-foreground">Открыть матч №{p.matchId} →</span>
                </TooltipContent>
              </Tooltip>
            ))}
          </TooltipProvider>
        </div>
      </div>
      <div className="flex justify-between font-mono text-[11px] text-muted-foreground"><span>{fmt(first.t)}</span><span>{pts.length} ранговых матчей · точка ведёт в матч</span><span>{fmt(last.t)}</span></div>
    </div>
  );
}
