import { useQueries, useQuery } from "@tanstack/react-query";
import { Crown, Flame, Radio, Skull, Swords, TrendingUp } from "lucide-react";
import { Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useMemo, useState } from "react";

import { HeroIcon, Loading, RankBadge, useHeroMap } from "@/components/dl";
import { api } from "@/lib/api";
import { fmtDuration, fmtK, REGIONS } from "@/lib/format";
import { useLiveScoreboard, type LiveEvent } from "@/lib/liveStream";
import { cn } from "@/lib/utils";

const TEAMS = ["Амбер", "Сапфир"];
interface Roster { account_id: number; team: number; hero_id: number }
interface LbEntry { account_name: string; possible_account_ids: number[]; rank: number }

function useRanks(roster: Roster[], ranked: boolean) {
  const ranks = useQueries({
    queries: roster.map((r) => ({
      queryKey: ["rank", String(r.account_id)],
      queryFn: () => api<{ badge: number | null }>(`/v1/players/${r.account_id}/rank`),
      enabled: ranked, staleTime: 600_000, retry: false,
    })),
  });
  const lb = useQuery({
    queryKey: ["lb-all"], enabled: ranked, staleTime: 3600_000,
    queryFn: async () => (await Promise.all(REGIONS.map((r) => api<{ entries: LbEntry[] }>(`/v1/leaderboard/${r.id}`).then((d) => d.entries.filter((e) => e.rank <= 250)).catch(() => [])))).flat(),
  });
  return { badge: (i: number) => ranks[i]?.data?.badge, lb: lb.data ?? [] };
}

const EV_ICON: Record<LiveEvent["kind"], typeof Swords> = { kill: Swords, death: Skull, level: TrendingUp, streak: Flame, lead: Crown };

