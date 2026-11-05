import { useQuery } from "@tanstack/react-query";
import { GameItem } from "@/components/GameItem";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";

import { ErrorBox, HeroIcon, Loading, PlayerRank, RankBadge, Stat, useHeroMap, useItemMap, useSteamProfiles } from "@/components/dl";
import { api } from "@/lib/api";
import { fmtDate, fmtDuration, fmtK, GAME_MODES, MATCH_MODES } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";
import { MatchHero } from "@/components/MatchHero";
import { MatchAnalysis } from "@/components/MatchAnalysis";
import { LaneDuelBoard, PlayerDossier } from "@/components/PlayerDossier";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { DamageView, ItemsTimeline } from "@/components/MatchDeep";
import { LaneMinutes } from "@/components/LaneMinutes";
import { explainVsGlobal, gradeVsGlobal, gradeTone } from "@/lib/grade";
import { globalAvgQuery } from "@/components/PlayerInsights";
import { globalAverages } from "@/lib/playerStats";
import { LiveScoreboard } from "@/components/LiveScoreboard";
import { MatchDetails } from "@/components/MatchDetails";
import { MatchReplay, type MatchObjective, type MatchPaths } from "@/components/MatchReplay";
import { MatchActions, SpectateButton } from "@/components/ShareCard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart3, Coins, Map, Swords, Crosshair, Package, Lightbulb, UserRound, Newspaper } from "lucide-react";
import { MatchStory } from "@/components/MatchStory";

