import { useQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { ExternalLink, Activity, Swords, Users, Crosshair, BookOpen, GitCompare } from "lucide-react";
import { useMemo, useState } from "react";

import { Empty, ErrorBox, useSteamProfiles, useItemMap, HeroIcon, HeroLink, Loading, RankBadge, Stat, WinrateBar, useHeroMap } from "@/components/dl";
import { FollowButton } from "@/components/FollowButton";
import { PotentialRank } from "@/components/PotentialRank";
import { PlayerInsights } from "@/components/PlayerInsights";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api, type MatchHistoryEntry, type PlayerHeroStat } from "@/lib/api";
import { fmtAgo, fmtDuration, fmtHours, fmtInt, fmtK, kda, winrate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { gradeHistory, gradeTone } from "@/lib/grade";
import { globalAvgQuery } from "@/components/PlayerInsights";
import { globalAverages } from "@/lib/playerStats";

export const Route = createFileRoute("/players/$accountId")({
  head: ({ params }) => ({
    meta: [
      { title: `Игрок ${params.accountId} — Deadlock Stats` },
      { name: "description", content: "Профиль игрока Deadlock: ранг, история матчей, герои, тиммейты." },
      { property: "og:title", content: `Игрок ${params.accountId} — Deadlock Stats` },
      { property: "og:description", content: "Ранг, матчи и статистика героев игрока Deadlock." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
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
      <div className="player-dossier relative grid gap-6 border-y border-primary/40 py-7 md:grid-cols-[auto_1fr_auto] md:items-center">
        {profile?.avatarfull ? (
          <div className="gazette-frame w-fit p-2"><img src={profile.avatarfull} alt="" className="h-24 w-24 object-cover" /></div>
        ) : (
          <div className="h-24 w-24 rounded-md bg-muted" />
        )}
        <div className="flex-1">
          <p className="mb-3 font-mono text-[10px] uppercase text-primary">Архив игроков / Досье № {id}</p>
          <h1 className="break-words font-display text-3xl font-semibold sm:text-4xl">{profile?.personaname ?? `Игрок #${id}`}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
            <FollowButton accountId={id} name={profile?.personaname} />
            <Link to="/compare" search={{ a: id }} className="inline-flex items-center gap-1.5 hover:text-primary"><GitCompare className="h-3.5 w-3.5" />Сравнить</Link>
            {profile?.profileurl && (
              <a href={profile.profileurl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-primary">
                Steam <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
        </div>
        <div className="flex flex-col gap-3 border-t border-border pt-4 md:border-l md:border-t-0 md:pl-6 md:pt-0"><p className="font-mono text-[10px] uppercase text-muted-foreground">Классификация</p>
          {rank.data?.badge ? <RankBadge badge={rank.data.badge} size={64} /> : rank.isLoading ? null : <PotentialRank accountId={id} history={history.data ?? []} />}
        </div>
      </div>

      {history.isLoading ? (
        <Loading />
      ) : history.error ? (
        <ErrorBox error={history.error} />
      ) : (
        <div className="grid grid-cols-2 gap-px bg-border md:grid-cols-4">
          <Stat label="Матчей" value={fmtInt(summary.n)} />
          <Stat label="Винрейт" value={`${(winrate(summary.wins, summary.n) * 100).toFixed(1)}%`} tone={summary.wins / Math.max(1, summary.n) >= 0.5 ? "win" : "loss"} sub={`${summary.wins} побед`} />
          <Stat label="KDA" value={kda(summary.k, summary.d, summary.a)} tone="brass" sub={`${(summary.k / Math.max(1, summary.n)).toFixed(1)} / ${(summary.d / Math.max(1, summary.n)).toFixed(1)} / ${(summary.a / Math.max(1, summary.n)).toFixed(1)}`} />
          <Stat label="Последний матч" value={fmtAgo(history.data?.[0]?.start_time)} />
        </div>
      )}

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview"><BookOpen className="h-4 w-4" />Обзор</TabsTrigger>
          <TabsTrigger value="matches"><Activity className="h-4 w-4" />Матчи <span className="font-mono text-[10px] opacity-60">{summary.n}</span></TabsTrigger>
          <TabsTrigger value="heroes"><Swords className="h-4 w-4" />Герои</TabsTrigger>
          <TabsTrigger value="mates"><Users className="h-4 w-4" />Тиммейты</TabsTrigger>
          <TabsTrigger value="enemies"><Crosshair className="h-4 w-4" />Соперники</TabsTrigger>
        </TabsList>
        <TabsContent value="overview" className="mt-4">
          <PlayerInsights history={history.data ?? []} badge={rank.data?.badge} />
        </TabsContent>
        <TabsContent value="matches" className="mt-4">
          <MatchList matches={history.data ?? []} accountId={id} />
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

function streaks(ms: MatchHistoryEntry[]) {
  // ms sorted newest first
  let cur = 0;
  const first = ms[0] ? ms[0].match_result === ms[0].player_team : true;
  for (const m of ms) { if ((m.match_result === m.player_team) === first) cur++; else break; }
  let best = 0, run = 0;
  for (const m of ms) { if (m.match_result === m.player_team) { run++; best = Math.max(best, run); } else run = 0; }
  return { cur, win: first, best };
}

interface RowMeta { match_id: number; players: { account_id: number; hero_id: number; team: string; items?: { item_id: number; sold_time_s: number }[] }[] }

function MatchList({ matches: all, accountId }: { matches: MatchHistoryEntry[]; accountId: number }) {
  const [limit, setLimit] = useState(30);
  const [hero, setHero] = useState<number | "all">("all");
  const [res, setRes] = useState<"all" | "win" | "loss">("all");
  const [mode, setMode] = useState<"all" | "ranked" | "normal" | "brawl">("all");
  const heroes = useHeroMap();
  const gq = useQuery(globalAvgQuery);
  const ga = gq.data ? globalAverages(gq.data) : null;
  const heroIds = useMemo(() => {
    const c = new Map<number, number>();
    all.forEach((m) => c.set(m.hero_id, (c.get(m.hero_id) ?? 0) + 1));
    return [...c.entries()].sort((a, b) => b[1] - a[1]);
  }, [all]);
  const matches = all.filter((m) => {
    const won = m.match_result === m.player_team;
    if (hero !== "all" && m.hero_id !== hero) return false;
    if (res === "win" && !won) return false;
    if (res === "loss" && won) return false;
    if (mode === "brawl" && m.game_mode !== 4) return false;
    if (mode === "ranked" && (m.game_mode === 4 || m.match_mode !== 4)) return false;
    if (mode === "normal" && (m.game_mode === 4 || m.match_mode === 4)) return false;
    return true;
  });
  const st = streaks(all);
  const pageIds = matches.slice(0, limit).map((m) => m.match_id);
  const metaQ = useQuery({
    queryKey: ["match-rows-meta", pageIds.join(",")],
    enabled: pageIds.length > 0,
    staleTime: Infinity,
    retry: false,
    queryFn: async () => {
      const out = new Map<number, RowMeta>();
      for (let i = 0; i < pageIds.length; i += 30) {
        const chunk = pageIds.slice(i, i + 30);
        const r = await api<RowMeta[]>("/v1/matches/metadata", { include_player_info: true, include_player_items: true, match_ids: chunk.join(","), limit: chunk.length });
        r.forEach((x) => out.set(x.match_id, x));
      }
      return out;
    },
  });
  const items = useItemMap();
  if (!all.length) return <Empty>Матчей пока нет</Empty>;
  const chip = (on: boolean) => cn("rounded-full border px-3 py-1 text-xs", on ? "border-primary/60 bg-primary/15 text-primary" : "border-border bg-secondary text-muted-foreground hover:text-foreground");
  return (
    <div className="space-y-2">
      <div className="panel flex flex-wrap items-center gap-3 p-3">
        <span className={cn("rounded-md px-3 py-1 text-sm font-semibold", st.win ? "bg-win/15 text-win" : "bg-loss/15 text-loss")}>
          {st.win ? "🔥" : "❄️"} {st.cur} {st.win ? "побед" : "поражений"} подряд
        </span>
        <span className="text-xs text-muted-foreground">Рекорд: {st.best} побед подряд</span>
        <span className="mx-1 h-5 w-px bg-border" />
        <select value={String(hero)} onChange={(e) => setHero(e.target.value === "all" ? "all" : Number(e.target.value))} className="rounded-md border border-border bg-secondary px-2 py-1 text-xs">
          <option value="all">Все герои</option>
          {heroIds.map(([h, n]) => <option key={h} value={h}>{heroes.get(h)?.name ?? h} ({n})</option>)}
        </select>
        {([["all", "Все"], ["win", "Победы"], ["loss", "Поражения"]] as const).map(([k, l]) => <button key={k} className={chip(res === k)} onClick={() => setRes(k)}>{l}</button>)}
        <span className="mx-1 h-5 w-px bg-border" />
        {([["all", "Все режимы"], ["ranked", "Рейтинговый"], ["normal", "Обычный"], ["brawl", "Street Brawl"]] as const).map(([k, l]) => <button key={k} className={chip(mode === k)} onClick={() => setMode(k)}>{l}</button>)}
      </div>
      {!matches.length && <Empty>Нет матчей под фильтр</Empty>}
      {matches.slice(0, limit).map((m) => {
        const won = m.match_result === m.player_team;
        const g = ga ? gradeHistory(m, ga) : null;
        const k = (m.player_kills + m.player_assists) / Math.max(1, m.player_deaths);
        const badges: string[] = [];
        if (g?.grade === "S+") badges.push("MVP");
        if (m.player_deaths === 0 && m.player_kills + m.player_assists >= 5) badges.push("Неудержимый");
        else if (k >= 6) badges.push("Высокий KDA");
        if (m.match_duration_s && (m.net_worth / (m.match_duration_s / 60)) >= 1500) badges.push("Топ-фарм");
        const meta = metaQ.data?.get(m.match_id);
        const me = meta?.players.find((p) => p.account_id === accountId);
        const build = (me?.items ?? []).filter((it) => !it.sold_time_s && items.get(it.item_id)?.type === "upgrade").map((it) => items.get(it.item_id)!).filter((it, i, a) => a.findIndex((x) => x.id === it.id) === i).slice(-6);
        const myTeam = me?.team;
        const allies = meta?.players.filter((p) => p.team === myTeam) ?? [];
        const foes = meta?.players.filter((p) => p.team !== myTeam) ?? [];
        return (
          <Link
            key={m.match_id}
            to="/matches/$matchId"
            params={{ matchId: String(m.match_id) }}
            className="panel panel-hover grid grid-cols-[4px_auto_1fr_auto] items-center gap-4 overflow-hidden p-3 pl-0 lg:grid-cols-[4px_auto_minmax(140px,1fr)_auto_auto_auto_auto_auto]"
          >
            <span className={cn("h-full", won ? "bg-win" : "bg-loss")} />
            <div className="relative">
              <HeroIcon heroId={m.hero_id} size={48} />
              <span className="absolute -bottom-1 -right-1 rounded-sm border border-border bg-background px-1 font-mono text-[9px]">{m.hero_level}</span>
            </div>
            <div className="min-w-0">
              <p className="flex flex-wrap items-center gap-1.5 font-display font-semibold">
                {heroes.get(m.hero_id)?.name}
                {badges.map((b) => <span key={b} className="rounded-sm border border-primary/40 bg-primary/10 px-1.5 font-mono text-[9px] font-semibold uppercase text-primary">{b}</span>)}
              </p>
              <p className={cn("font-mono text-[10px] uppercase", won ? "text-win" : "text-loss")}>
                {won ? "Победа" : "Поражение"} · <span className="text-muted-foreground">{m.game_mode === 4 ? "Street Brawl" : m.match_mode === 4 ? "Рейтинговый" : "Обычный"} · {fmtAgo(m.start_time)} · {fmtDuration(m.match_duration_s)}</span>
              </p>
            </div>
            <div className="tabular text-right">
              <p className="font-display text-lg font-bold">
                {m.player_kills}<span className="text-muted-foreground">/</span><span className="text-loss">{m.player_deaths}</span><span className="text-muted-foreground">/</span>{m.player_assists}
              </p>
              <p className="font-mono text-[10px] text-muted-foreground">KDA {kda(m.player_kills, m.player_deaths, m.player_assists)} · {fmtK(m.net_worth)} душ</p>
            </div>
            <div className="hidden lg:block">
              {g && <span title={`${g.score.toFixed(0)}/100`} className={cn("inline-grid h-10 w-10 place-items-center border border-primary/40 bg-secondary font-display text-base font-black", gradeTone(g.grade))}>{g.grade}</span>}
            </div>
            <div className="hidden w-[168px] grid-cols-6 gap-0.5 lg:grid">
              {Array.from({ length: 6 }).map((_, i) => {
                const it = build[i];
                return it ? <img key={i} src={it.shop_image_webp ?? it.shop_image ?? it.image_webp ?? it.image} alt={it.name} title={it.name} loading="lazy" className="h-7 w-7 border border-border bg-secondary object-contain" />
                  : <span key={i} className={cn("h-7 w-7 border border-dashed border-border/60", !meta && metaQ.isLoading && "animate-pulse bg-secondary")} />;
              })}
            </div>
            <div className="hidden grid-cols-[auto_auto] gap-x-2 gap-y-0.5 xl:grid">
              {[allies, foes].map((team, ti) => (
                <div key={ti} className="flex gap-0.5">
                  {team.length ? team.map((p) => <HeroIcon key={p.account_id} heroId={p.hero_id} size={20} className={cn(p.account_id === accountId && "ring-1 ring-primary", ti === 1 && "opacity-70")} />)
                    : Array.from({ length: 6 }).map((_, i) => <span key={i} className="h-5 w-5 bg-secondary/60" />)}
                </div>
              ))}
            </div>
            <div className="tabular hidden text-right lg:block">
              <p>{m.last_hits}</p>
              <p className="font-mono text-[10px] text-muted-foreground">#{m.match_id}</p>
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
