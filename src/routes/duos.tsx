import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Check, ChevronDown, Lightbulb, Search, Shield, Swords, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { Empty, HeroIcon, Loading, PageHeader, useHeroMap } from "@/components/dl";
import { api } from "@/lib/api";
import { fmtInt, fmtK } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/duos")({
  head: () => ({
    meta: [
      { title: "Дуо-линии Deadlock — чья линия сильнее" },
      { name: "description", content: "Выберите двух союзников и двух соперников на линии: винрейт, перевес по душам, убийствам и советы обеим парам." },
      { property: "og:title", content: "Дуо-линии Deadlock" },
      { property: "og:description", content: "Чья линия сильнее, матчапы и советы для обеих пар." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Duos,
});

interface Comb { hero_ids: number[]; wins: number; losses: number; matches: number }
interface Counter {
  hero_id: number; enemy_hero_id: number; wins: number; matches_played: number;
  kills: number; enemy_kills: number; deaths: number; enemy_deaths: number;
  denies: number; enemy_denies: number; last_hits: number; enemy_last_hits: number;
  networth: number; enemy_networth: number; obj_damage: number; enemy_obj_damage: number;
}
const since = () => Math.floor(Date.now() / 1000 / 86400) * 86400 - 30 * 86400;

function HeroPicker({ value, onChange, exclude, tone }: { value: number | null; onChange: (v: number | null) => void; exclude: number[]; tone: "amber" | "sapphire" }) {
  const heroes = useHeroMap();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);
  const list = [...heroes.values()].sort((a, b) => a.name.localeCompare(b.name)).filter((h) => h.name.toLowerCase().includes(q.toLowerCase()));
  const cur = value ? heroes.get(value) : null;
  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen((o) => !o)} className={cn("flex w-full items-center gap-3 rounded-lg border bg-secondary/50 p-2 text-left transition hover:bg-accent", open ? (tone === "amber" ? "border-amber-team" : "border-sapphire-team") : "border-border")}>
        {cur ? <HeroIcon heroId={cur.id} size={40} /> : <span className="grid h-10 w-10 place-items-center rounded-lg border border-dashed border-border text-muted-foreground">?</span>}
        <span className={cn("flex-1 font-display", !cur && "text-muted-foreground")}>{cur?.name ?? "Выбрать героя"}</span>
        {cur && <span role="button" onClick={(e) => { e.stopPropagation(); onChange(null); }} className="rounded p-1 text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></span>}
        <ChevronDown className="h-4 w-4 text-muted-foreground" />
      </button>
      {open && (
        <div className="absolute z-30 mt-2 w-[22rem] max-w-[90vw] rounded-xl border border-border bg-card p-3 shadow-2xl">
          <div className="mb-2 flex items-center gap-2 rounded-md border border-input bg-secondary px-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Поиск героя…" className="h-9 flex-1 bg-transparent text-sm outline-none" />
          </div>
          <div className="grid max-h-72 grid-cols-5 gap-1 overflow-y-auto">
            {list.map((h) => {
              const dis = exclude.includes(h.id) && h.id !== value;
              return (
                <button key={h.id} disabled={dis} onClick={() => { onChange(h.id); setOpen(false); setQ(""); }}
                  className={cn("relative flex flex-col items-center gap-1 rounded-md p-1 hover:bg-accent", h.id === value && "bg-accent", dis && "pointer-events-none opacity-25")}>
                  <HeroIcon heroId={h.id} size={40} />
                  <span className="w-full truncate text-center text-[10px] text-muted-foreground">{h.name}</span>
                  {h.id === value && <Check className="absolute right-0.5 top-0.5 h-3 w-3 text-primary" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

const per = (a: number, n: number) => (n ? a / n : 0);

function Duos() {
  const heroes = useHeroMap();
  const [sel, setSel] = useState<(number | null)[]>([null, null, null, null]);
  const set = (i: number) => (v: number | null) => setSel((s) => s.map((x, j) => (j === i ? v : x)));
  const [a1, a2, e1, e2] = sel;
  const allies = [a1, a2].filter(Boolean) as number[];
  const enemies = [e1, e2].filter(Boolean) as number[];
  const chosen = sel.filter(Boolean) as number[];
  const name = (id: number) => heroes.get(id)?.name ?? `#${id}`;

  const pairQ = (ids: number[], vs: number[]) => ({
    queryKey: ["duo", ids.join(","), vs.join(",")],
    enabled: ids.length === 2,
    staleTime: 3600_000,
    queryFn: async () => {
      const rows = await api<Comb[]>("/v1/analytics/hero-comb-stats", { comb_size: 2, include_hero_ids: ids.join(","), include_enemy_hero_ids: vs.join(",") || undefined, min_unix_timestamp: since(), min_matches: 1 });
      return rows.find((r) => ids.every((i) => r.hero_ids.includes(i))) ?? null;
    },
  });
  const ours = useQuery(pairQ(allies, enemies));
  const theirs = useQuery(pairQ(enemies, allies));
  const counters = useQuery({
    queryKey: ["duo-counters-lane"],
    enabled: allies.length > 0 && enemies.length > 0,
    queryFn: () => api<Counter[]>("/v1/analytics/hero-counter-stats", { min_unix_timestamp: since(), same_lane_filter: true }),
    staleTime: 3600_000,
  });

  const matchups = useMemo(() => {
    if (!counters.data) return [];
    return allies.flatMap((a) => enemies.map((e) => {
      const c = counters.data.find((r) => r.hero_id === a && r.enemy_hero_id === e);
      if (!c || !c.matches_played) return null;
      const n = c.matches_played;
      return {
        a, e, n, wr: c.wins / n,
        nw: per(c.networth - c.enemy_networth, n),
        kd: per(c.kills, n) - per(c.enemy_kills, n),
        lh: per(c.last_hits - c.enemy_last_hits, n),
        dn: per(c.denies - c.enemy_denies, n),
        obj: per(c.obj_damage - c.enemy_obj_damage, n),
        k: per(c.kills, n), ek: per(c.enemy_kills, n),
      };
    }).filter((x): x is NonNullable<typeof x> => !!x));
  }, [counters.data, allies.join(","), enemies.join(",")]);

  const verdict = useMemo(() => {
    if (!matchups.length && !ours.data) return null;
    const wr = ours.data ? ours.data.wins / ours.data.matches : matchups.reduce((s, m) => s + m.wr, 0) / matchups.length;
    const nw = matchups.length ? matchups.reduce((s, m) => s + m.nw, 0) / matchups.length : 0;
    const kd = matchups.length ? matchups.reduce((s, m) => s + m.kd, 0) / matchups.length : 0;
    // 0..100, 50 = ровная линия
    const score = Math.max(0, Math.min(100, 50 + (wr - 0.5) * 300 + nw / 150 + kd * 4));
    return { wr, nw, kd, score };
  }, [matchups, ours.data]);

  const tips = useMemo(() => {
    if (!matchups.length) return { us: [], them: [] };
    const us: string[] = [], them: string[] = [];
    const worst = [...matchups].sort((x, y) => x.wr - y.wr)[0]!;
    const best = [...matchups].sort((x, y) => y.wr - x.wr)[0]!;
    if (worst.wr < 0.48) { us.push(`${name(worst.a)} проигрывает ${name(worst.e)} (${(worst.wr * 100).toFixed(1)}%) — держитесь ближе к союзнику и не размениваетесь 1 на 1.`); them.push(`${name(worst.e)}, давите на ${name(worst.a)} — это ваш самый выгодный матчап.`); }
    if (best.wr > 0.52) { us.push(`${name(best.a)} сильнее ${name(best.e)} — ищите размены и фокус именно на нём.`); them.push(`${name(best.e)}, избегайте ${name(best.a)} в одиночку, фармите под башней.`); }
    const avg = (f: (m: (typeof matchups)[0]) => number) => matchups.reduce((s, m) => s + f(m), 0) / matchups.length;
    const nw = avg((m) => m.nw), dn = avg((m) => m.dn), lh = avg((m) => m.lh), kd = avg((m) => m.kd), obj = avg((m) => m.obj);
    if (nw > 300) { us.push(`В среднем вы выходите с линии на ${fmtK(nw)} душ впереди — превращайте это в ранний предмет и давите башню.`); them.push(`Вы отстаёте по душам (~${fmtK(nw)}) — приоритет добиванию, а не убийствам; при давлении зовите ротацию.`); }
    else if (nw < -300) { us.push(`Соперники обычно фармят больше на ~${fmtK(-nw)} душ — играйте от добивания и денаев, не форсируйте драки.`); them.push(`Ваша пара сильнее по фарму — забирайте урны и сферы, давите линию.`); }
    if (dn < -1) us.push(`Соперники денаят больше (${Math.abs(dn).toFixed(1)}/матч) — подбирайте сферы своих крипов.`);
    if (dn > 1) them.push(`Противник денаит больше вас — не отдавайте сферы, следите за добиванием своих крипов.`);
    if (lh < -5) us.push(`Вы проигрываете по добиванию (${lh.toFixed(0)}) — уделяйте больше внимания крипам.`);
    if (kd > 0.5) { us.push(`Ваша пара чаще убивает на линии — играйте агрессивно на 3–6 уровне.`); them.push(`Вы чаще умираете на этой линии — берите предметы на выживание раньше.`); }
    else if (kd < -0.5) { us.push(`На этой линии вы чаще умираете — держите дистанцию и берите предметы на выживание.`); them.push(`Вы сильнее в драках — ищите убийства до первой башни.`); }
    if (obj > 1500) them.push(`Противник быстрее сносит строения — защищайте Guardian, не уходите с линии надолго.`);
    if (obj < -1500) us.push(`Соперники сильнее давят строения — не оставляйте линию без присмотра.`);
    if (!us.length) us.push("Линия ровная — решает индивидуальная игра и ротации.");
    if (!them.length) them.push("Линия ровная — решает индивидуальная игра и ротации.");
    return { us, them };
  }, [matchups, heroes]);

  const usWr = verdict?.wr;
  const leader = verdict ? (verdict.score >= 55 ? "us" : verdict.score <= 45 ? "them" : "even") : null;

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Мета" title="Дуо-линии">Двое ваших героев против двух соперников на одной линии — данные за 30 дней.</PageHeader>
      <div className="grid gap-4 md:grid-cols-[1fr_auto_1fr] md:items-center">
        {[0, 1].map((side) => (
          <section key={side} className={cn("panel space-y-3 p-4", side === 0 ? "border-amber-team/40 md:order-1" : "border-sapphire-team/40 md:order-3")}>
            <h2 className={cn("font-display text-sm uppercase tracking-wider", side === 0 ? "text-amber-team" : "text-sapphire-team")}>{side === 0 ? "Ваша пара" : "Пара соперников"}</h2>
            {[side * 2, side * 2 + 1].map((i) => (
              <HeroPicker key={i} value={sel[i] ?? null} onChange={set(i)} exclude={chosen} tone={side === 0 ? "amber" : "sapphire"} />
            ))}
          </section>
        ))}
        <div className="font-display text-2xl font-bold text-muted-foreground md:order-2">VS</div>
      </div>

      {allies.length < 2 ? <Empty>Выберите двух героев своей пары (и соперников — для разбора линии).</Empty> : ours.isLoading || counters.isLoading ? <Loading /> : (
        <>
          {verdict && (
            <section className="panel p-5">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <div className="flex -space-x-2">{allies.map((a) => <HeroIcon key={a} heroId={a} size={48} />)}</div>
                </div>
                <div className="text-center">
                  <p className="text-xs uppercase tracking-widest text-muted-foreground">Чья линия сильнее</p>
                  <p className={cn("font-display text-2xl font-bold", leader === "us" ? "text-amber-team" : leader === "them" ? "text-sapphire-team" : "text-foreground")}>
                    {leader === "us" ? "Ваша пара" : leader === "them" ? (enemies.length ? "Соперники" : "Слабая связка") : "Примерно равно"}
                  </p>
                </div>
                <div className="flex -space-x-2">{enemies.length ? enemies.map((e) => <HeroIcon key={e} heroId={e} size={48} />) : <span className="text-sm text-muted-foreground">любые соперники</span>}</div>
              </div>
              <div className="relative h-4 overflow-hidden rounded-full bg-sapphire-team/70">
                <div className="h-full bg-amber-team transition-all" style={{ width: `${verdict.score}%` }} />
                <div className="absolute inset-y-0 left-1/2 w-px bg-background" />
              </div>
              <div className="mt-1 flex justify-between text-xs text-muted-foreground"><span>Сила линии {verdict.score.toFixed(0)}</span><span>{(100 - verdict.score).toFixed(0)}</span></div>

              <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
                <Tile label="Винрейт пары" value={usWr != null ? `${(usWr * 100).toFixed(1)}%` : "—"} good={usWr != null && usWr >= 0.5} sub={ours.data ? `${fmtInt(ours.data.matches)} матчей` : "по матчапам"} />
                <Tile label="Винрейт соперников" value={theirs.data ? `${((theirs.data.wins / theirs.data.matches) * 100).toFixed(1)}%` : "—"} good={!!theirs.data && theirs.data.wins / theirs.data.matches < 0.5} sub={theirs.data ? `${fmtInt(theirs.data.matches)} матчей` : "выберите обоих"} />
                <Tile label="Перевес по душам" value={matchups.length ? `${verdict.nw >= 0 ? "+" : ""}${fmtK(verdict.nw)}` : "—"} good={verdict.nw >= 0} sub="среднее за матч" />
                <Tile label="Убийства на линии" value={matchups.length ? `${verdict.kd >= 0 ? "+" : ""}${verdict.kd.toFixed(2)}` : "—"} good={verdict.kd >= 0} sub="разница K за матч" />
              </div>
              {ours.data && ours.data.matches < 50 && <p className="mt-3 text-xs text-muted-foreground">Мало матчей с такой связкой — результат может быть случайным.</p>}
            </section>
          )}

          {matchups.length > 0 && (
            <section className="panel p-5">
              <h2 className="mb-3 font-display text-sm uppercase tracking-wider">Матчапы 1 на 1 на линии</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-xs uppercase text-muted-foreground">
                    <tr className="border-b border-border"><th className="p-2">Матчап</th><th className="p-2">Винрейт</th><th className="p-2">Души</th><th className="p-2">Убийства</th><th className="p-2">Добивание</th><th className="p-2">Денаи</th><th className="p-2">Урон строениям</th><th className="p-2">Матчей</th></tr>
                  </thead>
                  <tbody>
                    {matchups.map((m) => (
                      <tr key={`${m.a}-${m.e}`} className="border-b border-border/50 last:border-0">
                        <td className="p-2"><span className="flex items-center gap-2"><HeroIcon heroId={m.a} size={28} /><span className="text-muted-foreground">vs</span><HeroIcon heroId={m.e} size={28} /><span className="truncate">{name(m.a)} — {name(m.e)}</span></span></td>
                        <Diff v={m.wr - 0.5} text={`${(m.wr * 100).toFixed(1)}%`} />
                        <Diff v={m.nw} text={`${m.nw >= 0 ? "+" : ""}${fmtK(m.nw)}`} />
                        <Diff v={m.kd} text={`${m.k.toFixed(1)} / ${m.ek.toFixed(1)}`} />
                        <Diff v={m.lh} text={`${m.lh >= 0 ? "+" : ""}${m.lh.toFixed(0)}`} />
                        <Diff v={m.dn} text={`${m.dn >= 0 ? "+" : ""}${m.dn.toFixed(1)}`} />
                        <Diff v={m.obj} text={`${m.obj >= 0 ? "+" : ""}${fmtK(m.obj)}`} />
                        <td className="tabular p-2 text-muted-foreground">{fmtInt(m.n)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {matchups.length > 0 && (
            <div className="grid gap-4 md:grid-cols-2">
              <TipCard title="Советы вашей паре" icon={<Swords className="h-4 w-4" />} tone="amber" tips={tips.us} />
              <TipCard title="Советы соперникам" icon={<Shield className="h-4 w-4" />} tone="sapphire" tips={tips.them} />
            </div>
          )}
          {!enemies.length && <Empty>Добавьте соперников, чтобы увидеть, чья линия сильнее, матчапы и советы.</Empty>}
        </>
      )}
    </div>
  );
}

function Tile({ label, value, sub, good }: { label: string; value: string; sub: string; good: boolean }) {
  return (
    <div className="rounded-lg border border-border bg-secondary/40 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn("tabular font-display text-2xl font-bold", value === "—" ? "text-muted-foreground" : good ? "text-win" : "text-loss")}>{value}</p>
      <p className="text-[11px] text-muted-foreground">{sub}</p>
    </div>
  );
}

function Diff({ v, text }: { v: number; text: string }) {
  return <td className={cn("tabular p-2 font-semibold", Math.abs(v) < 1e-6 ? "" : v > 0 ? "text-win" : "text-loss")}>{text}</td>;
}

function TipCard({ title, icon, tone, tips }: { title: string; icon: React.ReactNode; tone: "amber" | "sapphire"; tips: string[] }) {
  return (
    <section className={cn("panel p-5", tone === "amber" ? "border-amber-team/40" : "border-sapphire-team/40")}>
      <h2 className={cn("mb-3 inline-flex items-center gap-2 font-display text-sm uppercase tracking-wider", tone === "amber" ? "text-amber-team" : "text-sapphire-team")}>{icon}{title}</h2>
      <ul className="space-y-2">
        {tips.map((t, i) => (
          <li key={i} className="flex gap-2 text-sm"><Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-primary" /><span>{t}</span></li>
        ))}
      </ul>
    </section>
  );
}
