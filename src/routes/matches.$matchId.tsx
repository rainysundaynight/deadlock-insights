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
import { LiveScoreboard } from "@/components/LiveScoreboard";

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
  const [tab, setTab] = useState<"table" | "lanes" | "damage" | "items" | "tips">("table");

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
      <div className="flex flex-wrap gap-2">
        {([["table", "Таблица"], ["lanes", "Линии и график"], ["damage", "Урон"], ["items", "Предметы"], ["tips", "Советы"]] as const).map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} className={cn("rounded-full border px-4 py-2 text-sm font-medium", tab === k ? "border-primary/60 bg-primary/15 text-primary" : "border-border bg-secondary text-muted-foreground hover:text-foreground")}>{l}</button>
        ))}
      </div>
      {tab === "damage" && <DamageView players={players} names={profiles.data} />}
      {tab === "items" && <ItemsTimeline players={players} names={profiles.data} />}
      {tab === "lanes" && <LaneMinutes players={players} names={profiles.data} />}
      {(tab === "lanes" || tab === "tips") && <MatchAnalysis view={tab} players={players} durationS={m.duration_s} names={profiles.data} />}
      {tab === "table" && [0, 1].map((team) => (
        <TeamTable
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

function TeamTable({ team, won, players, names }: { team: number; won: boolean; players: MatchPlayer[]; names?: Map<number, { personaname: string }> | undefined }) {
  const heroes = useHeroMap();
  const items = useItemMap();
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
              <th className="p-3">Игрок</th><th className="p-3">K/D/A</th><th className="p-3">Души</th><th className="p-3">Крипы</th><th className="p-3">Урон</th><th className="p-3">Лечение</th><th className="p-3">Предметы</th>
            </tr>
          </thead>
          <tbody>
            {players.map((p) => {
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
  net_worth_team_0: number;
  net_worth_team_1: number;
  players: { account_id: number; team: number; hero_id: number }[];
}

function LiveView({ m }: { m: LiveMatch }) {
  const profiles = useSteamProfiles(m.players.map((p) => p.account_id));
  const heroes = useHeroMap();
  const total = m.net_worth_team_0 + m.net_worth_team_1 || 1;
  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs uppercase tracking-[0.3em] text-primary">Матч #{m.match_id}</p>
        <h1 className="inline-flex items-center gap-3 font-display text-4xl font-semibold uppercase">
          <span className="h-3 w-3 animate-pulse rounded-full bg-loss" /> Матч идёт
        </h1>
        <p className="mt-2 text-muted-foreground">Подключитесь к трансляции, чтобы видеть статистику каждого игрока. Полный разбор, линии и советы появятся после окончания матча.</p>
        <div className="deco-line mt-6" />
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Начался" value={<span className="text-lg">{fmtDate(m.start_time)}</span>} />
        <Stat label="Зрители" value={m.spectators} />
        <Stat label="Души Амбер" value={fmtK(m.net_worth_team_0)} tone="brass" />
        <Stat label="Души Сапфир" value={fmtK(m.net_worth_team_1)} tone="brass" />
      </div>
      <div className="flex h-2 overflow-hidden rounded-full">
        <div className="bg-amber-team" style={{ width: `${(m.net_worth_team_0 / total) * 100}%` }} />
        <div className="flex-1 bg-sapphire-team" />
      </div>
      <LiveScoreboard matchId={m.match_id} />
      <div className="grid gap-4 md:grid-cols-2">
        {[0, 1].map((t) => (
          <section key={t} className="panel p-4">
            <h2 className={cn("mb-3 font-display text-lg uppercase tracking-wider", t === 0 ? "text-amber-team" : "text-sapphire-team")}>{TEAMS[t]}</h2>
            <div className="space-y-2">
              {m.players.filter((p) => p.team === t).map((p) => (
                <div key={p.account_id} className="flex items-center gap-3">
                  <HeroIcon heroId={p.hero_id} size={36} />
                  <div className="min-w-0">
                    <Link to="/players/$accountId" params={{ accountId: String(p.account_id) }} className="block truncate font-medium hover:text-primary">
                      {profiles.data?.get(p.account_id)?.personaname ?? `#${p.account_id}`}
                    </Link>
                    <p className="text-xs text-muted-foreground">{heroes.get(p.hero_id)?.name}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
