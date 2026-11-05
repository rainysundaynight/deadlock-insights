import { useQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { Copy, Heart } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Empty, ErrorBox, HeroIcon, HeroSelect, Loading, PageHeader, inputClass, selectClass, useHeroMap, useItemMap } from "@/components/dl";
import { GameItem } from "@/components/GameItem";
import { api } from "@/lib/api";
import { fmtAgo, fmtK } from "@/lib/format";

export interface BuildEntry {
  hero_build: {
    hero_id: number;
    hero_build_id: number;
    author_account_id: number;
    last_updated_timestamp: number;
    name: string;
    description: string;
    version: number;
    details: { mod_categories: { name: string; mods: { ability_id: number }[] }[] };
  };
  num_favorites: number;
  num_weekly_favorites?: number | null;
}

export const Route = createFileRoute("/builds")({
  validateSearch: (s: Record<string, unknown>): { hero?: number | undefined } => ({ hero: s["hero"] ? Number(s["hero"]) : undefined }),
  head: () => ({
    meta: [
      { title: "Билды Deadlock — популярные сборки героев" },
      { name: "description", content: "Ищите самые популярные билды героев Deadlock по названию и герою." },
      { property: "og:title", content: "Билды Deadlock" },
      { property: "og:description", content: "Популярные сборки героев Deadlock." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: BuildsPage,
});

function BuildsPage() {
  const search = Route.useSearch();
  const [hero, setHero] = useState<number | null>(search.hero ?? null);
  const [sort, setSort] = useState("favorites");
  const [q, setQ] = useState("");
  const [dq, setDq] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDq(q), 400);
    return () => clearTimeout(t);
  }, [q]);

  const builds = useQuery({
    queryKey: ["builds", hero, sort, dq],
    queryFn: () => api<BuildEntry[]>("/v1/builds", { hero_id: hero ?? undefined, sort_by: sort, search_name: dq || undefined, limit: 30, only_latest: true }),
  });

  return (
    <div>
      <PageHeader eyebrow="Сообщество" title="Билды">Сборки из игрового редактора. Скопируйте ID билда, чтобы найти его в игре.</PageHeader>
      <div className="mb-6 flex flex-wrap gap-2">
        <div className="min-w-60 flex-1"><input className={inputClass} placeholder="Поиск по названию" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <HeroSelect value={hero} onChange={setHero} />
        <select className={selectClass} value={sort} onChange={(e) => setSort(e.target.value)}>
          <option value="favorites">Популярные</option>
          <option value="weekly_favorites">Популярные за неделю</option>
          <option value="updated_at">Недавно обновлённые</option>
          <option value="published_at">Новые</option>
        </select>
      </div>
      {builds.isLoading ? <Loading /> : builds.error ? <ErrorBox error={builds.error} /> : !builds.data?.length ? <Empty>Ничего не найдено</Empty> : (
        <div className="grid gap-4 lg:grid-cols-2">
          {builds.data.map((b) => <BuildCard key={b.hero_build.hero_build_id} b={b} />)}
        </div>
      )}
    </div>
  );
}

function BuildCard({ b }: { b: BuildEntry }) {
  const items = useItemMap();
  const heroes = useHeroMap();
  const h = b.hero_build;
  return (
    <div className="panel panel-hover p-5">
      <div className="flex items-start gap-3">
        <Link to="/heroes/$heroId" params={{ heroId: String(h.hero_id) }}><HeroIcon heroId={h.hero_id} size={48} /></Link>
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-lg">{h.name}</p>
          <p className="text-xs text-muted-foreground">
            {heroes.get(h.hero_id)?.name} · обновлён {fmtAgo(h.last_updated_timestamp)} ·{" "}
            <Link to="/players/$accountId" params={{ accountId: String(h.author_account_id) }} className="hover:text-primary">автор</Link>
          </p>
        </div>
        <span className="inline-flex items-center gap-1 text-sm text-primary"><Heart className="h-4 w-4" />{fmtK(b.num_favorites)}</span>
      </div>
      {h.description && <p className="mt-3 line-clamp-2 whitespace-pre-line text-sm text-muted-foreground">{h.description}</p>}
      <div className="mt-4 space-y-2">
        {h.details.mod_categories.slice(0, 4).map((c, i) => {
          const mods = c.mods.map((m) => items.get(m.ability_id)).filter(Boolean);
          if (!mods.length) return null;
          return (
            <div key={i} className="flex items-center gap-3">
              <span className="w-24 shrink-0 truncate text-xs uppercase tracking-wider text-muted-foreground">{c.name}</span>
              <div className="flex flex-wrap gap-1">
                {mods.map((it, j) => (
                  <GameItem key={j} item={it!} size={56} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
      <button
        onClick={() => {
          navigator.clipboard.writeText(String(h.hero_build_id));
          toast.success("ID билда скопирован");
        }}
        className="mt-4 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary"
      >
        <Copy className="h-3 w-3" /> ID {h.hero_build_id}
      </button>
    </div>
  );
}
