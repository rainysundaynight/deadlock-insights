import { useQuery } from "@tanstack/react-query";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { X } from "lucide-react";
import { PolarAngleAxis, PolarGrid, Radar, RadarChart, ResponsiveContainer, Legend } from "recharts";
import { useMemo } from "react";

import { globalAvgQuery } from "@/components/PlayerInsights";
import { PlayerSearch } from "@/components/PlayerSearch";
import { HeroIcon, Loading, PageHeader, RankBadge, SectionTitle, useSteamProfiles } from "@/components/dl";
import { api, type MatchHistoryEntry } from "@/lib/api";
import { fmtDuration, fmtK, kda } from "@/lib/format";
import { globalAverages, playstyle, summarize, type PlayerSummary } from "@/lib/playerStats";
import { cn } from "@/lib/utils";

interface Search { a?: number | undefined; b?: number | undefined }

export const Route = createFileRoute("/compare")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    a: s["a"] ? Number(s["a"]) : undefined,
    b: s["b"] ? Number(s["b"]) : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Сравнение игроков Deadlock — Deadlock Stats" },
      { name: "description", content: "Сравните двух игроков Deadlock: ранг, винрейт, KDA, фарм, стиль игры и любимых героев." },
      { property: "og:title", content: "Сравнение игроков Deadlock" },
      { property: "og:description", content: "Два профиля Deadlock бок о бок." },
    ],
  }),
  component: ComparePage,
});

function usePlayer(id?: number) {
  const history = useQuery({ queryKey: ["history", id], queryFn: () => api<MatchHistoryEntry[]>(`/v1/players/${id}/match-history`), enabled: !!id });
  const rank = useQuery({ queryKey: ["rank", id], queryFn: () => api<{ badge: number | null }>(`/v1/players/${id}/rank`), enabled: !!id });
  const s = useMemo(() => (history.data ? summarize(history.data.slice(0, 100)) : null), [history.data]);
  return { s, rank: rank.data?.badge, loading: history.isLoading && !!id };
}

