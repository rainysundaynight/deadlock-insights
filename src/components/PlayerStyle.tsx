import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { HeroIcon, RankBadge, SectionTitle, useHeroMap } from "@/components/dl";
import { globalAvgQuery } from "@/components/PlayerInsights";
import { api, type MatchHistoryEntry, type PlayerHeroStat } from "@/lib/api";
import { deviationFromAverage, globalAverages, playstyle, summarize, won } from "@/lib/playerStats";
import { archetype, mastery, MASTERY } from "@/lib/story";
import { cn } from "@/lib/utils";

const badgeVal = (b: number) => Math.floor(b / 10) * 6 + (b % 10);

/** Playstyle DNA, rank dynamics and hero mastery badges from match history. */
export function PlayerStyle({ history, accountId }: { history: MatchHistoryEntry[]; accountId: number }) {
  const heroes = useHeroMap();
  const g = useQuery(globalAvgQuery);
  const heroStats = useQuery({ queryKey: ["player-hero-stats", accountId], queryFn: () => api<PlayerHeroStat[]>("/v1/players/hero-stats", { account_ids: accountId }) });
  const recent = history.slice(0, 50);
  const axes = useMemo(() => (g.data && recent.length ? playstyle(summarize(recent), globalAverages(g.data)) : []), [g.data, recent]);
  const arch = axes.length ? archetype(axes) : null;

  const ranked = [...history.slice(0, 30)].reverse().filter((m) => (m.ranked_display_badge ?? 0) > 0);
  const vals = ranked.map((m) => badgeVal(m.ranked_display_badge!));
  const lo = Math.min(...vals), hi = Math.max(...vals);

  const mast = useMemo(() => {
    return (heroStats.data ?? []).filter((h) => h.matches_played > 0).map((h) => {
      const wr = h.wins / h.matches_played;
      return { id: h.hero_id, n: h.matches_played, wr, ...mastery(h.matches_played, wr) };
    }).sort((a, b) => b.level - a.level || b.n - a.n || b.wr - a.wr).slice(0, 8);
  }, [heroStats.data]);

  if (!history.length) return null;
  return (
    <div className="mt-8 grid gap-6 lg:grid-cols-2">
      <section className="panel p-5">
        <SectionTitle right={<span className="text-xs text-muted-foreground">последние {recent.length} матчей против среднего</span>}>ДНК стиля</SectionTitle>
        {arch ? (
          <>
            <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-primary">Архетип</p>
            <p className="font-display text-3xl font-black uppercase">{arch.main.name}</p>
            <p className="text-sm text-muted-foreground">{arch.main.text}. Вторая черта — {arch.second.name.toLowerCase()}.</p>
            <div className="mt-4 space-y-2">
              <div className="grid grid-cols-[90px_minmax(0,1fr)_52px] items-center gap-3 text-[9px] text-muted-foreground"><span /><span className="text-center">┆ Средний игрок</span><span className="text-right">Разница</span></div>
              {axes.map((a) => (
                <div key={a.axis} className="grid grid-cols-[90px_minmax(0,1fr)_52px] items-center gap-3 text-xs">
                  <span className="text-muted-foreground">{a.axis}</span>
                  <span className="relative h-2 bg-secondary">
                    <span title="Средний игрок: 100%" className="absolute -inset-y-1 left-1/2 z-10 border-l border-dashed border-foreground/80" />
                    <span className={cn("absolute inset-y-0 left-0", a.v >= 100 ? "bg-primary" : "bg-muted-foreground/60")} style={{ width: `${Math.min(100, a.v / 2)}%` }} />
                  </span>
                  <span className={cn("tabular text-right", a.v >= 115 ? "text-win" : a.v < 85 ? "text-loss" : "")}>{a.v > 100 ? "+" : ""}{deviationFromAverage(a.v)}%</span>
                </div>
              ))}
            </div>
          </>
        ) : <p className="text-sm text-muted-foreground">Загружаем средние значения…</p>}
      </section>

      <section className="panel p-5">
        <SectionTitle right={<span className="text-xs text-muted-foreground">ранговые из последних 30</span>}>Динамика ранга</SectionTitle>
        {ranked.length < 2 ? <p className="text-sm text-muted-foreground">Недостаточно ранговых матчей с рангом.</p> : (
          <>
            <div className="flex items-center justify-between">
              <RankBadge badge={ranked[0]!.ranked_display_badge} size={36} />
              <span className={cn("tabular font-display text-2xl font-bold", vals.at(-1)! >= vals[0]! ? "text-win" : "text-loss")}>{vals.at(-1)! - vals[0]! >= 0 ? "+" : ""}{vals.at(-1)! - vals[0]!} дел.</span>
              <RankBadge badge={ranked.at(-1)!.ranked_display_badge} size={36} />
            </div>
            <svg viewBox="0 0 300 90" className="mt-3 h-28 w-full" preserveAspectRatio="none">
              <polyline fill="none" className="stroke-primary" strokeWidth="2" vectorEffect="non-scaling-stroke"
                points={vals.map((v, i) => `${(i / (vals.length - 1)) * 300},${85 - ((v - lo) / Math.max(1, hi - lo)) * 75}`).join(" ")} />
              {ranked.map((m, i) => <circle key={m.match_id} cx={(i / (vals.length - 1)) * 300} cy={85 - ((vals[i]! - lo) / Math.max(1, hi - lo)) * 75} r="2.5" className={won(m) ? "fill-win" : "fill-loss"} />)}
            </svg>
            <div className="mt-2 flex flex-wrap gap-1">
              {ranked.map((m, i) => {
                const d = i ? vals[i]! - vals[i - 1]! : 0;
                return <span key={m.match_id} className={cn("tabular border px-1 font-mono text-[9px]", d > 0 ? "border-win/50 text-win" : d < 0 ? "border-loss/50 text-loss" : "border-border text-muted-foreground")}>{d > 0 ? `+${d}` : d}</span>;
              })}
            </div>
            <p className="mt-2 text-[10px] text-muted-foreground">Деления: шаг между подрангами I–VI. Точки — победы и поражения.</p>
          </>
        )}
      </section>

      <section className="panel p-5 lg:col-span-2">
        <SectionTitle right={<span className="text-xs text-muted-foreground">{MASTERY.join(" → ")}</span>}>Мастерство героев</SectionTitle>
        {heroStats.isPending && <p className="text-sm text-muted-foreground">Загружаем опыт на героях…</p>}
        {heroStats.isError && <p className="text-sm text-muted-foreground">Статистика героев недоступна. Мастерство не рассчитано.</p>}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {mast.map((h) => (
            <div key={h.id} className="flex items-center gap-3 border border-border bg-card p-3">
              <HeroIcon heroId={h.id} size={44} className={cn(h.level >= 3 && "border-primary")} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{heroes.get(h.id)?.name}</p>
                <p className={cn("font-mono text-[10px] uppercase tracking-wider", h.level >= 3 ? "text-primary" : "text-muted-foreground")}>{"◆".repeat(h.level + 1)} {h.name}</p>
                <div title={h.next ? `К следующему уровню: ${h.next.games} игр и ${Math.round(h.next.winrate * 100)}% побед` : "Высший уровень"} className="mt-1 h-1 bg-secondary"><div className="h-full bg-primary" style={{ width: `${h.score}%` }} /></div>
                <p className="mt-0.5 text-[10px] text-muted-foreground">{h.n} игр · {(h.wr * 100).toFixed(1)}% побед</p>
                {h.next && <p className="mt-1 text-[9px] text-muted-foreground">Следующий: {h.next.games} игр · ≥{Math.round(h.next.winrate * 100)}%</p>}
              </div>
            </div>
          ))}
        </div>
        <p className="mt-2 text-[10px] text-muted-foreground">Гранд-мастер: от 150 игр и 55% побед. Легенда: от 300 игр и 60% побед. По статистике героев API.</p>
      </section>
    </div>
  );
}