export const Route = createFileRoute("/matches/$matchId")({
  validateSearch: (s: Record<string, unknown>): { from?: string | undefined } => ({
    from: typeof s["from"] === "string" && s["from"].startsWith("/") ? s["from"] : undefined,
  }),
  head: ({ params }) => ({
    meta: [
      { title: `Матч ${params.matchId} — Deadlock Stats` },
      { name: "description", content: "Полный разбор матча Deadlock: составы, KDA, души, урон и предметы." },
      { property: "og:title", content: `Матч ${params.matchId} — Deadlock Stats` },
      { property: "og:description", content: "Таблица результатов и предметы игроков матча Deadlock." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MatchPage,
});

interface MatchPlayer {
  account_id: number;
  team: number;
  hero_id: number;
  kills: number;
  deaths: number;
  assists: number;
  net_worth: number;
  last_hits: number;
  denies: number;
  level: number;
  player_slot: number;
  death_details?: { game_time_s: number; death_pos: { x: number; y: number } }[];
  assigned_lane: number;
  items: { game_time_s: number; item_id: number; sold_time_s: number }[];
  stats: import("@/lib/analysis").StatSnap[];
}
interface MatchMeta {
  match_info: {
    match_id: number;
    duration_s: number;
    start_time: number;
    winning_team: number;
    game_mode: number;
    match_mode: number;
    average_badge_team0?: number;
    average_badge_team1?: number;
    match_paths?: MatchPaths;
    objectives?: MatchObjective[];
    mid_boss?: { team_killed: number; destroyed_time_s: number }[];
    players: MatchPlayer[];
  };
}

const TEAMS = ["Hidden King", "Archmother"];

function MatchPage() {
  const { matchId } = Route.useParams();
  const { from } = Route.useSearch();
  const navigate = useNavigate();
  const [backPath, setBackPath] = useState<string | null>(null);
  useEffect(() => {
    try { setBackPath(window.sessionStorage.getItem("dl-prev-path")); } catch { /* storage unavailable */ }
  }, []);
  const q = useQuery({ queryKey: ["match", matchId], queryFn: () => api<MatchMeta>(`/v1/matches/${matchId}/metadata`), staleTime: Infinity, retry: false });
  const live = useQuery({
    queryKey: ["active"],
    queryFn: () => api<LiveMatch[]>("/v1/matches/active"),
    enabled: !!q.error,
    refetchInterval: 60_000,
    select: (d) => d.find((x) => String(x.match_id) === matchId),
  });
  const players = q.data?.match_info.players ?? [];
  const profiles = useSteamProfiles(players.map((p) => p.account_id));
  const [tab, setTab] = useState("table");

  if (q.isLoading) return <Loading label="Загружаем матч…" />;
  if (q.error) {
    if (live.isLoading) return <Loading label="Проверяем, идёт ли матч сейчас…" />;
    if (live.data) return <LiveView m={live.data} />;
    return <ErrorBox error={new Error("Данные матча пока недоступны. Если матч только что закончился, попробуйте через несколько минут.")} />;
  }
  if (!q.data) return null;
  const m = q.data.match_info;

  return (
    <div className="space-y-8">
      {(() => {
        const back = from ?? (backPath && backPath !== `/matches/${matchId}` ? backPath : null);
        const cls = "group inline-flex items-center gap-2 border border-border bg-card px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider text-muted-foreground transition-colors hover:border-primary/60 hover:text-primary";
        return back
          ? <button onClick={() => void navigate({ to: back })} className={cls}><span className="transition-transform group-hover:-translate-x-0.5">←</span> Назад</button>
          : <Link to="/" className={cls}><span className="transition-transform group-hover:-translate-x-0.5">←</span> На главную</Link>;
      })()}
      <MatchHero m={m} players={players} names={profiles.data} />
      <MatchActions matchId={m.match_id} players={players} winner={m.winning_team} duration={m.duration_s} names={profiles.data} />
      <Tabs value={tab} onValueChange={setTab}>
      <TabsList>
        {([["table", "Таблица", BarChart3], ["story", "Разбор", Newspaper], ["player", "Игрок", UserRound], ["details", "Экономика", Coins], ["map", "Карта", Map], ["lanes", "Линии и график", Swords], ["damage", "Урон", Crosshair], ["items", "Предметы", Package], ["tips", "Советы", Lightbulb]] as const).map(([k, l, Icon]) => (
          <TabsTrigger key={k} value={k}><Icon className="h-4 w-4" />{l}</TabsTrigger>
        ))}
      </TabsList><TabsContent key={tab} value={tab} className="mt-6">
      {tab === "story" && <MatchStory players={players} names={profiles.data} durationS={m.duration_s} winner={m.winning_team} midBoss={m.mid_boss} />}
      {tab === "map" && <MatchReplay paths={m.match_paths} players={players} names={profiles.data} objectives={m.objectives} midBoss={m.mid_boss} />}
      {tab === "details" && <MatchDetails players={players} names={profiles.data} durationS={m.duration_s} />}
      {tab === "damage" && <DamageView players={players} names={profiles.data} />}
      {tab === "items" && <ItemsTimeline players={players} names={profiles.data} />}
      {(tab === "lanes" || tab === "tips") && <MatchAnalysis view={tab} players={players} durationS={m.duration_s} names={profiles.data} objectives={m.objectives} midBoss={m.mid_boss} winner={m.winning_team} />}
      {tab === "player" && <PlayerDossier players={players} names={profiles.data} durationS={m.duration_s} winner={m.winning_team} />}
      {tab === "lanes" && <div className="my-8"><LaneDuelBoard players={players} names={profiles.data} durationS={m.duration_s} /></div>}
      {tab === "lanes" && <LaneMinutes players={players} names={profiles.data} />}
      {tab === "table" && [0, 1].map((team) => (
        <TeamTable
          lobby={players}
          winner={m.winning_team}
          durationS={m.duration_s}
          key={team}
          team={team}
          won={m.winning_team === team}
          players={players.filter((p) => p.team === team).sort((a, b) => b.net_worth - a.net_worth)}
          names={profiles.data}
        />
      ))}
      </TabsContent></Tabs>
    </div>
  );
}

type SortKey = "grade" | "kda" | "nw" | "lh" | "dmg" | "heal" | "kp";
function TeamTable({ team, won, players: rawPlayers, names, winner, durationS }: { durationS: number; team: number; won: boolean; players: MatchPlayer[]; lobby: MatchPlayer[]; winner: number; names?: Map<number, { personaname: string }> | undefined }) {
  const heroes = useHeroMap();
  const items = useItemMap();
  const gq = useQuery(globalAvgQuery);
  const ga = gq.data ? globalAverages(gq.data) : null;
  const [sort, setSort] = useState<SortKey>("nw");
  const teamKills = rawPlayers.reduce((s, p) => s + p.kills, 0) || 1;
  const teamNw = rawPlayers.reduce((s, p) => s + p.net_worth, 0) || 1;
  const teamDmg = rawPlayers.reduce((s, p) => s + (p.stats.at(-1)?.player_damage ?? 0), 0) || 1;
  const val = (p: MatchPlayer): number => {
    const l = p.stats.at(-1);
    switch (sort) {
      case "grade": return ga ? gradeVsGlobal({ k: p.kills, d: p.deaths, a: p.assists, nw: p.net_worth, lh: p.last_hits, won: p.team === winner }, ga, durationS).score : 0;
      case "kda": return (p.kills + p.assists) / Math.max(1, p.deaths);
      case "lh": return p.last_hits;
      case "dmg": return l?.player_damage ?? 0;
      case "heal": return l?.player_healing ?? 0;
      case "kp": return p.kills + p.assists;
      default: return p.net_worth;
    }
  };
  const players = [...rawPlayers].sort((a, b) => val(b) - val(a));
  const Th = ({ k, children, title }: { k?: SortKey; children: React.ReactNode; title?: string }) => (
    <th className="p-3" title={title}>
      {k ? (
        <button onClick={() => setSort(k)} className={cn("uppercase tracking-wider hover:text-foreground", sort === k && "text-primary")}>
          {children}{sort === k ? " ↓" : ""}
        </button>
      ) : children}
    </th>
  );
  return (
    <section className={cn("panel relative overflow-hidden", team === 1 && "mt-5")}>
      <span aria-hidden className={cn("absolute inset-y-0 left-0 w-1", team === 0 ? "bg-amber-team" : "bg-sapphire-team")} />
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-border px-5 py-4">
        <div>
          <p className={cn("font-mono text-[10px] uppercase tracking-[0.3em]", won ? "text-win" : "text-muted-foreground")}>{won ? "◆ Победа" : "Поражение"}</p>
          <h2 className={cn("font-display text-2xl font-black uppercase tracking-wide", team === 0 ? "text-amber-team" : "text-sapphire-team")}>{TEAMS[team]}</h2>
        </div>
        <div className="flex gap-6 text-right">
          {[["Убийства", String(rawPlayers.reduce((s, p) => s + p.kills, 0))], ["Души", fmtK(teamNw)], ["Урон", fmtK(teamDmg)]].map(([l, v]) => (
            <div key={l}><p className="tabular font-display text-xl font-bold">{v}</p><p className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">{l}</p></div>
          ))}
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr className="border-b border-border">
              <Th>Игрок</Th><Th k="grade" title="Оценка относительно среднего игрока (как в профиле)">Оценка</Th><Th k="kda">K/D/A</Th><Th k="kp" title="Участие в убийствах команды: (K + A) / убийства команды">KP%</Th><Th k="nw">Души</Th><Th k="lh">Крипы</Th><Th k="dmg">Урон</Th><Th k="heal">Лечение</Th><Th>Предметы</Th>
            </tr>
          </thead>
          <tbody>
            {players.map((p) => {
              const kp = Math.round(((p.kills + p.assists) / teamKills) * 100);
              const nwShare = (p.net_worth / teamNw) * 100;
              const dmgShare = ((p.stats.at(-1)?.player_damage ?? 0) / teamDmg) * 100;
              const last = p.stats.at(-1);
              const final = p.items.filter((i) => i.sold_time_s === 0 && items.has(i.item_id));
              return (
                <tr key={p.account_id} className="border-b border-border/50 transition-colors last:border-0 hover:bg-accent/30">
                  <td className="p-3">
                    <div className="flex items-center gap-3">
                      <HeroIcon heroId={p.hero_id} size={40} />
                      <div className="min-w-0">
                        <Link to="/players/$accountId" params={{ accountId: String(p.account_id) }} className="block max-w-40 truncate font-medium hover:text-primary">
                          {names?.get(p.account_id)?.personaname ?? `#${p.account_id}`}
                        </Link>
                        <p className="text-xs text-muted-foreground">{heroes.get(p.hero_id)?.name} · ур. {p.level}</p>
                      </div>
                      <PlayerRank accountId={p.account_id} />
                    </div>
                  </td>
                  <td className="p-3">{ga && (() => {
                    const inp = { k: p.kills, d: p.deaths, a: p.assists, nw: p.net_worth, lh: p.last_hits, won: p.team === winner };
                    const g = gradeVsGlobal(inp, ga, durationS);
                    const why = explainVsGlobal(inp, ga, durationS);
                    return (
                      <TooltipProvider delayDuration={100}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className={cn("inline-grid h-8 w-9 cursor-help place-items-center rounded-md border border-border bg-secondary font-display text-sm font-extrabold", gradeTone(g.grade))}>{g.grade}</span>
                          </TooltipTrigger>
                          <TooltipContent side="right" collisionPadding={12} className="w-64 border border-border bg-popover p-3 text-xs text-popover-foreground shadow-lg">
                            <span className="mb-1 block font-semibold">Почему {g.grade} · {g.score.toFixed(0)}/100</span>
                            {why.map((w) => <span key={w} className="block text-muted-foreground">{w}</span>)}
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    );
                  })()}</td>
                  <td className="tabular p-3">{p.kills}/<span className="text-loss">{p.deaths}</span>/{p.assists}</td>
                  <td className={cn("tabular p-3", kp >= 60 ? "text-win" : kp < 35 ? "text-loss" : "")}>{kp}%</td>
                  <td className="tabular p-3">
                    <span className={team === 0 ? "text-amber-team" : "text-sapphire-team"}>{fmtK(p.net_worth)}</span>{p.net_worth === Math.max(...rawPlayers.map((x) => x.net_worth)) && <MaxTag />}
                    <Share pct={nwShare} team={team} />
                  </td>
                  <td className="tabular p-3">{p.last_hits}<span className="text-muted-foreground">/{p.denies}</span></td>
                  <td className="tabular p-3">{fmtK(last?.player_damage)}{(last?.player_damage ?? 0) === Math.max(...rawPlayers.map((x) => x.stats.at(-1)?.player_damage ?? 0)) && <MaxTag />}<Share pct={dmgShare} team={team} /></td>
                  <td className="tabular p-3">{fmtK(last?.player_healing)}{(last?.player_healing ?? 0) > 0 && (last?.player_healing ?? 0) === Math.max(...rawPlayers.map((x) => x.stats.at(-1)?.player_healing ?? 0)) && <MaxTag />}</td>
                  <td className="p-3">
                    <div className="flex min-w-60 flex-wrap gap-1">
                      {final.map((i) => {
                        const it = items.get(i.item_id)!;
                        return (
                          <GameItem key={`${i.item_id}-${i.game_time_s}`} item={it} size={28} variant="image" />
                        );
                      })}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function MaxTag() {
  return <span className="ml-1.5 border border-primary/50 px-1 align-middle font-mono text-[8px] uppercase text-primary">max</span>;
}

interface LiveMatch {
  match_id: number;
  start_time: number;
  spectators: number;
  game_mode_parsed?: string;
  match_mode?: number;
  game_mode?: number;
  net_worth_team_0: number;
  net_worth_team_1: number;
  players: { account_id: number; team: number; hero_id: number }[];
}

function LiveView({ m }: { m: LiveMatch }) {
  const mode = [m.match_mode ? MATCH_MODES[m.match_mode] : null, m.game_mode ? GAME_MODES[m.game_mode] : null].filter(Boolean).join(" · ");
  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs uppercase tracking-[0.3em] text-primary">Матч #{m.match_id}</p>
        <h1 className="inline-flex items-center gap-3 font-display text-4xl font-semibold uppercase">
          <span className="h-3 w-3 animate-pulse rounded-full bg-loss" /> Матч идёт
        </h1>
        {m.game_mode_parsed?.includes("StreetBrawl") && <p className="mt-2 inline-flex rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-xs text-primary">Режим Street Brawl · 4 на 4, души общие на команду</p>}
        <div className="mt-3"><SpectateButton matchId={m.match_id} /></div>
        <p className="mt-2 text-muted-foreground">Статистика игроков обновляется в реальном времени. Полный разбор, линии и советы появятся после окончания матча.</p>
        <div className="deco-line mt-6" />
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <Stat label="Начался" value={<span className="text-lg">{fmtDate(m.start_time)}</span>} />
        <Stat label="Зрители" value={m.spectators} />
        <Stat label="Режим" value={<span className="text-lg">{mode || "—"}</span>} />
      </div>
      <LiveScoreboard matchId={m.match_id} roster={m.players} ranked={m.match_mode === 4} />
    </div>
  );
}

function Share({ pct, team }: { pct: number; team: number }) {
  return (
    <span className="mt-1 flex items-center gap-1.5 text-[10px] text-muted-foreground" title="Доля от команды">
      <span className="h-1 w-12 overflow-hidden rounded bg-secondary">
        <span className={cn("block h-full", team === 0 ? "bg-amber-team" : "bg-sapphire-team")} style={{ width: `${Math.min(100, pct)}%` }} />
      </span>
      {pct.toFixed(0)}%
    </span>
  );
}
