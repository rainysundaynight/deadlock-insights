import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { HeroIcon, RankBadge, SectionTitle, useHeroMap } from "@/components/dl";
import { globalAvgQuery } from "@/components/PlayerInsights";
import type { MatchHistoryEntry } from "@/lib/api";
import { globalAverages, playstyle, summarize, won } from "@/lib/playerStats";
import { archetype, mastery, MASTERY } from "@/lib/story";
import { cn } from "@/lib/utils";

const badgeVal = (b: number) => Math.floor(b / 10) * 6 + (b % 10);

/** Playstyle DNA, rank dynamics and hero mastery badges from match history. */
export function PlayerStyle({ history }: { history: MatchHistoryEntry[] }) {
  const heroes = useHeroMap();
  const g = useQuery(globalAvgQuery);
  const recent = history.slice(0, 50);
  const axes = useMemo(() => (g.data && recent.length ? playstyle(summarize(recent), globalAverages(g.data)) : []), [g.data, recent]);
  const arch = axes.length ? archetype(axes) : null;

  const ranked = [...history.slice(0, 30)].reverse().filter((m) => (m.ranked_display_badge ?? 0) > 0);
  const vals = ranked.map((m) => badgeVal(m.ranked_display_badge!));
  const lo = Math.min(...vals), hi = Math.max(...vals);

  const mast = useMemo(() => {
    const by = new Map<number, MatchHistoryEntry[]>();
    for (const m of history) by.set(m.hero_id, [...(by.get(m.hero_id) ?? []), m]);
    return [...by.entries()].map(([id, ms]) => {
      const k = ms.reduce((s, m) => s + m.player_kills + m.player_assists, 0), d = ms.reduce((s, m) => s + m.player_deaths, 0);
      return { id, n: ms.length, ...mastery(ms.length, ms.filter(won).length / ms.length, k / Math.max(1, d)) };
    }).sort((a, b) => b.score - a.score).slice(0, 8);
  }, [history]);

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
              {axes.map((a) => (
                <div key={a.axis} className="grid grid-cols-[90px_1fr_44px] items-center gap-3 text-xs">
                  <span className="text-muted-foreground">{a.axis}</span>
                  <span className="relative h-2 bg-secondary">
                    <span className="absolute inset-y-0 left-1/2 w-px bg-border" />
                    <span className={cn("absolute inset-y-0 left-0", a.v >= 100 ? "bg-primary" : "bg-muted-foreground/60")} style={{ width: `${Math.min(100, a.v / 2)}%` }} />
                  </span>
                  <span className={cn("tabular text-right", a.v >= 115 ? "text-win" : a.v < 85 ? "text-loss" : "")}>{a.v}%</span>
                </div>
              ))}
            </div>
            <p className="mt-2 text-[10px] text-muted-foreground">100% — средний игрок. Архетип выбран по самым выраженным показателям.</p>
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
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {mast.map((h) => (
            <div key={h.id} className="flex items-center gap-3 border border-border bg-card p-3">
              <HeroIcon heroId={h.id} size={44} className={cn(h.level >= 3 && "border-primary")} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{heroes.get(h.id)?.name}</p>
                <p className={cn("font-mono text-[10px] uppercase tracking-wider", h.level >= 3 ? "text-primary" : "text-muted-foreground")}>{"◆".repeat(h.level + 1)} {h.name}</p>
                <div className="mt-1 h-1 bg-secondary"><div className="h-full bg-primary" style={{ width: `${h.score}%` }} /></div>
                <p className="mt-0.5 text-[10px] text-muted-foreground">{h.n} игр · {h.score}/100</p>
              </div>
            </div>
          ))}
        </div>
        <p className="mt-2 text-[10px] text-muted-foreground">Уровень учитывает число игр, винрейт и KDA на герое в загруженной истории.</p>
      </section>
    </div>
  );
}
