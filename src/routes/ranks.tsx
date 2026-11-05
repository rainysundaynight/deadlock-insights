import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { ErrorBox, Loading, PageHeader, SectionTitle } from "@/components/dl";
import { api, ranksQuery } from "@/lib/api";
import { fmtInt, splitBadge } from "@/lib/format";

export const Route = createFileRoute("/ranks")({
  head: () => ({
    meta: [
      { title: "Ранги Deadlock — распределение игроков" },
      { name: "description", content: "Все ранги Deadlock и распределение игроков по ним." },
      { property: "og:title", content: "Ранги Deadlock" },
      { property: "og:description", content: "Распределение игроков Deadlock по рангам." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: RanksPage,
});

interface Dist { badge_level: number; total_matches: number; unique_players?: number }

function RanksPage() {
  const ranks = useQuery(ranksQuery);
  const dist = useQuery({
    queryKey: ["badge-dist"],
    queryFn: () => api<Dist[]>("/v1/analytics/badge-distribution", { min_unix_timestamp: Math.floor(Date.now() / 1000 / 3600) * 3600 - 30 * 86400 }),
  });

  const byTier = useMemo(() => {
    const m = new Map<number, number>();
    (dist.data ?? []).forEach((d) => {
      const b = splitBadge(d.badge_level);
      if (b) m.set(b.tier, (m.get(b.tier) ?? 0) + (d.unique_players ?? d.total_matches));
    });
    return m;
  }, [dist.data]);
  const total = [...byTier.values()].reduce((a, b) => a + b, 0) || 1;

  const chart = useMemo(
    () =>
      (dist.data ?? []).map((d) => {
        const b = splitBadge(d.badge_level);
        const r = ranks.data?.find((x) => x.tier === b?.tier);
        return { name: `${r?.name ?? ""} ${b?.subrank ?? ""}`, value: d.unique_players ?? d.total_matches, color: r?.color ?? "#888" };
      }),
    [dist.data, ranks.data],
  );

  return (
    <div className="space-y-10">
      <PageHeader eyebrow="Рейтинговая система" title="Ранги">Распределение игроков по рангам за последние 30 дней.</PageHeader>
      {ranks.isLoading ? <Loading /> : ranks.error ? <ErrorBox error={ranks.error} /> : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          {ranks.data!.filter((r) => r.tier > 0).map((r) => (
            <div key={r.tier} className="panel flex flex-col items-center p-4 text-center">
              <img src={r.images.large_webp ?? r.images.large} alt={r.name} className="h-20 w-20 object-contain" />
              <p className="mt-2 font-display uppercase" style={{ color: r.color }}>{r.name}</p>
              <p className="tabular text-xs text-muted-foreground">{((byTier.get(r.tier) ?? 0) / total * 100).toFixed(1)}%</p>
            </div>
          ))}
        </div>
      )}
      <section className="panel p-4">
        <SectionTitle>Распределение по подрангам</SectionTitle>
        {dist.isLoading ? <Loading /> : dist.error ? <ErrorBox error={dist.error} /> : (
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chart}>
                <XAxis dataKey="name" hide />
                <YAxis tickFormatter={(v) => fmtInt(v)} stroke="var(--muted-foreground)" fontSize={11} width={70} />
                <Tooltip
                  cursor={{ fill: "var(--accent)" }}
                  contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 6 }}
                  formatter={(v: number) => [fmtInt(v), "Игроков"]}
                />
                <Bar dataKey="value" radius={[3, 3, 0, 0]}>
                  {chart.map((c, i) => <Cell key={i} fill={c.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>
    </div>
  );
}
