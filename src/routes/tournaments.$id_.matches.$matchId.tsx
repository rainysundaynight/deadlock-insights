import { Link, createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Crown, Plug, Play } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Empty, HeroIcon, HeroSelect, Loading, SectionTitle, useHeroMap, useItemMap } from "@/components/dl";
import { GameItem } from "@/components/GameItem";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { heroesQuery } from "@/lib/api";
import { BLIND_CARDS, DRAFT_ORDER, picksFor, usedHeroes, type DraftAction } from "@/lib/draft";
import { errMsg, sideName, useTournament, type TData } from "@/lib/tournaments";
import { blindPick, chooseHero, draftMove, draftTick, getBlindPicks, reportResult, startMatch } from "@/lib/tournaments.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/tournaments/$id_/matches/$matchId")({
  head: () => ({
    meta: [
      { title: "Лобби матча — Турнир Deadlock" },
      { name: "description", content: "Лобби турнирного матча Deadlock: драфт, герои, слепые билды и подключение к серверу." },
      { property: "og:title", content: "Лобби турнирного матча Deadlock" },
      { property: "og:description", content: "Драфт пиков и банов в реальном времени." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MatchLobby,
});

function MatchLobby() {
  const { id, matchId } = Route.useParams();
  const { user } = useAuth();
  const q = useTournament(id);
  const startFn = useServerFn(startMatch);
  const reportFn = useServerFn(reportResult);
  const d = q.data;
  const m = d?.matches.find((x) => x.id === matchId);
  useEffect(() => { if (d?.t && m) document.title = `${sideName(d, m.side_a)} vs ${sideName(d, m.side_b)} — ${d.t.name}`; }, [d, m]);
  if (q.isLoading) return <Loading />;
  if (!d?.t || !m) return <Empty>Матч не найден.</Empty>;
  const t = d.t;
  const owner = user?.id === t.owner_id;
  const started = m.status === "draft" || !!m.step_deadline || m.draft_step > 0 || m.status === "finished";
  const run = async (fn: () => Promise<unknown>) => { try { await fn(); q.refetch(); } catch (e) { toast.error(errMsg(e)); } };
  const mySide = sideOf(d, m, user?.id);

  return (
    <div className="space-y-8">
      <Link to="/tournaments/$id" params={{ id }} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary"><ArrowLeft className="h-4 w-4" />{t.name}</Link>
      <header className="dossier-heading grid items-center gap-4 border-b border-primary/40 pb-6 text-center md:grid-cols-[1fr_auto_1fr]">
        <SideTitle d={d} id={m.side_a} winner={m.winner} />
        <span className="font-display text-3xl font-black text-primary">VS</span>
        <SideTitle d={d} id={m.side_b} winner={m.winner} />
      </header>

      <div className="flex flex-wrap items-center justify-center gap-3">
        {m.connect_url ? (
          <a href={m.connect_url} className="inline-flex items-center gap-2 bg-primary px-6 py-3 font-semibold text-primary-foreground"><Plug className="h-4 w-4" />Подключиться к матчу</a>
        ) : (
          <button disabled title="Сервер скоро" className="inline-flex items-center gap-2 border border-border px-6 py-3 font-semibold text-muted-foreground"><Plug className="h-4 w-4" />Подключиться к матчу · сервер скоро</button>
        )}
        {owner && !started && m.status === "ready" && <button onClick={() => run(() => startFn({ data: { matchId } }))} className="inline-flex items-center gap-2 border border-primary px-5 py-3 text-primary"><Play className="h-4 w-4" />{t.mode === "6x6" ? "Начать драфт" : "Начать матч"}</button>}
      </div>

      {t.mode === "6x6" ? <Draft d={d} m={m} mySide={mySide} userId={user?.id} /> : <Duel d={d} m={m} mySide={mySide} userId={user?.id ?? null} started={started} />}

      {owner && m.status === "ready" && started && m.side_a && m.side_b && (
        <section className="panel p-5"><SectionTitle>Итог матча</SectionTitle>
          <p className="mb-3 text-sm text-muted-foreground">Пока сервер не подключён, победителя отмечает организатор — сетка продвинется сама.</p>
          <div className="flex flex-wrap gap-2">{[m.side_a, m.side_b].map((s) => <button key={s} onClick={() => run(() => reportFn({ data: { matchId, winner: s! } }))} className="inline-flex items-center gap-2 border border-primary px-4 py-2 text-sm text-primary hover:bg-primary hover:text-primary-foreground"><Crown className="h-4 w-4" />Победил {sideName(d, s)}</button>)}</div>
        </section>
      )}
    </div>
  );
}

type M = TData["matches"][number];

function sideOf(d: TData, m: M, userId?: string): "a" | "b" | null {
  if (!userId) return null;
  for (const [side, sid] of [["a", m.side_a], ["b", m.side_b]] as const) {
    if (d.t!.mode === "6x6" ? d.parts.some((p) => p.team_id === sid && p.user_id === userId) : d.parts.some((p) => p.id === sid && p.user_id === userId)) return side;
  }
  return null;
}

function SideTitle({ d, id, winner }: { d: TData; id: string | null; winner: string | null }) {
  return <div><h2 className={cn("font-display text-3xl font-black", winner && winner === id && "text-primary")}>{sideName(d, id)}</h2>{winner && winner === id && <p className="game-plate mx-auto mt-2 inline-block bg-primary px-3 py-0.5 text-xs text-primary-foreground">Победа</p>}</div>;
}

function useCountdown(deadline: string | null) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const i = setInterval(() => setNow(Date.now()), 500); return () => clearInterval(i); }, []);
  return deadline ? Math.max(0, Math.ceil((new Date(deadline).getTime() - now) / 1000)) : 0;
}

function Draft({ d, m, mySide, userId }: { d: TData; m: M; mySide: "a" | "b" | null; userId?: string }) {
  const qc = useQueryClient();
  const heroes = useQuery(heroesQuery);
  const moveFn = useServerFn(draftMove);
  const tickFn = useServerFn(draftTick);
  const acts = useQuery({ queryKey: ["draft", m.id], queryFn: async () => ((await supabase.from("draft_actions").select("step, side, kind, hero_id").eq("match_id", m.id).order("step")).data ?? []) as DraftAction[] });
  useEffect(() => {
    const ch = supabase.channel(`draft-${m.id}-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "draft_actions", filter: `match_id=eq.${m.id}` }, () => qc.invalidateQueries({ queryKey: ["draft", m.id] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [m.id, qc]);
  const left = useCountdown(m.step_deadline);
  useEffect(() => {
    if (m.status !== "draft" || left !== 0) return undefined;
    const t = setTimeout(() => tickFn({ data: { matchId: m.id } }).catch(() => {}), 800); return () => clearTimeout(t);
  }, [left, m.status, m.id, tickFn]);
  const actions = acts.data ?? [];
  const used = usedHeroes(actions);
  const cur = DRAFT_ORDER[m.draft_step];
  const team = (side: "a" | "b") => (side === "a" ? m.side_a : m.side_b);
  const isCaptain = mySide && d.teams.find((x) => x.id === team(mySide))?.captain_id === userId;
  const myTurn = m.status === "draft" && cur && isCaptain && cur.side === mySide;
  const pick = async (heroId: number) => { try { await moveFn({ data: { matchId: m.id, heroId } }); } catch (e) { toast.error(errMsg(e)); } };

  const Column = ({ side }: { side: "a" | "b" }) => {
    const bans = actions.filter((a) => a.side === side && a.kind === "ban");
    const picks = picksFor(actions, side);
    const members = d.parts.filter((p) => p.team_id === team(side));
    return (
      <div className="panel p-4">
        <h3 className="mb-3 font-display text-lg font-bold">{sideName(d, team(side))}</h3>
        <p className="mb-1 font-mono text-[10px] uppercase text-muted-foreground">Баны</p>
        <div className="mb-4 flex gap-2">{Array.from({ length: 3 }, (_, i) => bans[i] ? (bans[i].hero_id ? <span key={i} className="grayscale opacity-60"><HeroIcon heroId={bans[i].hero_id!} size={36} /></span> : <span key={i} className="grid h-9 w-9 place-items-center border border-dashed border-border text-[10px] text-muted-foreground">—</span>) : <span key={i} className="h-9 w-9 border border-border" />)}</div>
        <p className="mb-1 font-mono text-[10px] uppercase text-muted-foreground">Пики</p>
        <ul className="space-y-1.5">{Array.from({ length: 6 }, (_, i) => (
          <li key={i} className={cn("flex items-center gap-2 text-sm", members[i]?.user_id === userId && "text-primary")}>
            {picks[i] ? <HeroIcon heroId={picks[i]!} size={32} withName /> : <span className="h-8 w-8 border border-border" />}
            <span className="ml-auto truncate text-xs text-muted-foreground">{members[i]?.persona_name ?? ""}</span>
          </li>))}</ul>
      </div>
    );
  };

  if (m.status !== "draft" && m.draft_step === 0) return <Empty>Драфт начнётся, когда организатор запустит матч.</Empty>;
  return (
    <section className="space-y-4">
      <div className="text-center">
        {m.status === "draft" && cur ? (
          <p className="font-display text-xl"><span className="text-primary">{sideName(d, team(cur.side))}</span> {cur.kind === "ban" ? "банит" : "выбирает"} · <span className={cn("font-mono", left <= 5 && "text-destructive")}>{left}с</span> <span className="font-mono text-xs text-muted-foreground">шаг {m.draft_step + 1}/{DRAFT_ORDER.length}</span></p>
        ) : <p className="font-display text-xl text-primary">Драфт завершён</p>}
      </div>
      <div className="grid gap-4 md:grid-cols-2"><Column side="a" /><Column side="b" /></div>
      {m.status === "draft" && (
        <div className="panel p-4">
          <p className="mb-3 text-sm text-muted-foreground">{myTurn ? `Ваш ход: ${cur!.kind === "ban" ? "забаньте героя" : "выберите героя"}` : isCaptain ? "Ждём ход соперника…" : "Ходят только капитаны команд."}</p>
          <div className="grid grid-cols-5 gap-2 sm:grid-cols-8 lg:grid-cols-12">
            {(heroes.data ?? []).map((h) => <button key={h.id} disabled={!myTurn || used.has(h.id)} onClick={() => pick(h.id)} title={h.name} className={cn("transition-transform", used.has(h.id) ? "opacity-25 grayscale" : myTurn ? "hover:scale-110" : "opacity-70")}><HeroIcon heroId={h.id} size={48} /></button>)}
          </div>
        </div>
      )}
    </section>
  );
}

function Duel({ d, m, mySide, userId, started }: { d: TData; m: M; mySide: "a" | "b" | null; userId: string | null; started: boolean }) {
  const t = d.t!;
  const heroes = useHeroMap();
  const chooseFn = useServerFn(chooseHero);
  const run = async (fn: () => Promise<unknown>) => { try { await fn(); } catch (e) { toast.error(errMsg(e)); } };
  if (!started) return <Empty>Матч начнётся, когда организатор его запустит.</Empty>;
  const myHero = mySide === "a" ? m.hero_a : mySide === "b" ? m.hero_b : null;
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        {(["a", "b"] as const).map((s) => {
          const hid = s === "a" ? m.hero_a : m.hero_b;
          const h = hid ? heroes.get(hid) : undefined;
          return <div key={s} className="panel flex flex-col items-center p-5 text-center"><p className="font-mono text-[10px] uppercase text-muted-foreground">{sideName(d, s === "a" ? m.side_a : m.side_b)}</p>
            {h ? <><img src={h.images.icon_hero_card_webp ?? h.images.icon_hero_card} alt={h.name} className="mt-3 h-40 object-contain" /><p className="font-display text-xl font-bold">{h.name}</p></> : <p className="mt-6 text-muted-foreground">Герой ещё не выбран</p>}</div>;
        })}
      </div>
      {!t.random_heroes && mySide && m.status !== "finished" && <div className="flex items-center justify-center gap-3"><span className="text-sm text-muted-foreground">Ваш герой:</span><HeroSelect value={myHero} allowAll={false} onChange={(v) => v && run(() => chooseFn({ data: { matchId: m.id, heroId: v } }))} /></div>}
      {t.blind_builds && <BlindCards d={d} m={m} mySide={mySide} userId={userId} />}
    </div>
  );
}

function BlindCards({ d, m, mySide, userId }: { d: TData; m: M; mySide: "a" | "b" | null; userId: string | null }) {
  const getFn = useServerFn(getBlindPicks);
  const pickFn = useServerFn(blindPick);
  const items = useItemMap();
  const picks = useQuery({ queryKey: ["blind", m.id, userId], queryFn: () => getFn({ data: { matchId: m.id, userId } }), refetchInterval: 5000 });
  const myPid = mySide === "a" ? m.side_a : mySide === "b" ? m.side_b : null;
  const mine = picks.data?.picks.find((p) => p.participant_id === myPid);
  const choose = async (card: number) => { try { await pickFn({ data: { matchId: m.id, card } }); picks.refetch(); } catch (e) { toast.error(errMsg(e)); } };
  const Build = ({ ids }: { ids: number[] }) => <div className="grid grid-cols-3 gap-2">{ids.map((i) => items.get(i) ? <GameItem key={i} item={items.get(i)!} size={64} /> : null)}</div>;
  return (
    <section className="panel p-5">
      <SectionTitle>Билды вслепую</SectionTitle>
      {mySide && (
        <div className="mx-auto mb-6 grid max-w-md grid-cols-3 gap-3">
          {Array.from({ length: BLIND_CARDS }, (_, i) => {
            const flipped = mine?.card_index === i;
            return (
              <button key={i} disabled={!!mine} onClick={() => choose(i)} className={cn("blind-card", mine && !flipped && "opacity-40")} data-flipped={flipped}>
                <div className="blind-card-inner">
                  <div className="blind-card-face blind-card-back"><span className="font-display text-4xl font-black text-primary">?</span></div>
                  <div className="blind-card-face blind-card-front grid place-items-center p-2 font-mono text-xs text-primary">Ваш билд ниже</div>
                </div>
              </button>
            );
          })}
        </div>
      )}
      {!mine && mySide && <p className="text-center text-sm text-muted-foreground">Выберите одну из трёх закрытых карт — набор предметов откроется после выбора.</p>}
      <div className="grid gap-6 md:grid-cols-2">
        {(picks.data?.picks ?? []).map((p) => (
          <div key={p.participant_id}><p className="mb-2 font-mono text-[10px] uppercase text-muted-foreground">{sideName(d, p.participant_id)} · карта {p.card_index + 1}</p>
            {p.item_ids ? <Build ids={p.item_ids} /> : <p className="text-sm text-muted-foreground">Скрыто, пока соперник не выберет карту.</p>}</div>
        ))}
      </div>
    </section>
  );
}
