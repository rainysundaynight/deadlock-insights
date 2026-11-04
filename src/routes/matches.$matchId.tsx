import { useQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";

import { ErrorBox, HeroIcon, Loading, RankBadge, Stat, useHeroMap, useItemMap, useSteamProfiles } from "@/components/dl";
import { api } from "@/lib/api";
import { fmtDate, fmtDuration, fmtK, GAME_MODES, MATCH_MODES } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { MatchAnalysis } from "@/components/MatchAnalysis";
import { DamageView, ItemsTimeline } from "@/components/MatchDeep";
import { LaneMinutes } from "@/components/LaneMinutes";
import { explainVsGlobal, gradeVsGlobal, gradeTone } from "@/lib/grade";
import { globalAvgQuery } from "@/components/PlayerInsights";
import { globalAverages } from "@/lib/playerStats";
import { LiveScoreboard } from "@/components/LiveScoreboard";
import { MatchDetails } from "@/components/MatchDetails";
import { MatchReplay, type MatchObjective, type MatchPaths } from "@/components/MatchReplay";
import { MatchActions, SpectateButton } from "@/components/ShareCard";

export const Route = createFileRoute("/matches/$matchId")({
  head: ({ params }) => ({
    meta: [
      { title: `Матч ${params.matchId} — Deadlock Stats` },
      { name: "description", content: "Полный разбор матча Deadlock: составы, KDA, души, урон и предметы." },
      { property: "og:title", content: `Матч ${params.matchId} — Deadlock Stats` },
      { property: "og:description", content: "Таблица результатов и предметы игроков матча Deadlock." },
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

const TEAMS = ["Амбер (Amber)", "Сапфир (Sapphire)"];

function MatchPage() {
  const { matchId } = Route.useParams();
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
  const [tab, setTab] = useState<"table" | "details" | "map" | "lanes" | "damage" | "items" | "tips">("table");

  if (q.isLoading) return <Loading label="Загружаем матч…" />;
  if (q.error) {
    if (live.isLoading) return <Loading label="Проверяем, идёт ли матч сейчас…" />;
    if (live.data) return <LiveView m={live.data} />;
    return <ErrorBox error={new Error("Данные матча пока недоступны. Если матч только что закончился, попробуйте через несколько минут.")} />;
  }
  const m = q.data!.match_info;

  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs uppercase tracking-[0.3em] text-primary">Матч #{m.match_id}</p>
        <h1 className="font-display text-3xl font-bold md:text-4xl">
          Победа: <span className={m.winning_team === 0 ? "text-amber-team" : "text-sapphire-team"}>{TEAMS[m.winning_team]}</span>
        </h1>
        <div className="deco-line mt-6" />
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Длительность" value={fmtDuration(m.duration_s)} />
        <Stat label="Начало" value={<span className="text-lg">{fmtDate(m.start_time)}</span>} />
        <Stat label="Режим" value={<span className="text-lg">{GAME_MODES[m.game_mode] ?? m.game_mode} · {MATCH_MODES[m.match_mode] ?? m.match_mode}</span>} />
        <Stat
          label="Средний ранг"
          value={
            <span className="flex flex-col gap-1 text-sm">
              <RankBadge badge={m.average_badge_team0} size={24} />
              <RankBadge badge={m.average_badge_team1} size={24} />
            </span>
          }
        />
      </div>
      <MatchActions matchId={m.match_id} players={players} winner={m.winning_team} duration={m.duration_s} names={profiles.data} />
      <div className="flex flex-wrap gap-2">
        {([["table", "Таблица"], ["details", "Экономика"], ["map", "Карта"], ["lanes", "Линии и график"], ["damage", "Урон"], ["items", "Предметы"], ["tips", "Советы"]] as const).map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} className={cn("rounded-full border px-4 py-2 text-sm font-medium", tab === k ? "border-primary/60 bg-primary/15 text-primary" : "border-border bg-secondary text-muted-foreground hover:text-foreground")}>{l}</button>
        ))}
      </div>
      {tab === "map" && <MatchReplay paths={m.match_paths} players={players} names={profiles.data} objectives={m.objectives} midBoss={m.mid_boss} />}
      {tab === "details" && <MatchDetails players={players} names={profiles.data} durationS={m.duration_s} />}
      {tab === "damage" && <DamageView players={players} names={profiles.data} />}
      {tab === "items" && <ItemsTimeline players={players} names={profiles.data} />}
      {(tab === "lanes" || tab === "tips") && <MatchAnalysis view={tab} players={players} durationS={m.duration_s} names={profiles.data} />}
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
    <section className="panel overflow-hidden">
      <div className={cn("flex items-center justify-between border-b border-border px-4 py-3", team === 0 ? "text-amber-team" : "text-sapphire-team")}>
        <h2 className="font-display text-lg uppercase tracking-wider">{TEAMS[team]}</h2>
        <span className={cn("text-sm font-semibold uppercase", won ? "text-win" : "text-loss")}>{won ? "Победа" : "Поражение"}</span>
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
                <tr key={p.account_id} className="border-b border-border/50 last:border-0">
                  <td className="p-3">
                    <div className="flex items-center gap-3">
                      <HeroIcon heroId={p.hero_id} size={40} />
                      <div className="min-w-0">
                        <Link to="/players/$accountId" params={{ accountId: String(p.account_id) }} className="block max-w-40 truncate font-medium hover:text-primary">
                          {names?.get(p.account_id)?.personaname ?? `#${p.account_id}`}
                        </Link>
                        <p className="text-xs text-muted-foreground">{heroes.get(p.hero_id)?.name} · ур. {p.level}</p>
                      </div>
                    </div>
                  </td>
                  <td className="p-3">{ga && (() => {
                    const inp = { k: p.kills, d: p.deaths, a: p.assists, nw: p.net_worth, lh: p.last_hits, won: p.team === winner };
                    const g = gradeVsGlobal(inp, ga, durationS);
                    const why = explainVsGlobal(inp, ga, durationS);
                    return (
                      <span className="group relative inline-block">
                        <span className={cn("inline-grid h-8 w-9 cursor-help place-items-center rounded-md border border-border bg-secondary font-display text-sm font-extrabold", gradeTone(g.grade))}>{g.grade}</span>
                        <span className="pointer-events-none absolute left-full top-0 z-20 ml-2 hidden w-60 rounded-lg border border-border bg-popover p-3 text-xs font-normal shadow-lg group-hover:block">
                          <span className="mb-1 block font-semibold">Почему {g.grade} · {g.score.toFixed(0)}/100</span>
                          {why.map((w) => <span key={w} className="block text-muted-foreground">{w}</span>)}
                        </span>
                      </span>
                    );
                  })()}</td>
                  <td className="tabular p-3">{p.kills}/<span className="text-loss">{p.deaths}</span>/{p.assists}</td>
                  <td className="tabular p-3 text-primary">{fmtK(p.net_worth)}</td>
                  <td className="tabular p-3">{p.last_hits}<span className="text-muted-foreground">/{p.denies}</span></td>
                  <td className="tabular p-3">{fmtK(last?.player_damage)}</td>
                  <td className="tabular p-3">{fmtK(last?.player_healing)}</td>
                  <td className="p-3">
                    <div className="flex min-w-60 flex-wrap gap-1">
                      {final.map((i) => {
                        const it = items.get(i.item_id)!;
                        return (
                          <img
                            key={`${i.item_id}-${i.game_time_s}`}
                            src={it.shop_image_webp ?? it.image_webp ?? it.image}
                            alt={it.name}
                            title={`${it.name} · ${fmtDuration(i.game_time_s)}`}
                            className={cn(
                              "h-7 w-7 rounded border p-0.5",
                              it.item_slot_type === "weapon" && "border-amber-team/60 bg-amber-team/10",
                              it.item_slot_type === "vitality" && "border-win/60 bg-win/10",
                              it.item_slot_type === "spirit" && "border-chart-5/60 bg-chart-5/10",
                            )}
                          />
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
