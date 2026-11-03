import { useQuery } from "@tanstack/react-query";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";

import { Chip, Empty, ErrorBox, HeroIcon, HeroSelect, Loading, PageHeader, RankBadge, inputClass } from "@/components/dl";
import { api, type SteamProfile } from "@/lib/api";
import { REGIONS } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/leaderboard")({
  validateSearch: (s: Record<string, unknown>): { hero?: number | undefined } => ({ hero: s["hero"] ? Number(s["hero"]) : undefined }),
  head: () => ({
    meta: [
      { title: "Лидерборд Deadlock — лучшие игроки по регионам" },
      { name: "description", content: "Официальный лидерборд Deadlock по регионам и героям." },
      { property: "og:title", content: "Лидерборд Deadlock" },
      { property: "og:description", content: "Топ игроков Deadlock по регионам и героям." },
    ],
  }),
  component: LeaderboardPage,
});

interface Entry { account_name: string; possible_account_ids: number[]; rank: number; top_hero_ids: number[]; badge_level?: number }

function LeaderboardPage() {
  const search = Route.useSearch();
  const [region, setRegion] = useState<string>("Europe");
  const [hero, setHero] = useState<number | null>(search.hero ?? null);
  const [filter, setFilter] = useState("");
  const q = useQuery({
    queryKey: ["leaderboard", region, hero],
    queryFn: () => api<{ entries: Entry[] }>(hero ? `/v1/leaderboard/${region}/${hero}` : `/v1/leaderboard/${region}`),
  });
  const rows = useMemo(
    () => (q.data?.entries ?? []).filter((e) => !filter || e.account_name.toLowerCase().includes(filter.toLowerCase())).slice(0, 500),
    [q.data, filter],
  );

  return (
    <div>
      <PageHeader eyebrow="Рейтинг" title="Лидерборд">Официальный внутриигровой рейтинг лучших игроков.</PageHeader>
      <div className="mb-6 flex flex-wrap items-center gap-2">
        {REGIONS.map((r) => (
          <Chip key={r.id} active={region === r.id} onClick={() => setRegion(r.id)}>{r.label}</Chip>
        ))}
        <span className="ml-auto flex gap-2">
          <HeroSelect value={hero} onChange={setHero} />
          <input className={cn(inputClass, "w-48")} placeholder="Фильтр по нику" value={filter} onChange={(e) => setFilter(e.target.value)} />
        </span>
      </div>
      {q.isLoading ? <Loading /> : q.error ? <ErrorBox error={q.error} /> : !rows.length ? <Empty>Пусто</Empty> : (
        <div className="panel divide-y divide-border/50">
          {rows.map((e) => {
            const pid = e.possible_account_ids.length === 1 ? e.possible_account_ids[0] : null;
            const name = <span className="truncate font-medium">{e.account_name}</span>;
            return (
              <div key={`${e.rank}-${e.account_name}`} className="flex items-center gap-4 px-4 py-3 hover:bg-accent/30">
                <span className={cn("tabular w-12 font-display text-xl", e.rank <= 3 ? "text-brass" : "text-muted-foreground")}>{e.rank}</span>
                <div className="min-w-0 flex-1">
                  {pid ? <Link to="/players/$accountId" params={{ accountId: String(pid) }} className="hover:text-primary">{name}</Link> : <ResolveName name={e.account_name} ids={e.possible_account_ids} />}
                </div>
                {e.badge_level != null && <RankBadge badge={e.badge_level} size={28} showName={false} />}
                <div className="flex gap-1">
                  {e.top_hero_ids.slice(0, 3).map((h) => <HeroIcon key={h} heroId={h} size={28} />)}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ResolveName({ name, ids }: { name: string; ids: number[] }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [cands, setCands] = useState<SteamProfile[] | null>(null);
  const go = (id: number) => navigate({ to: "/players/$accountId", params: { accountId: String(id) } });
  const resolve = async () => {
    if (cands) return setOpen((o) => !o);
    setBusy(true);
    try {
      const list = await api<SteamProfile[]>("/v1/players/steam", { account_ids: ids.slice(0, 50).join(",") });
      const exact = list.filter((p) => p.personaname.trim().toLowerCase() === name.trim().toLowerCase());
      if (exact.length === 1) return go(exact[0]!.account_id);
      setCands(exact.length ? exact : list); setOpen(true);
    } catch { setCands([]); setOpen(true); } finally { setBusy(false); }
  };
  return (
    <span className="relative">
      <button onClick={resolve} className="truncate font-medium hover:text-primary">{name}{busy && <span className="ml-2 text-xs text-muted-foreground">ищем…</span>}</button>
      {open && cands && (
        <span className="absolute left-0 top-7 z-20 w-72 rounded-lg border border-border bg-popover p-2 shadow-lg">
          <span className="mb-1 block text-xs text-muted-foreground">Несколько аккаунтов с таким ником — выберите:</span>
          {cands.map((c) => (
            <button key={c.account_id} onClick={() => go(c.account_id)} className="flex w-full items-center gap-2 rounded-md p-1.5 text-left text-sm hover:bg-accent">
              {c.avatar && <img src={c.avatar} alt="" className="h-6 w-6 rounded" />}<span className="truncate">{c.personaname}</span><span className="ml-auto text-xs text-muted-foreground">#{c.account_id}</span>
            </button>
          ))}
          {!cands.length && <span className="block p-1.5 text-sm text-muted-foreground">Профиль не найден.</span>}
        </span>
      )}
    </span>
  );
}
