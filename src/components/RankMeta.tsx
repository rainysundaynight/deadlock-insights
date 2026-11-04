import { useQueries, useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";

import { HeroIcon, Loading, rankParams } from "@/components/dl";
import { api, ranksQuery, type HeroAnalytics } from "@/lib/api";
import { fmtInt } from "@/lib/format";
import { cn } from "@/lib/utils";

const TIERS = Array.from({ length: 12 }, (_, i) => i);

/** Hero stats for every rank tier over the last `days` days (one request per tier, cached 1h). */
export function useHeroStatsByRank(days = 14) {
  const since = Math.floor(Date.now() / 1000 / 86400) * 86400 - days * 86400;
  const qs = useQueries({
    queries: TIERS.map((t) => ({
      queryKey: ["hero-stats-rank", t, since],
      queryFn: () => api<HeroAnalytics[]>("/v1/analytics/hero-stats", { min_unix_timestamp: since, ...rankParams(t) }),
      staleTime: 3600_000,
    })),
  });
  return { loading: qs.some((q) => q.isLoading), byTier: TIERS.map((t, i) => ({ tier: t, rows: qs[i]?.data ?? [] })) };
}

function useRankInfo() {
  const { data } = useQuery(ranksQuery);
  return (t: number) => {
    const r = data?.find((x) => x.tier === t);
    return { name: r?.name ?? `Tier ${t}`, color: r?.color, icon: r?.images.large_webp ?? r?.images.large };
  };
}

/** For one hero: win rate in each rank tier. */
export function HeroRankWinrates({ heroId }: { heroId: number }) {
  const { loading, byTier } = useHeroStatsByRank(30);
  const info = useRankInfo();
  if (loading) return <Loading />;
  const rows = byTier
    .map(({ tier, rows }) => {
      const h = rows.find((r) => r.hero_id === heroId);
      return h && h.matches >= 50 ? { tier, wr: h.wins / h.matches, n: h.matches } : null;
    })
    .filter(Boolean) as { tier: number; wr: number; n: number }[];
  if (!rows.length) return <p className="text-sm text-muted-foreground">Недостаточно данных.</p>;
  const best = rows.reduce((a, b) => (b.wr > a.wr ? b : a));
  const lo = Math.min(...rows.map((r) => r.wr)), hi = Math.max(...rows.map((r) => r.wr));
  return (
    <div className="panel p-4">
      <p className="mb-4 text-sm text-muted-foreground">
        Лучше всего побеждает в <span className="font-semibold" style={{ color: info(best.tier).color }}>{info(best.tier).name}</span> — {(best.wr * 100).toFixed(1)}%
      </p>
      <div className="flex h-48 items-end gap-2">
        {rows.map((r) => {
          const i = info(r.tier);
          const h = 15 + ((r.wr - lo) / Math.max(0.001, hi - lo)) * 85;
          return (
            <div key={r.tier} className="flex flex-1 flex-col items-center gap-1" title={`${i.name}: ${(r.wr * 100).toFixed(1)}% · ${fmtInt(r.n)} матчей`}>
              <span className={cn("tabular text-xs font-semibold", r.wr >= 0.5 ? "text-win" : "text-loss")}>{(r.wr * 100).toFixed(1)}</span>
              <div className="w-full rounded-t-md" style={{ height: `${h}%`, background: i.color ?? "var(--primary)", opacity: r.tier === best.tier ? 1 : 0.55 }} />
              {i.icon && <img src={i.icon} alt={i.name} className="h-8 w-8 object-contain" />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Top heroes by win rate in every rank tier. */
export function RankMetaGrid() {
  const { loading, byTier } = useHeroStatsByRank(14);
  const info = useRankInfo();
  if (loading) return <Loading />;
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {byTier.map(({ tier, rows }) => {
        const total = rows.reduce((s, r) => s + r.matches, 0);
        const top = rows
          .filter((r) => r.matches >= Math.max(30, total * 0.004))
          .map((r) => ({ id: r.hero_id, wr: r.wins / r.matches }))
          .sort((a, b) => b.wr - a.wr)
          .slice(0, 5);
        const i = info(tier);
        return (
          <div key={tier} className="panel p-3">
            <div className="mb-2 flex items-center gap-2">
              {i.icon && <img src={i.icon} alt="" className="h-7 w-7 object-contain" />}
              <span className="font-display text-sm font-semibold uppercase" style={{ color: i.color }}>{i.name}</span>
            </div>
            {!top.length ? <p className="text-xs text-muted-foreground">Нет данных</p> : (
              <div className="space-y-1">
                {top.map((h, k) => (
                  <Link key={h.id} to="/heroes/$heroId" params={{ heroId: String(h.id) }} className="flex items-center gap-2 rounded p-1 hover:bg-accent">
                    <span className="w-3 text-xs text-muted-foreground">{k + 1}</span>
                    <HeroIcon heroId={h.id} size={24} withName />
                    <span className="tabular ml-auto text-xs font-semibold text-win">{(h.wr * 100).toFixed(1)}%</span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
