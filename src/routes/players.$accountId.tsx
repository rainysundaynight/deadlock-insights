import { useQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { ExternalLink } from "lucide-react";
import { useMemo, useState } from "react";

import { Empty, ErrorBox, useSteamProfiles, HeroIcon, HeroLink, Loading, RankBadge, Stat, WinrateBar, useHeroMap } from "@/components/dl";
import { PlayerInsights } from "@/components/PlayerInsights";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api, type MatchHistoryEntry, type PlayerHeroStat } from "@/lib/api";
import { fmtAgo, fmtDuration, fmtHours, fmtInt, fmtK, kda, winrate } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/players/$accountId")({
  head: ({ params }) => ({
    meta: [
      { title: `Игрок ${params.accountId} — Deadlock Stats` },
      { name: "description", content: "Профиль игрока Deadlock: ранг, история матчей, герои, тиммейты." },
      { property: "og:title", content: `Игрок ${params.accountId} — Deadlock Stats` },
      { property: "og:description", content: "Ранг, матчи и статистика героев игрока Deadlock." },
    ],
  }),
  component: PlayerPage,
});

interface RankResp { badge: number | null }
interface MateStat { mate_id?: number; enemy_id?: number; wins: number; matches_played: number }

function PlayerPage() {
  const { accountId } = Route.useParams();
  const id = Number(accountId);
  const profiles = useSteamProfiles([id]);
  const profile = profiles.data?.get(id);
  const rank = useQuery({ queryKey: ["rank", id], queryFn: () => api<RankResp>(`/v1/players/${id}/rank`) });
  const history = useQuery({ queryKey: ["history", id], queryFn: () => api<MatchHistoryEntry[]>(`/v1/players/${id}/match-history`) });

  const summary = useMemo(() => {
    const h = history.data ?? [];
    const wins = h.filter((m) => m.match_result === m.player_team).length;
    const k = h.reduce((s, m) => s + m.player_kills, 0);
    const d = h.reduce((s, m) => s + m.player_deaths, 0);
    const a = h.reduce((s, m) => s + m.player_assists, 0);
    return { n: h.length, wins, k, d, a };
  }, [history.data]);

  return (
    <div className="space-y-8">
      <div className="panel flex flex-col gap-6 p-6 md:flex-row md:items-center">
        {profile?.avatarfull ? (
          <img src={profile.avatarfull} alt="" className="h-24 w-24 rounded-md border border-primary/40" />
        ) : (
          <div className="h-24 w-24 rounded-md bg-muted" />
        )}
        <div className="flex-1">
          <p className="text-xs uppercase tracking-[0.3em] text-primary">Профиль игрока</p>
          <h1 className="font-display text-4xl font-semibold">{profile?.personaname ?? `Игрок #${id}`}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
            <span>ID {id}</span>
            <Link to="/compare" search={{ a: id }} className="hover:text-primary">Сравнить →</Link>
            {profile?.profileurl && (
              <a href={profile.profileurl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-primary">
                Steam <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
        </div>
        <div className="md:text-right">
          <RankBadge badge={rank.data?.badge} size={64} />
        </div>
      </div>

      {history.isLoading ? (
        <Loading />
      ) : history.error ? (
        <ErrorBox error={history.error} />
      ) : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="Матчей" value={fmtInt(summary.n)} />
          <Stat label="Винрейт" value={`${(winrate(summary.wins, summary.n) * 100).toFixed(1)}%`} tone={summary.wins / Math.max(1, summary.n) >= 0.5 ? "win" : "loss"} sub={`${summary.wins} побед`} />
          <Stat label="KDA" value={kda(summary.k, summary.d, summary.a)} tone="brass" sub={`${(summary.k / Math.max(1, summary.n)).toFixed(1)} / ${(summary.d / Math.max(1, summary.n)).toFixed(1)} / ${(summary.a / Math.max(1, summary.n)).toFixed(1)}`} />
          <Stat label="Последний матч" value={fmtAgo(history.data?.[0]?.start_time)} />
        </div>
      )}

      <Tabs defaultValue="overview">
        <TabsList className="bg-secondary">
          <TabsTrigger value="overview">Обзор</TabsTrigger>
          <TabsTrigger value="matches">Матчи</TabsTrigger>
          <TabsTrigger value="heroes">Герои</TabsTrigger>
          <TabsTrigger value="mates">Тиммейты</TabsTrigger>
          <TabsTrigger value="enemies">Соперники</TabsTrigger>
        </TabsList>
        <TabsContent value="overview" className="mt-4">
          <PlayerInsights history={history.data ?? []} />
        </TabsContent>
        <TabsContent value="matches" className="mt-4">
          <MatchList matches={history.data ?? []} />
        </TabsContent>
        <TabsContent value="heroes" className="mt-4">
          <PlayerHeroes id={id} />
        </TabsContent>
        <TabsContent value="mates" className="mt-4">
          <People id={id} kind="mate" />
        </TabsContent>
        <TabsContent value="enemies" className="mt-4">
          <People id={id} kind="enemy" />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function MatchList({ matches }: { matches: MatchHistoryEntry[] }) {
  const [limit, setLimit] = useState(30);
  const heroes = useHeroMap();
  if (!matches.length) return <Empty>Матчей пока нет</Empty>;
  return (
    <div className="space-y-2">
      {matches.slice(0, limit).map((m) => {
        const won = m.match_result === m.player_team;
        return (
          <Link
            key={m.match_id}
            to="/matches/$matchId"
            params={{ matchId: String(m.match_id) }}
            className={cn("panel panel-hover grid grid-cols-[4px_auto_1fr_auto] items-center gap-4 overflow-hidden p-3 pl-0 md:grid-cols-[4px_auto_1fr_repeat(4,auto)]")}
          >
            <span className={cn("h-full", won ? "bg-win" : "bg-loss")} />
            <HeroIcon heroId={m.hero_id} size={44} />
            <div>
              <p className="font-medium">{heroes.get(m.hero_id)?.name}</p>
              <p className={cn("text-xs", won ? "text-win" : "text-loss")}>
                {won ? "Победа" : "Поражение"} · <span className="text-muted-foreground">{fmtAgo(m.start_time)}</span>
              </p>
            </div>
            <div className="tabular text-right">
              <p>
                {m.player_kills}/<span className="text-loss">{m.player_deaths}</span>/{m.player_assists}
              </p>
              <p className="text-xs text-muted-foreground">KDA {kda(m.player_kills, m.player_deaths, m.player_assists)}</p>
            </div>
            <div className="tabular hidden text-right md:block">
              <p className="text-primary">{fmtK(m.net_worth)}</p>
              <p className="text-xs text-muted-foreground">души</p>
            </div>
            <div className="tabular hidden text-right md:block">
              <p>{m.last_hits}</p>
              <p className="text-xs text-muted-foreground">крипов</p>
            </div>
            <div className="tabular hidden text-right md:block">
              <p>{fmtDuration(m.match_duration_s)}</p>
              <p className="text-xs text-muted-foreground">#{m.match_id}</p>
            </div>
          </Link>
        );
      })}
      {limit < matches.length && (
        <button onClick={() => setLimit(limit + 30)} className="w-full rounded-md border border-border py-3 text-sm text-muted-foreground hover:border-primary hover:text-primary">
          Показать ещё ({matches.length - limit})
        </button>
      )}
    </div>
  );
}

function PlayerHeroes({ id }: { id: number }) {
  const q = useQuery({ queryKey: ["player-hero-stats", id], queryFn: () => api<PlayerHeroStat[]>("/v1/players/hero-stats", { account_ids: id }) });
  if (q.isLoading) return <Loading />;
  if (q.error) return <ErrorBox error={q.error} />;
  const rows = [...(q.data ?? [])].sort((a, b) => b.matches_played - a.matches_played);
  if (!rows.length) return <Empty>Нет данных по героям</Empty>;
  return (
    <div className="panel overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-left text-xs uppercase tracking-wider text-muted-foreground">
          <tr className="border-b border-border">
            <th className="p-3">Герой</th><th className="p-3">Матчи</th><th className="p-3">Винрейт</th><th className="p-3">KDA</th><th className="p-3">Душ/мин</th><th className="p-3">Время</th><th className="p-3">Последний</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.hero_id} className="border-b border-border/50 last:border-0 hover:bg-accent/40">
              <td className="p-3"><HeroLink heroId={r.hero_id} size={32} /></td>
              <td className="tabular p-3">{r.matches_played}</td>
              <td className="p-3"><WinrateBar value={winrate(r.wins, r.matches_played)} /></td>
              <td className="tabular p-3">{kda(r.kills, r.deaths, r.assists)}</td>
              <td className="tabular p-3">{fmtInt(r.networth_per_min)}</td>
              <td className="tabular p-3">{fmtHours(r.time_played)}</td>
              <td className="p-3 text-muted-foreground">{fmtAgo(r.last_played)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function People({ id, kind }: { id: number; kind: "mate" | "enemy" }) {
  const q = useQuery({
    queryKey: [kind, id],
    queryFn: () => api<MateStat[]>(`/v1/players/${id}/${kind}-stats`, { min_matches_played: kind === "mate" ? 2 : 3 }),
  });
  const rows = useMemo(() => [...(q.data ?? [])].sort((a, b) => b.matches_played - a.matches_played).slice(0, 50), [q.data]);
  const ids = rows.map((r) => (r.mate_id ?? r.enemy_id)!);
  const profiles = useSteamProfiles(ids);
  if (q.isLoading) return <Loading />;
  if (q.error) return <ErrorBox error={q.error} />;
  if (!rows.length) return <Empty>Нет данных</Empty>;
  return (
    <div className="grid gap-2 md:grid-cols-2">
      {rows.map((r) => {
        const pid = (r.mate_id ?? r.enemy_id)!;
        const p = profiles.data?.get(pid);
        return (
          <Link key={pid} to="/players/$accountId" params={{ accountId: String(pid) }} className="panel panel-hover flex items-center gap-3 p-3">
            {p?.avatar ? <img src={p.avatar} alt="" className="h-9 w-9 rounded" /> : <div className="h-9 w-9 rounded bg-muted" />}
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{p?.personaname ?? `#${pid}`}</p>
              <p className="text-xs text-muted-foreground">{r.matches_played} совместных матчей</p>
            </div>
            <WinrateBar value={winrate(r.wins, r.matches_played)} />
          </Link>
        );
      })}
    </div>
  );
}
