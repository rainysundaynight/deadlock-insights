import { PlayerStyle } from "@/components/PlayerStyle";
import { HeroProgressPanel } from "@/components/HeroProgressPanel";
import { HeroFigure } from "@/components/HeroFigure";
import { Button } from "@/components/ui/button";
import { MatchHeroPose } from "@/components/MatchHeroPose";
import { GameItem } from "@/components/GameItem";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { Link, createFileRoute } from "@tanstack/react-router";
import { ExternalLink, Package, RefreshCw, Activity, Swords, Users, Crosshair, BookOpen, GitCompare } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { Empty, ErrorBox, useSteamProfiles, useItemMap, HeroIcon, HeroLink, Loading, RankBadge, Stat, WinrateBar, useHeroMap } from "@/components/dl";
import { FollowButton } from "@/components/FollowButton";
import { PlayerShareCard } from "@/components/PlayerShareCard";
import { PotentialRank } from "@/components/PotentialRank";
import { PlayerItems } from "@/components/PlayerItems";
import { PlayerInsights } from "@/components/PlayerInsights";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api, type MatchHistoryEntry, type PlayerHeroStat } from "@/lib/api";
import { fmtAgo, fmtDuration, fmtHours, fmtInt, fmtK, kda, winrate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { gradeHistory, gradeTone } from "@/lib/grade";
import { globalAvgQuery } from "@/components/PlayerInsights";
import { globalAverages } from "@/lib/playerStats";

export const Route = createFileRoute("/players/$accountId")({
  head: () => ({
    meta: [
      { title: "Профиль игрока — Deadlock Stats" },
      { name: "description", content: "Профиль игрока Deadlock: ранг, история матчей, герои, тиммейты." },
      { property: "og:title", content: "Профиль игрока — Deadlock Stats" },
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
  useEffect(() => {
    document.title = `${profile?.personaname || "Профиль игрока"} — Deadlock Stats`;
  }, [profile?.personaname, id]);
  const rank = useQuery({ queryKey: ["rank", id], queryFn: () => api<RankResp>(`/v1/players/${id}/rank`) });
  const history = useQuery({
    queryKey: ["history", id],
    queryFn: () => api<MatchHistoryEntry[]>(`/v1/players/${id}/match-history`),
    refetchInterval: 120_000,
    refetchOnWindowFocus: true,
  });
  const qc = useQueryClient();
  const [refetching, setRefetching] = useState(false);
  const forceRefresh = async () => {
    const key = `dl-force-refetch-${id}`;
    const last = Number(localStorage.getItem(key) ?? 0);
    const left = 3600_000 - (Date.now() - last);
    if (left > 0) { toast.info(`Steam позволяет принудительно обновлять раз в час. Попробуйте через ${Math.ceil(left / 60000)} мин.`); return; }
    setRefetching(true);
    try {
      const fresh = await api<MatchHistoryEntry[]>(`/v1/players/${id}/match-history`, { force_refetch: true });
      localStorage.setItem(key, String(Date.now()));
      setLastForce(Date.now());
      pendingSrc.current = "steam";
      const before = history.data?.length ?? 0;
      qc.setQueryData(["history", id], fresh);
      const added = fresh.length - before;
      if (added <= 0) toast.success("Новых матчей нет — история актуальна");
    } catch {
      toast.error("Steam временно не отдаёт историю (лимит запросов). Попробуйте позже.");
    } finally { setRefetching(false); }
  };

  // ---- sources, new-match alerts, refresh status ----
  const srcKey = `dl-src-${id}`;
  const [sources, setSources] = useState<Record<number, "steam" | "archive">>({});
  const pendingSrc = useRef<"steam" | "archive">("archive");
  const seen = useRef<Set<number> | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [tab, setTab] = useState("overview");
  useEffect(() => {
    try { const t = sessionStorage.getItem(`dl-profile-tab-${id}`); setTab(t ?? "overview"); } catch { /* ignore */ }
  }, [id]);
  const [lastForce, setLastForce] = useState(0);
  useEffect(() => {
    try { setSources(JSON.parse(localStorage.getItem(srcKey) ?? "{}")); } catch { /* ignore */ }
    setLastForce(Number(localStorage.getItem(`dl-force-refetch-${id}`) ?? 0));
    seen.current = null;
    const t = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(t);
  }, [id, srcKey]);
  useEffect(() => {
    const list = history.data;
    if (!list) return;
    const ids = list.map((m) => m.match_id);
    if (seen.current) {
      const fresh = list.filter((m) => !seen.current!.has(m.match_id));
      if (fresh.length) {
        const src = pendingSrc.current;
        setSources((prev) => {
          const next = { ...prev };
          fresh.forEach((m) => { next[m.match_id] = src; });
          localStorage.setItem(srcKey, JSON.stringify(next));
          return next;
        });
        const name = profile?.personaname ?? `#${id}`;
        const text = `${name}: ${fresh.length === 1 ? "новый матч" : `новых матчей — ${fresh.length}`}`;
        toast.success(text, { description: src === "steam" ? "Получено напрямую из Steam" : "Появилось в архиве" });
        if (typeof Notification !== "undefined" && Notification.permission === "granted" && document.hidden) new Notification("The Deadlock", { body: text });
      }
    }
    seen.current = new Set(ids);
    pendingSrc.current = "archive";
  }, [history.data, id, srcKey, profile?.personaname]);
  const cooldownLeft = Math.max(0, 3600_000 - (now - lastForce));

  const summary = useMemo(() => {
    const h = history.data ?? [];
    const wins = h.filter((m) => m.match_result === m.player_team).length;
    const k = h.reduce((s, m) => s + m.player_kills, 0);
    const d = h.reduce((s, m) => s + m.player_deaths, 0);
    const a = h.reduce((s, m) => s + m.player_assists, 0);
    return { n: h.length, wins, k, d, a };
  }, [history.data]);
  const heroes = useHeroMap();
  const featuredHero = useMemo(() => {
    const counts = new Map<number, number>();
    (history.data ?? []).slice(0, 30).forEach((m) => counts.set(m.hero_id, (counts.get(m.hero_id) ?? 0) + 1));
    const heroId = [...counts].sort((a, b) => b[1] - a[1])[0]?.[0];
    return heroId === undefined ? undefined : heroes.get(heroId);
  }, [history.data, heroes]);

  return (
    <div className="space-y-8">
      <DossierBackdrop history={history.data ?? []} />
      <div className="player-dossier dossier-heading relative -mt-8 border-y border-primary/40 py-7">
        <div className="dossier-heading-copy grid gap-6 md:grid-cols-[auto_minmax(0,1fr)] md:items-center">
        {profile?.avatarfull ? (
          <div className="dossier-avatar gazette-frame w-fit p-2"><img src={profile.avatarfull} alt="" className="h-24 w-24 object-cover" /></div>
        ) : (
          <div className="dossier-avatar h-24 w-24 bg-muted" />
        )}
        <div className="flex-1">
          <p className="game-status-plate mb-3 text-primary">Архив игроков / Досье № {id}</p>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="break-words font-display text-4xl font-black tracking-tight sm:text-5xl">{profile?.personaname ?? `Игрок #${id}`}</h1>
            {rank.data?.badge ? <RankBadge badge={rank.data.badge} size={44} showName={false} /> : rank.isLoading ? null : <PotentialRank accountId={id} history={history.data ?? []} compact />}
          </div>
          <div className="mt-3 flex gap-1" aria-label="Форма за последние матчи">
            {(history.data ?? []).slice(0, 15).reverse().map((m, i) => (
              <motion.span key={m.match_id} initial={{ scaleY: 0 }} animate={{ scaleY: 1 }} transition={{ delay: i * 0.03 }} title={m.match_result === m.player_team ? "Победа" : "Поражение"} className={cn("h-4 w-2 origin-bottom", m.match_result === m.player_team ? "bg-win" : "bg-loss/70")} />
            ))}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
            <FollowButton accountId={id} name={profile?.personaname} />
            <Button variant="ghost" size="sm" onClick={forceRefresh} disabled={refetching} title="Запросить свежую историю напрямую из Steam" className="h-auto p-0 text-muted-foreground hover:text-primary"><RefreshCw className={cn("h-3.5 w-3.5", refetching && "animate-spin")} />{refetching ? "Обновляем…" : "Обновить матчи"}</Button>
            <PlayerShareCard accountId={id} name={profile?.personaname ?? `Игрок #${id}`} history={history.data ?? []} hero={featuredHero} />
            <Link to="/compare" search={{ a: id }} className="inline-flex items-center gap-1.5 hover:text-primary"><GitCompare className="h-3.5 w-3.5" />Сравнить</Link>
            {profile?.profileurl && (
              <a href={profile.profileurl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-primary">
                Steam <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
        </div>
        </div>
        </div>
        <HeroFigure hero={featuredHero} className="profile-hero-portrait" />
      </div>

      {history.isLoading ? (
        <Loading />
      ) : history.error ? (
        <ErrorBox error={history.error} />
      ) : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat variant="game" label="Матчей" value={fmtInt(summary.n)} />
          <Stat variant="game" label="Винрейт" value={`${(winrate(summary.wins, summary.n) * 100).toFixed(1)}%`} tone={summary.wins / Math.max(1, summary.n) >= 0.5 ? "win" : "loss"} sub={`${summary.wins} побед`} />
          <Stat variant="game" label="KDA" value={kda(summary.k, summary.d, summary.a)} tone="brass" sub={`${(summary.k / Math.max(1, summary.n)).toFixed(1)} / ${(summary.d / Math.max(1, summary.n)).toFixed(1)} / ${(summary.a / Math.max(1, summary.n)).toFixed(1)}`} />
          <Stat variant="game" label="Последний матч" value={fmtAgo(history.data?.[0]?.start_time)} />
        </div>
      )}

      <div className="refresh-ledger profile-game-ledger grid gap-4 border-y border-border py-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="bg-card px-4 py-3">
          <p className="game-status-plate text-primary">Статус</p>
          <p className="mt-1 flex items-center gap-2 text-sm">
            <span className={cn("h-2 w-2 rounded-full", history.isFetching || refetching ? "animate-pulse bg-primary" : history.isError ? "bg-loss" : "bg-win")} />
            {refetching ? "Запрос в Steam…" : history.isFetching ? "Проверяем архив…" : history.isError ? "Ошибка загрузки" : "История актуальна"}
          </p>
        </div>
        <div className="bg-card px-4 py-3">
          <p className="game-status-plate text-primary">Последняя проверка</p>
          <p className="tabular mt-1 text-sm">{history.dataUpdatedAt ? `${Math.max(0, Math.round((now - history.dataUpdatedAt) / 60000))} мин назад` : "—"} <span className="text-muted-foreground">· авто каждые 2 мин</span></p>
        </div>
        <div className="bg-card px-4 py-3">
          <p className="game-status-plate text-primary">Обновление из Steam</p>
          <p className={cn("tabular mt-1 text-sm", cooldownLeft ? "text-muted-foreground" : "text-win")}>{cooldownLeft ? `через ${Math.ceil(cooldownLeft / 60000)} мин` : "доступно сейчас"}</p>
          <div className="mt-1.5 h-0.5 bg-secondary"><div className="h-full bg-primary transition-all" style={{ width: `${100 - (cooldownLeft / 3600_000) * 100}%` }} /></div>
        </div>
        <div className="bg-card px-4 py-3">
          <p className="game-status-plate text-primary">Последний матч</p>
          <p className="mt-1 text-sm">{history.data?.[0] ? fmtAgo(history.data[0].start_time) : "—"} {history.data?.[0] && <SourceTag src={sources[history.data[0].match_id]} />}</p>
        </div>
      </div>

      <Tabs value={tab} onValueChange={(v) => { setTab(v); try { sessionStorage.setItem(`dl-profile-tab-${id}`, v); } catch { /* ignore */ } }}>
        <TabsList>
          <TabsTrigger value="overview"><BookOpen className="h-4 w-4" />Обзор</TabsTrigger>
          <TabsTrigger value="matches"><Activity className="h-4 w-4" />Матчи <span className="font-mono text-[10px] opacity-60">{summary.n}</span></TabsTrigger>
          <TabsTrigger value="heroes"><Swords className="h-4 w-4" />Герои</TabsTrigger>
          <TabsTrigger value="items"><Package className="h-4 w-4" />Предметы</TabsTrigger>
          <TabsTrigger value="mates"><Users className="h-4 w-4" />Тиммейты</TabsTrigger>
          <TabsTrigger value="enemies"><Crosshair className="h-4 w-4" />Соперники</TabsTrigger>
        </TabsList>
        <TabsContent value="overview" className="mt-4">
          <PlayerInsights history={history.data ?? []} badge={rank.data?.badge} backTo={`/players/${id}`} />
          <PlayerStyle history={history.data ?? []} accountId={id} />
        </TabsContent>
        <TabsContent value="matches" className="mt-4">
          <MatchList matches={history.data ?? []} accountId={id} sources={sources} />
        </TabsContent>
        <TabsContent value="heroes" className="mt-4">
          <HeroProgressPanel history={history.data ?? []} />
          <PlayerHeroes id={id} />
        </TabsContent>
        <TabsContent value="items" className="mt-4">
          <PlayerItems id={id} history={history.data ?? []} />
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

function DossierBackdrop({ history }: { history: MatchHistoryEntry[] }) {
  const heroes = useHeroMap();
  const top = useMemo(() => {
    const c = new Map<number, number>();
    history.slice(0, 30).forEach((m) => c.set(m.hero_id, (c.get(m.hero_id) ?? 0) + 1));
    return [...c.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  }, [history]);
  const img = top ? heroes.get(top)?.images.background_image_webp ?? heroes.get(top)?.images.icon_hero_card_webp : undefined;
  return (
    <div aria-hidden className="pointer-events-none relative h-8">
      {img && (
        <motion.div initial={{ opacity: 0, scale: 1.05 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 1 }} className="dossier-backdrop absolute inset-x-0 top-0 h-[320px] bg-cover bg-center" style={{ backgroundImage: `url(${img})` }} />
      )}
    </div>
  );
}

function SourceTag({ src }: { src?: "steam" | "archive" | undefined }) {
  return src === "steam"
    ? <span title="Матч получен напрямую из Steam" className="ml-1 rounded-sm border border-primary/50 bg-primary/10 px-1 font-mono text-[9px] uppercase text-primary">Steam</span>
    : <span title="Матч из архива Deadlock API" className="ml-1 rounded-sm border border-border px-1 font-mono text-[9px] uppercase text-muted-foreground">Архив</span>;
}

function MatchList({ matches: all, accountId, sources }: { matches: MatchHistoryEntry[]; accountId: number; sources: Record<number, "steam" | "archive"> }) {
  const [limit, setLimit] = useState(30);
  const [hero, setHero] = useState<number | "all">("all");
  const [res, setRes] = useState<"all" | "win" | "loss">("all");
  const [mode, setMode] = useState<"all" | "ranked" | "normal" | "brawl">("all");
  const [period, setPeriod] = useState<"all" | "7" | "30" | "90" | "custom">("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
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
    if (period !== "all") {
      if (period === "custom") {
        if (dateFrom && m.start_time < new Date(`${dateFrom}T00:00:00`).getTime() / 1000) return false;
        if (dateTo && m.start_time > new Date(`${dateTo}T23:59:59`).getTime() / 1000) return false;
      } else if (m.start_time < Date.now() / 1000 - Number(period) * 86400) return false;
    }
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
        <span className="mx-1 h-5 w-px bg-border" />
        {([["all", "Всё время"], ["7", "7 дней"], ["30", "30 дней"], ["90", "90 дней"], ["custom", "Период"]] as const).map(([k, l]) => <button key={k} className={chip(period === k)} onClick={() => setPeriod(k)}>{l}</button>)}
        {period === "custom" && (
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="rounded-md border border-border bg-secondary px-2 py-1 text-xs text-foreground" />
            —
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="rounded-md border border-border bg-secondary px-2 py-1 text-xs text-foreground" />
          </span>
        )}
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
            search={{ from: `/players/${accountId}` }}
            className="match-history-row panel panel-hover grid grid-cols-[4px_auto_minmax(0,1fr)] items-center gap-x-3 gap-y-1 overflow-hidden p-3 pl-0 lg:grid-cols-[4px_auto_minmax(140px,1fr)_auto_auto_auto_auto_auto]"
          >
            <span className={cn("row-span-2 h-full lg:row-span-1", won ? "bg-win" : "bg-loss")} />
            <div className="row-span-2 lg:row-span-1"><MatchHeroPose hero={heroes.get(m.hero_id)} won={won} level={m.hero_level} /></div>
            <div className="min-w-0">
              <p className="flex flex-wrap items-center gap-1.5 font-display font-semibold">
                {heroes.get(m.hero_id)?.name}
                {badges.map((b) => <span key={b} className="game-status-plate text-primary">{b}</span>)}
              </p>
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                <span className={cn("game-status-plate", won ? "text-win" : "text-loss")}>{won ? "Победа" : "Поражение"}</span>
                <span className="game-status-plate text-muted-foreground">{m.game_mode === 4 ? "Street Brawl" : m.match_mode === 4 ? "Рейтинговый" : "Обычный"}</span>
              </div>
              <p className="mt-1.5 font-mono text-[10px] text-muted-foreground">{fmtAgo(m.start_time)} · {fmtDuration(m.match_duration_s)}<SourceTag src={sources[m.match_id]} /></p>
            </div>
            <div className="tabular col-start-3 text-left lg:col-start-auto lg:text-right">
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
                return it ? <GameItem key={i} item={it} size={28} variant="image" />
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
  const max = rows[0]?.matches_played ?? 1;
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {rows.map((r, i) => {
        const wr = winrate(r.wins, r.matches_played) * 100;
        return (
          <Link key={r.hero_id} to="/heroes/$heroId" params={{ heroId: String(r.hero_id) }} className="panel panel-hover group relative overflow-hidden p-4">
            <span className="absolute right-3 top-2 font-display text-3xl font-black text-primary/15">{String(i + 1).padStart(2, "0")}</span>
            <div className="flex items-center gap-3">
              <HeroIcon heroId={r.hero_id} size={52} />
              <div className="min-w-0">
                <HeroName id={r.hero_id} />
                <p className="font-mono text-[10px] uppercase text-muted-foreground">{fmtHours(r.time_played)} · {fmtAgo(r.last_played)}</p>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2 border-t border-border pt-3 text-center">
              <div><p className={cn("tabular font-display text-lg font-bold", wr >= 50 ? "text-win" : "text-loss")}>{wr.toFixed(0)}%</p><p className="font-mono text-[9px] uppercase text-muted-foreground">винрейт</p></div>
              <div><p className="tabular font-display text-lg font-bold">{kda(r.kills, r.deaths, r.assists)}</p><p className="font-mono text-[9px] uppercase text-muted-foreground">KDA</p></div>
              <div><p className="tabular font-display text-lg font-bold">{fmtInt(r.networth_per_min)}</p><p className="font-mono text-[9px] uppercase text-muted-foreground">душ/мин</p></div>
            </div>
            <div className="mt-3">
              <div className="mb-1 flex justify-between font-mono text-[10px] text-muted-foreground"><span>{r.matches_played} матчей</span><span>{r.wins}W · {r.matches_played - r.wins}L</span></div>
              <div className="h-1 bg-secondary"><div className="h-full bg-primary" style={{ width: `${(r.matches_played / max) * 100}%` }} /></div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}

function HeroName({ id }: { id: number }) {
  const heroes = useHeroMap();
  return <p className="truncate font-display text-lg font-bold">{heroes.get(id)?.name ?? id}</p>;
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
          <Link key={pid} to="/players/$accountId" params={{ accountId: String(pid) }} className="panel panel-hover grid grid-cols-[auto_1fr_auto] items-center gap-4 p-3">
            {p?.avatar ? <img src={p.avatar} alt="" className="h-11 w-11 border border-primary/40" /> : <div className="h-11 w-11 border border-border bg-muted" />}
            <div className="min-w-0">
              <p className="truncate font-display font-bold">{p?.personaname ?? `#${pid}`}</p>
              <p className="font-mono text-[10px] uppercase text-muted-foreground">{r.matches_played} {kind === "mate" ? "вместе" : "против"} · {r.wins}W / {r.matches_played - r.wins}L</p>
              <div className="mt-1.5 h-1 bg-secondary"><div className={cn("h-full", winrate(r.wins, r.matches_played) >= 0.5 ? "bg-win" : "bg-loss")} style={{ width: `${winrate(r.wins, r.matches_played) * 100}%` }} /></div>
            </div>
            <p className={cn("tabular font-display text-xl font-black", winrate(r.wins, r.matches_played) >= 0.5 ? "text-win" : "text-loss")}>{(winrate(r.wins, r.matches_played) * 100).toFixed(0)}%</p>
          </Link>
        );
      })}
    </div>
  );
}