function ComparePage() {
  const { a, b } = Route.useSearch();
  const navigate = useNavigate({ from: "/compare" });
  const pa = usePlayer(a);
  const pb = usePlayer(b);
  const profiles = useSteamProfiles([a, b].filter(Boolean) as number[]);
  const g = useQuery(globalAvgQuery);

  const radar = useMemo(() => {
    if (!g.data || !pa.s || !pb.s) return [];
    const avg = globalAverages(g.data);
    const ra = playstyle(pa.s, avg), rb = playstyle(pb.s, avg);
    return ra.map((x, i) => ({ axis: x.axis, A: x.v, B: rb[i]!.v }));
  }, [g.data, pa.s, pb.s]);

  const slot = (key: "a" | "b", id: number | undefined, p: ReturnType<typeof usePlayer>) => (
    <div className={cn("panel p-5", key === "a" ? "border-t-2 border-t-amber-team" : "border-t-2 border-t-sapphire-team")}>
      {!id ? (
        <PlayerSearch placeholder={`Игрок ${key === "a" ? "1" : "2"}: ник или Steam ID`} onPick={(x) => navigate({ search: (s: Search) => ({ ...s, [key]: x.account_id }) })} />
      ) : (
        <div className="flex items-center gap-4">
          {profiles.data?.get(id)?.avatarmedium ? <img src={profiles.data.get(id)!.avatarmedium} alt="" className="h-14 w-14 rounded-lg" /> : <div className="h-14 w-14 rounded-lg bg-muted" />}
          <div className="min-w-0 flex-1">
            <Link to="/players/$accountId" params={{ accountId: String(id) }} className="block truncate font-display text-lg font-semibold hover:text-primary">{profiles.data?.get(id)?.personaname ?? `#${id}`}</Link>
            <RankBadge badge={p.rank} size={28} />
          </div>
          <button aria-label="Убрать" onClick={() => navigate({ search: (s: Search) => ({ ...s, [key]: undefined }) })} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
        </div>
      )}
    </div>
  );

  return (
    <div>
      <PageHeader eyebrow="Инструменты" title="Сравнение игроков">Выберите двух игроков — сравним последние 100 матчей.</PageHeader>
      <div className="grid gap-4 md:grid-cols-2">
        {slot("a", a, pa)}
        {slot("b", b, pb)}
      </div>
      {(pa.loading || pb.loading) && <Loading />}
      {pa.s && pb.s && (
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <section className="panel p-5">
            <SectionTitle>Показатели</SectionTitle>
            <CompareRows a={pa.s} b={pb.s} />
          </section>
          <section className="panel p-5">
            <SectionTitle>Стиль игры</SectionTitle>
            <div className="h-80">
              <ResponsiveContainer>
                <RadarChart data={radar} outerRadius="70%">
                  <PolarGrid stroke="var(--border)" />
                  <PolarAngleAxis dataKey="axis" tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} />
                  <Radar name={profiles.data?.get(a!)?.personaname ?? "Игрок 1"} dataKey="A" stroke="var(--team-amber)" fill="var(--team-amber)" fillOpacity={0.25} />
                  <Radar name={profiles.data?.get(b!)?.personaname ?? "Игрок 2"} dataKey="B" stroke="var(--team-sapphire)" fill="var(--team-sapphire)" fillOpacity={0.25} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </section>
          <section className="panel p-5 lg:col-span-2">
            <SectionTitle>Любимые герои</SectionTitle>
            <div className="grid gap-6 md:grid-cols-2">
              {[pa.s, pb.s].map((s, i) => (
                <div key={i} className="flex flex-wrap gap-3">
                  {s.heroes.slice(0, 6).map((h) => (
                    <div key={h.hero_id} className="text-center">
                      <HeroIcon heroId={h.hero_id} size={52} className="rounded-xl" />
                      <p className="tabular mt-1 text-xs">{h.n} · <span className={h.wins / h.n >= 0.5 ? "text-win" : "text-loss"}>{Math.round((h.wins / h.n) * 100)}%</span></p>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function CompareRows({ a, b }: { a: PlayerSummary; b: PlayerSummary }) {
  const rows: [string, number, number, (v: number) => string, boolean?][] = [
    ["Винрейт", a.winrate * 100, b.winrate * 100, (v) => `${v.toFixed(1)}%`],
    ["KDA", (a.k + a.a) / Math.max(1, a.d), (b.k + b.a) / Math.max(1, b.d), (v) => v.toFixed(2)],
    ["Убийства", a.k, b.k, (v) => v.toFixed(1)],
    ["Смерти", a.d, b.d, (v) => v.toFixed(1), true],
    ["Помощь", a.a, b.a, (v) => v.toFixed(1)],
    ["Души", a.nw, b.nw, (v) => fmtK(v)],
    ["Крипы", a.lh, b.lh, (v) => v.toFixed(0)],
    ["Длительность", a.dur, b.dur, (v) => fmtDuration(v)],
    ["Лучшая серия", a.bestStreak, b.bestStreak, (v) => String(v)],
  ];
  return (
    <div className="space-y-3">
      {rows.map(([label, va, vb, f, lowerBetter]) => {
        const aw = lowerBetter ? va < vb : va > vb;
        const bw = lowerBetter ? vb < va : vb > va;
        const share = va + vb ? (va / (va + vb)) * 100 : 50;
        return (
          <div key={label}>
            <div className="flex items-center justify-between text-sm">
              <span className={cn("tabular", aw ? "font-semibold text-amber-team" : "text-muted-foreground")}>{f(va)}</span>
              <span className="text-xs uppercase tracking-wider text-muted-foreground">{label}</span>
              <span className={cn("tabular", bw ? "font-semibold text-sapphire-team" : "text-muted-foreground")}>{f(vb)}</span>
            </div>
            <div className="mt-1 flex h-1.5 overflow-hidden rounded-full bg-muted">
              <div className="bg-amber-team" style={{ width: `${share}%` }} />
              <div className="flex-1 bg-sapphire-team" />
            </div>
          </div>
        );
      })}
      <p className="pt-2 text-xs text-muted-foreground">Средние за матч. KDA = (убийства + помощь) / смерти: {kda(a.k, a.d, a.a)} против {kda(b.k, b.d, b.a)}.</p>
    </div>
  );
}