export function LiveScoreboard({ matchId, roster = [], ranked = false }: { matchId: number; roster?: Roster[]; ranked?: boolean }) {
  const [on, setOn] = useState(false);
  const { players, history, events, gameTime, status, message } = useLiveScoreboard(matchId, on);
  const heroes = useHeroMap();
  const { badge, lb } = useRanks(roster, ranked);
  const [filter, setFilter] = useState<"all" | "kill" | "streak">("all");

  const info = useMemo(() => {
    const m = new Map<string, { badge?: number | null | undefined; place?: number }>();
    for (const p of players) {
      const i = roster.findIndex((r) => r.hero_id === p.hero && r.team === p.team);
      if (i < 0) continue;
      const id = roster[i]!.account_id;
      const cands = lb.filter((e) => e.possible_account_ids.includes(id));
      const hit = cands.find((e) => e.possible_account_ids.length === 1 || e.account_name === p.name) ?? (cands.length === 1 ? cands[0] : undefined);
      m.set(`${p.team}-${p.hero}`, { badge: badge(i), ...(hit ? { place: hit.rank } : {}) });
    }
    return m;
  }, [players, roster, lb, badge]);

  if (!on)
    return (
      <div className="panel flex flex-col items-center gap-3 p-8 text-center">
        <Radio className="h-8 w-8 text-primary" />
        <p className="font-display text-lg font-semibold">Живая статистика игроков</p>
        <p className="max-w-md text-sm text-muted-foreground">Души, убийства, урон, лента событий и график перевеса в реальном времени. Подключение может занять до минуты; сервис разрешает несколько таких подключений в час.</p>
        <button onClick={() => setOn(true)} className="mt-2 rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90">Подключиться к трансляции</button>
      </div>
    );
  if (status === "error" && !players.length)
    return <div className="panel p-6 text-sm"><p className="font-semibold">Не удалось подключиться к трансляции</p><p className="mt-1 text-muted-foreground">{message.includes("429") || message.includes("limit") ? "Достигнут лимит подключений — попробуйте позже." : message || "Попробуйте позже."}</p></div>;
  if (!players.length) return <Loading label={message ? `Подключаемся к трансляции… ${message.slice(0, 80)}` : "Подключаемся к трансляции…"} />;

  const team = (t: number) => players.filter((p) => p.team === t).sort((a, b) => b.nw - a.nw);
  const sum = (t: number, f: (p: (typeof players)[number]) => number) => team(t).reduce((s, p) => s + f(p), 0);
  const diff = sum(0, (p) => p.nw) - sum(1, (p) => p.nw);
  const maxAbs = Math.max(1000, ...history.map((h) => Math.abs(h.diff)));
  const totalDmg = Math.max(1, ...players.map((p) => p.dmg));
  const mvp = [...players].sort((a, b) => (b.k * 2 + b.a) / Math.max(1, b.d) + b.nw / 8000 - ((a.k * 2 + a.a) / Math.max(1, a.d) + a.nw / 8000))[0];
  const shownEvents = events.filter((e) => filter === "all" || e.kind === filter);

  const compare: [string, number, number, (n: number) => string][] = [
    ["Души", sum(0, (p) => p.nw), sum(1, (p) => p.nw), fmtK],
    ["Урон по героям", sum(0, (p) => p.dmg), sum(1, (p) => p.dmg), fmtK],
    ["Лечение", sum(0, (p) => p.heal), sum(1, (p) => p.heal), fmtK],
    ["По постройкам", sum(0, (p) => p.obj), sum(1, (p) => p.obj), fmtK],
    ["Крипы", sum(0, (p) => p.lh), sum(1, (p) => p.lh), String],
  ];

  return (
    <div className="space-y-4">
      <div className="panel grid items-center gap-4 p-5 md:grid-cols-[1fr_auto_1fr]">
        <div className="text-amber-team"><p className="text-xs uppercase tracking-wider">{TEAMS[0]}</p><p className="tabular font-display text-3xl font-bold">{fmtK(sum(0, (p) => p.nw))}</p></div>
        <div className="text-center">
          <p className="tabular font-display text-4xl font-extrabold"><span className="text-amber-team">{sum(0, (p) => p.k)}</span> <span className="text-muted-foreground">:</span> <span className="text-sapphire-team">{sum(1, (p) => p.k)}</span></p>
          <p className="mt-1 inline-flex items-center gap-1.5 text-xs text-muted-foreground"><span className={cn("h-1.5 w-1.5 rounded-full", status === "ended" ? "bg-muted-foreground" : "animate-pulse bg-loss")} />{status === "ended" ? "Трансляция завершена" : "В эфире"} · <span className="tabular">{fmtDuration(gameTime)}</span></p>
        </div>
        <div className="text-right text-sapphire-team"><p className="text-xs uppercase tracking-wider">{TEAMS[1]}</p><p className="tabular font-display text-3xl font-bold">{fmtK(sum(1, (p) => p.nw))}</p></div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <div className="panel p-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Перевес по душам</p>
            <span className={cn("rounded-full px-3 py-1 font-display text-sm font-bold", diff >= 0 ? "bg-amber-team/15 text-amber-team" : "bg-sapphire-team/15 text-sapphire-team")}>{diff >= 0 ? TEAMS[0] : TEAMS[1]} +{fmtK(Math.abs(diff))}</span>
          </div>
          <div className="h-56">
            {history.length > 1 ? (
              <ResponsiveContainer>
                <AreaChart data={history} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gA" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--team-amber)" stopOpacity={0.55} /><stop offset="100%" stopColor="var(--team-amber)" stopOpacity={0.02} /></linearGradient>
                    <linearGradient id="gS" x1="0" y1="1" x2="0" y2="0"><stop offset="0%" stopColor="var(--team-sapphire)" stopOpacity={0.55} /><stop offset="100%" stopColor="var(--team-sapphire)" stopOpacity={0.02} /></linearGradient>
                  </defs>
                  <CartesianGrid stroke="var(--border)" strokeDasharray="2 6" vertical={false} />
                  <XAxis dataKey="t" type="number" domain={["dataMin", "dataMax"]} tickFormatter={(v) => fmtDuration(v)} stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis domain={[-maxAbs, maxAbs]} tickFormatter={(v) => fmtK(Math.abs(v))} stroke="var(--muted-foreground)" fontSize={11} width={44} tickLine={false} axisLine={false} />
                  <ReferenceLine y={0} stroke="var(--muted-foreground)" strokeOpacity={0.5} />
                  <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12 }} labelFormatter={(v) => fmtDuration(Number(v))} formatter={(v: number) => [`${v >= 0 ? TEAMS[0] : TEAMS[1]} +${fmtK(Math.abs(v))}`, "Перевес"]} />
                  <Area dataKey="a" stroke="var(--team-amber)" strokeWidth={2} fill="url(#gA)" isAnimationActive={false} baseValue={0} tooltipType="none" />
                  <Area dataKey="s" stroke="var(--team-sapphire)" strokeWidth={2} fill="url(#gS)" isAnimationActive={false} baseValue={0} tooltipType="none" />
                  <Area dataKey="diff" stroke="transparent" fill="transparent" isAnimationActive={false} />
                </AreaChart>
              </ResponsiveContainer>
            ) : <p className="grid h-full place-items-center text-sm text-muted-foreground">Собираем данные для графика…</p>}
          </div>
          <div className="mt-4 space-y-2">
            {compare.map(([l, a, b, f]) => (
              <div key={l} className="text-xs">
                <div className="mb-1 flex justify-between"><span className="tabular text-amber-team">{f(a)}</span><span className="text-muted-foreground">{l}</span><span className="tabular text-sapphire-team">{f(b)}</span></div>
                <div className="flex h-1.5 overflow-hidden rounded-full bg-secondary"><div className="bg-amber-team" style={{ width: `${(a / (a + b || 1)) * 100}%` }} /><div className="flex-1 bg-sapphire-team" /></div>
              </div>
            ))}
          </div>
        </div>

        <div className="panel flex max-h-[520px] flex-col p-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Лента событий</p>
            <div className="flex gap-1 text-xs">
              {([["all", "Все"], ["kill", "Убийства"], ["streak", "Серии"]] as const).map(([k, l]) => (
                <button key={k} onClick={() => setFilter(k)} className={cn("rounded-full px-2 py-0.5", filter === k ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground")}>{l}</button>
              ))}
            </div>
          </div>
          {mvp && (
            <div className="mb-3 flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 p-2 text-sm">
              <Crown className="h-4 w-4 text-primary" /><HeroIcon heroId={mvp.hero} size={24} />
              <span className="truncate font-medium">{mvp.name}</span><span className="ml-auto text-xs text-muted-foreground">лучший сейчас</span>
            </div>
          )}
          <div className="-mr-2 flex-1 space-y-1 overflow-y-auto pr-2">
            {shownEvents.map((e) => {
              const Icon = EV_ICON[e.kind];
              return (
                <div key={e.id} className="flex items-center gap-2 rounded-md px-1.5 py-1 text-sm hover:bg-accent/50">
                  <span className="tabular w-11 text-xs text-muted-foreground">{fmtDuration(e.t)}</span>
                  <Icon className={cn("h-3.5 w-3.5 shrink-0", e.kind === "death" ? "text-loss" : e.kind === "streak" ? "text-primary" : e.team === 0 ? "text-amber-team" : "text-sapphire-team")} />
                  {e.hero > 0 && <HeroIcon heroId={e.hero} size={20} />}
                  <span className="min-w-0 truncate"><span className={e.team === 0 ? "text-amber-team" : "text-sapphire-team"}>{e.name}</span> <span className="text-muted-foreground">{e.text}</span></span>
                </div>
              );
            })}
            {!shownEvents.length && <p className="text-sm text-muted-foreground">События появятся по ходу матча.</p>}
          </div>
        </div>
      </div>

      {[0, 1].map((t) => (
        <section key={t} className="panel overflow-x-auto">
          <h3 className={cn("border-b border-border px-4 py-3 font-display text-sm font-semibold uppercase tracking-wider", t === 0 ? "text-amber-team" : "text-sapphire-team")}>{TEAMS[t]}</h3>
          <table className="w-full text-sm">
            <thead className="text-left text-[11px] uppercase tracking-wider text-muted-foreground">
              <tr className="border-b border-border"><th className="p-3">Игрок</th><th className="p-3">Ур.</th><th className="p-3">K/D/A</th><th className="p-3">Души</th><th className="p-3">Крипы</th><th className="p-3">Урон</th><th className="p-3">Лечение</th><th className="p-3">По постройкам</th></tr>
            </thead>
            <tbody>
              {team(t).map((p) => {
                const r = info.get(`${p.team}-${p.hero}`);
                return (
                  <tr key={p.entity_index} className="border-b border-border/50 last:border-0">
                    <td className="p-3">
                      <div className="flex items-center gap-3">
                        <HeroIcon heroId={p.hero} size={34} />
                        <div className="min-w-0">
                          <p className="flex items-center gap-2 font-medium">
                            <span className="max-w-40 truncate">{p.name}</span>
                            {p.streak >= 2 && <span title={`Серия ${p.streak}`} className="inline-flex items-center gap-0.5 rounded-full bg-primary/15 px-1.5 py-0.5 text-[11px] font-bold text-primary"><Flame className="h-3 w-3 fill-current" />{p.streak}</span>}
                          </p>
                          <p className="text-xs text-muted-foreground">{heroes.get(p.hero)?.name}</p>
                        </div>
                        {ranked && r?.badge ? (
                          <div className="ml-auto flex flex-col items-center leading-none">
                            <RankBadge badge={r.badge} size={28} showName={false} />
                            {r.place && <span className="tabular mt-0.5 text-[10px] font-bold text-primary">#{r.place}</span>}
                          </div>
                        ) : null}
                      </div>
                    </td>
                    <td className="tabular p-3">{p.level}</td>
                    <td className="tabular p-3">{p.k}/<span className="text-loss">{p.d}</span>/{p.a}</td>
                    <td className="tabular p-3 text-primary">{fmtK(p.nw)}</td>
                    <td className="tabular p-3">{p.lh}<span className="text-muted-foreground">/{p.dn}</span></td>
                    <td className="p-3"><span className="tabular">{fmtK(p.dmg)}</span><div className="mt-1 h-1 w-16 rounded-full bg-secondary"><div className="h-full rounded-full bg-loss/70" style={{ width: `${(p.dmg / totalDmg) * 100}%` }} /></div></td>
                    <td className="tabular p-3">{fmtK(p.heal)}</td>
                    <td className="tabular p-3">{fmtK(p.obj)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      ))}
    </div>
  );
}
