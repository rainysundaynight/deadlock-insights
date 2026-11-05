import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { HeroIcon, SectionTitle, useHeroMap, useItemMap } from "@/components/dl";
import { api, type Item } from "@/lib/api";
import { advantageSeries, type APlayer } from "@/lib/analysis";
import { fmtDuration, fmtK } from "@/lib/format";
import { abilityOrder, findFights, median, turningPoint } from "@/lib/story";
import { cn } from "@/lib/utils";

type Names = Map<number, { personaname: string }> | undefined;
type SPlayer = APlayer & { player_slot: number; death_details?: { game_time_s: number }[] | undefined; items: { game_time_s: number; item_id: number; sold_time_s: number }[] };
const TEAMS = ["Hidden King", "Archmother"];
const teamText = (t: number | null) => (t === 0 ? "text-amber-team" : t === 1 ? "text-sapphire-team" : "text-muted-foreground");

export const abilitiesQuery = {
  queryKey: ["abilities"],
  queryFn: () => api<Item[]>("/v1/assets/items/by-type/ability", { language: "russian" }),
  staleTime: 86_400_000,
};

export function MatchStory({ players, names, winner, midBoss }: { players: SPlayer[]; names: Names; durationS: number; winner: number; midBoss?: { team_killed: number; destroyed_time_s: number }[] | undefined }) {
  const series = useMemo(() => advantageSeries(players), [players]);
  const tp = useMemo(() => turningPoint(series, winner), [series, winner]);
  const fights = useMemo(() => findFights(players), [players]);
  const biggest = [...fights].sort((a, b) => b.lost0 + b.lost1 - (a.lost0 + a.lost1))[0];
  const loser = 1 - winner;
  const bossNear = (midBoss ?? []).find((b) => b.destroyed_time_s >= tp.swingStart - 30 && b.destroyed_time_s <= tp.swingEnd + 30);
  const fightsInSwing = fights.filter((f) => f.start <= tp.swingEnd && f.end >= tp.swingStart - 20);

  return (
    <div className="space-y-8">
      <section className="panel relative overflow-hidden p-6">
        <span aria-hidden className={cn("absolute inset-y-0 left-0 w-1", winner === 0 ? "bg-amber-team" : "bg-sapphire-team")} />
        <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-primary">Разбор редакции · {tp.comeback ? "камбэк" : "контроль игры"}</p>
        <h2 className="mt-2 font-display text-3xl font-black uppercase">
          Почему победили <span className={teamText(winner)}>{TEAMS[winner]}</span>
        </h2>
        <div className="mt-5 grid gap-px bg-border md:grid-cols-3">
          <Cell label="Переломный момент" value={`${fmtDuration(tp.swingStart)}–${fmtDuration(tp.swingEnd)}`} sub={`+${fmtK(tp.swingAmount)} душ в пользу ${TEAMS[winner]}`} />
          <Cell label={`Лучший момент ${TEAMS[loser]}`} value={tp.loserMaxLead > 0 ? `+${fmtK(tp.loserMaxLead)}` : "ни разу не вели"} sub={tp.loserMaxLead > 0 ? `на ${fmtDuration(tp.loserMaxLeadT)}` : "соперник лидировал всю игру"} />
          <Cell label="Крупнейший файт" value={biggest ? `${biggest.lost1} : ${biggest.lost0}` : "—"} sub={biggest ? `${fmtDuration(biggest.start)} · ${biggest.winner == null ? "размен" : `выиграли ${TEAMS[biggest.winner]}`}` : "массовых драк не было"} />
        </div>
        <p className="mt-5 max-w-3xl text-sm leading-relaxed text-muted-foreground">
          {tp.comeback
            ? `${TEAMS[loser]} вели до +${fmtK(tp.loserMaxLead)} душ на ${fmtDuration(tp.loserMaxLeadT)}, но упустили преимущество.`
            : `${TEAMS[winner]} держали игру под контролем большую часть матча.`}{" "}
          Самый сильный рывок — с {fmtDuration(tp.swingStart)} по {fmtDuration(tp.swingEnd)}
          {fightsInSwing.length ? `: ${fightsInSwing.length === 1 ? "драка" : `${fightsInSwing.length} драки`} (${fightsInSwing.map((f) => `${f.lost1}:${f.lost0}`).join(", ")})` : ""}
          {bossNear ? `, ${TEAMS[bossNear.team_killed]} забрали Мид-босса на ${fmtDuration(bossNear.destroyed_time_s)}` : ""}.
        </p>
      </section>

      <section>
        <SectionTitle right={<span className="text-xs text-muted-foreground">3+ смерти с паузой не больше 20 с · души ±1 мин</span>}>Отчёты о драках</SectionTitle>
        {fights.length === 0 ? <p className="text-sm text-muted-foreground">Массовых драк не было.</p> : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {fights.map((f, i) => {
              const swingFor = f.swing > 0 ? 0 : 1;
              return (
                <article key={i} className={cn("panel relative overflow-hidden p-4", f === biggest && "ring-1 ring-primary/60")}>
                  <span aria-hidden className={cn("absolute inset-x-0 top-0 h-0.5", f.winner === 0 ? "bg-amber-team" : f.winner === 1 ? "bg-sapphire-team" : "bg-border")} />
                  <div className="flex items-baseline justify-between">
                    <p className="tabular font-mono text-xs text-muted-foreground">#{i + 1} · {fmtDuration(f.start)}{f.end > f.start ? `–${fmtDuration(f.end)}` : ""}</p>
                    {f === biggest && <span className="font-mono text-[9px] uppercase tracking-widest text-primary">крупнейший</span>}
                  </div>
                  <p className="mt-2 tabular font-display text-3xl font-black"><span className="text-amber-team">{f.lost1}</span> <span className="text-muted-foreground">:</span> <span className="text-sapphire-team">{f.lost0}</span></p>
                  <p className="text-[11px] text-muted-foreground">убийств: Hidden King : Archmother</p>
                  <p className={cn("mt-2 text-sm font-semibold", teamText(f.winner))}>{f.winner == null ? "Равный размен" : `Выиграли ${TEAMS[f.winner]}`}</p>
                  <p className="tabular text-xs text-muted-foreground">Души: <span className={teamText(swingFor)}>{f.swing === 0 ? "0" : `+${fmtK(Math.abs(f.swing))} ${TEAMS[swingFor]}`}</span></p>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <BuildReview players={players} names={names} />
    </div>
  );
}

function Cell({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="bg-card p-4">
      <p className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className="tabular mt-1 font-display text-2xl font-bold">{value}</p>
      <p className="text-xs text-muted-foreground">{sub}</p>
    </div>
  );
}

type Snap = { player_healing?: number; self_healing?: number; heal_prevented?: number };

function BuildReview({ players, names }: { players: SPlayer[]; names: Names }) {
  const heroes = useHeroMap();
  const items = useItemMap();
  const ab = useQuery(abilitiesQuery);
  const abMap = useMemo(() => new Map((ab.data ?? []).map((a) => [a.id, a])), [ab.data]);
  const [sel, setSel] = useState(players[0]?.account_id);
  const p = players.find((x) => x.account_id === sel) ?? players[0];
  if (!p) return null;
  const order = abilityOrder(p.items, new Set(abMap.keys()));
  const heroAbilities = [...new Set(order.map((o) => o.id))];

  const firstOfTier = (pl: SPlayer, tier: number) => pl.items.filter((i) => (items.get(i.item_id)?.item_tier ?? 0) >= tier).map((i) => i.game_time_s).sort((a, b) => a - b)[0];
  const timings = [3, 4].map((tier) => {
    const mine = firstOfTier(p, tier);
    const lobby = median(players.filter((x) => x !== p).map((x) => firstOfTier(x, tier)).filter((x): x is number => x != null));
    return { tier, mine, lobby };
  });

  const last = (pl: SPlayer) => (pl.stats.at(-1) ?? {}) as Snap;
  const heal = (team: number) => players.filter((x) => x.team === team).reduce((s, x) => s + (last(x).player_healing ?? 0) + (last(x).self_healing ?? 0), 0);
  const enemyHeal = heal(1 - p.team), ownHeal = heal(p.team);
  const prevented = last(p).heal_prevented ?? 0;
  const tips: { tone: "good" | "bad" | "info"; text: string }[] = [];
  if (enemyHeal > ownHeal * 1.3 && enemyHeal > 15000) {
    tips.push(prevented < 1000
      ? { tone: "bad", text: `Соперники вылечили ${fmtK(enemyHeal)} HP, а вы срезали всего ${fmtK(prevented)}. Стоило взять предмет на снижение лечения (Healbane, Toxic Bullets, Decay).` }
      : { tone: "good", text: `Против лечащейся команды вы предотвратили ${fmtK(prevented)} лечения — правильная реакция на пик соперника.` });
  }
  for (const t of timings) {
    if (t.mine == null || t.lobby == null) continue;
    const d = t.mine - t.lobby;
    if (d > 180) tips.push({ tone: "bad", text: `Первый предмет T${t.tier} куплен на ${fmtDuration(t.mine)} — на ${Math.round(d / 60)} мин позже медианы лобби (${fmtDuration(t.lobby)}).` });
    else if (d < -120) tips.push({ tone: "good", text: `Первый T${t.tier} на ${fmtDuration(t.mine)} — на ${Math.round(-d / 60)} мин раньше медианы лобби.` });
  }
  if (!tips.length) tips.push({ tone: "info", text: "Тайминги покупок в пределах нормы лобби, явных провалов против пика соперника нет." });

  return (
    <section>
      <SectionTitle right={<span className="text-xs text-muted-foreground">прокачка способностей, тайминги и контр-предметы</span>}>Разбор билда</SectionTitle>
      <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
        {[...players].sort((a, b) => a.team - b.team).map((x) => (
          <button key={x.account_id} onClick={() => setSel(x.account_id)}
            className={cn("flex w-16 shrink-0 flex-col items-center gap-1 border p-1.5 transition-colors", x.account_id === p.account_id ? "border-primary bg-primary/10" : "border-border/50 hover:border-border", x.team === 0 ? "border-b-amber-team" : "border-b-sapphire-team")}>
            <HeroIcon heroId={x.hero_id} size={36} />
            <span className="w-full truncate text-center text-[10px]">{names?.get(x.account_id)?.personaname ?? `#${x.account_id}`}</span>
          </button>
        ))}
      </div>
      <div className="panel grid gap-0 p-0 lg:grid-cols-[1fr_360px]">
        <div className="border-b border-border p-5 lg:border-b-0 lg:border-r">
          <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Порядок прокачки · {heroes.get(p.hero_id)?.name}</p>
          {order.length === 0 ? <p className="text-sm text-muted-foreground">{ab.isLoading ? "Загружаем способности…" : "Нет данных о прокачке."}</p> : (
            <div className="space-y-2">
              {heroAbilities.map((id) => {
                const a = abMap.get(id);
                return (
                  <div key={id} className="flex items-center gap-3">
                    <div className="flex w-36 shrink-0 items-center gap-2">
                      {a?.image_webp || a?.image ? <img src={a.image_webp ?? a.image} alt="" className="h-7 w-7 rounded-sm bg-secondary p-0.5" /> : <span className="h-7 w-7 bg-secondary" />}
                      <span className="truncate text-xs">{a?.name ?? id}</span>
                    </div>
                    <div className="relative h-7 flex-1 border-b border-border/60">
                      {order.filter((o) => o.id === id).map((o) => {
                        const max = Math.max(60, ...order.map((x) => x.t));
                        return (
                          <span key={o.t} title={`${o.level === 0 ? "Открыта" : `Улучшение T${o.level}`} · ${fmtDuration(o.t)}`}
                            className={cn("absolute top-1 grid h-5 min-w-5 -translate-x-1/2 place-items-center border px-0.5 font-mono text-[9px]", o.level === 0 ? "border-border bg-secondary" : o.level === 3 ? "border-primary bg-primary text-primary-foreground" : "border-primary/60 bg-primary/15 text-primary")}
                            style={{ left: `${(o.t / max) * 100}%` }}>
                            {o.level === 0 ? "●" : o.level}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
              <p className="pt-1 text-[10px] text-muted-foreground">● — способность открыта, 1–3 — улучшения. Наведите на отметку, чтобы увидеть время.</p>
            </div>
          )}
          <div className="mt-5 grid grid-cols-2 gap-px bg-border">
            {timings.map((t) => (
              <div key={t.tier} className="bg-card p-3">
                <p className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">Первый предмет T{t.tier}</p>
                <p className="tabular font-display text-xl font-bold">{t.mine != null ? fmtDuration(t.mine) : "не куплен"}</p>
                <p className="text-xs text-muted-foreground">медиана лобби: {t.lobby != null ? fmtDuration(t.lobby) : "—"}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="space-y-2 p-5">
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Против пика соперника</p>
          {tips.map((t, i) => (
            <p key={i} className={cn("border-l-2 py-1 pl-3 text-sm", t.tone === "bad" ? "border-loss" : t.tone === "good" ? "border-win" : "border-border text-muted-foreground")}>{t.text}</p>
          ))}
        </div>
      </div>
    </section>
  );
}
