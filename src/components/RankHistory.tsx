import { RankBadge } from "@/components/dl";
import type { MatchHistoryEntry } from "@/lib/api";
import { badgeToIdx } from "@/lib/potentialRank";

/** Rank history from the badge recorded on each ranked match in the player's history. */
export function RankHistory({ history }: { history: MatchHistoryEntry[] }) {
  const pts = history
    .filter((m) => (m.ranked_display_badge ?? 0) > 10)
    .sort((a, b) => a.start_time - b.start_time)
    .map((m) => ({ t: m.start_time, badge: m.ranked_display_badge as number, delta: m.ranked_delta ?? null }));

  return (
    <section className="mt-6 border-t border-border pt-5">
      <p className="game-status-plate mb-3 text-primary">История ранга</p>
      {pts.length < 2 ? (
        <p className="text-sm text-muted-foreground">
          {pts.length ? "Пока только один ранговый матч в истории — графику нужно больше." : "В истории нет ранговых матчей с записанным рангом."}
        </p>
      ) : (
        <Chart pts={pts} />
      )}
    </section>
  );
}

function Chart({ pts }: { pts: { t: number; badge: number; delta: number | null }[] }) {
  const W = 800, H = 160, P = 12;
  const idx = pts.map((p) => badgeToIdx(p.badge));
  const lo = Math.min(...idx) - 1, hi = Math.max(...idx) + 1;
  const x = (i: number) => P + (i / (pts.length - 1)) * (W - 2 * P);
  const y = (v: number) => H - P - ((v - lo) / (hi - lo)) * (H - 2 * P);
  const d = idx.map((v, i) => `${i ? "L" : "M"}${x(i)},${y(v)}`).join(" ");
  const first = pts[0]!, last = pts[pts.length - 1]!;
  const peak = pts[idx.indexOf(Math.max(...idx))]!;
  const fmt = (t: number) => new Date(t * 1000).toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-6 text-sm">
        <span className="flex items-center gap-2 text-muted-foreground">Начало <RankBadge badge={first.badge} size={32} /></span>
        <span className="flex items-center gap-2 text-muted-foreground">Пик <RankBadge badge={peak.badge} size={32} /></span>
        <span className="flex items-center gap-2 text-muted-foreground">Сейчас <RankBadge badge={last.badge} size={32} /></span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-40 w-full" preserveAspectRatio="none">
        <path d={d} fill="none" stroke="hsl(var(--primary))" strokeWidth={2} vectorEffect="non-scaling-stroke" className="stroke-primary" />
        {idx.map((v, i) => (
          <circle key={i} cx={x(i)} cy={y(v)} r={3} className="fill-primary">
            <title>{`${fmt(pts[i]!.t)}${pts[i]!.delta != null ? ` · ${pts[i]!.delta! > 0 ? "+" : ""}${pts[i]!.delta}` : ""}`}</title>
          </circle>
        ))}
      </svg>
      <div className="flex justify-between font-mono text-[11px] text-muted-foreground"><span>{fmt(first.t)}</span><span>{pts.length} ранговых матчей</span><span>{fmt(last.t)}</span></div>
    </div>
  );
}
