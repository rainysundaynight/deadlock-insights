import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { useMemo, useState } from "react";

import { Empty, ErrorBox, Loading, useItemMap } from "@/components/dl";
import { api, type Item, type MatchHistoryEntry } from "@/lib/api";
import { fmtDuration } from "@/lib/format";
import { cn } from "@/lib/utils";

interface Meta { match_id: number; winning_team: string | number; players: { account_id: number; team: string; items?: { item_id: number; game_time_s: number; sold_time_s: number }[] }[] }

interface Agg { item: Item; n: number; wins: number; t: number; sold: number }

const SLOT: Record<string, { label: string; tone: string }> = {
  weapon: { label: "Оружие", tone: "bg-[var(--slot-weapon)]" },
  vitality: { label: "Живучесть", tone: "bg-[var(--slot-vitality)]" },
  spirit: { label: "Дух", tone: "bg-[var(--slot-spirit)]" },
};

export function PlayerItems({ id, history }: { id: number; history: MatchHistoryEntry[] }) {
  const items = useItemMap();
  const ids = history.slice(0, 30).map((m) => m.match_id);
  const [slot, setSlot] = useState<"all" | "weapon" | "vitality" | "spirit">("all");
  const [sort, setSort] = useState<"n" | "wr" | "t">("n");
  const q = useQuery({
    queryKey: ["player-items", id, ids.join(",")],
    enabled: ids.length > 0,
    staleTime: Infinity,
    queryFn: () => api<Meta[]>("/v1/matches/metadata", { include_player_info: true, include_player_items: true, match_ids: ids.join(","), limit: ids.length }),
  });

  const data = useMemo(() => {
    const map = new Map<number, Agg>();
    let games = 0;
    const first: number[] = [];
    for (const m of q.data ?? []) {
      const me = m.players.find((p) => p.account_id === id);
      if (!me?.items) continue;
      games++;
      const won = String(m.winning_team) === me.team || (m.winning_team === 0 && me.team === "Team0") || (m.winning_team === 1 && me.team === "Team1");
      const seen = new Set<number>();
      for (const it of me.items) {
        const item = items.get(it.item_id);
        if (!item || item.type !== "upgrade" || seen.has(item.id)) continue;
        seen.add(item.id);
        const a = map.get(item.id) ?? { item, n: 0, wins: 0, t: 0, sold: 0 };
        a.n++; if (won) a.wins++; a.t += it.game_time_s; if (it.sold_time_s) a.sold++;
        map.set(item.id, a);
        if (seen.size === 1) first.push(item.id);
      }
    }
    const rows = [...map.values()];
    const bySlot = { weapon: 0, vitality: 0, spirit: 0 } as Record<string, number>;
    rows.forEach((r) => { const s = r.item.item_slot_type ?? ""; if (s in bySlot) bySlot[s] = (bySlot[s] ?? 0) + r.n; });
    return { rows, games, bySlot };
  }, [q.data, items, id]);

  if (q.isLoading) return <Loading />;
  if (q.error) return <ErrorBox error={q.error} />;
  if (!data.games) return <Empty>Нет данных по предметам</Empty>;

  const total = Object.values(data.bySlot).reduce((a, b) => a + b, 0) || 1;
  const rows = data.rows
    .filter((r) => slot === "all" || r.item.item_slot_type === slot)
    .sort((a, b) => sort === "n" ? b.n - a.n : sort === "wr" ? b.wins / b.n - a.wins / a.n : a.t / a.n - b.t / b.n);
  const core = [...data.rows].sort((a, b) => b.n - a.n).slice(0, 6);
  const phases = [
    { label: "Ранняя игра", sub: "0–10 мин", f: (t: number) => t < 600 },
    { label: "Середина", sub: "10–25 мин", f: (t: number) => t >= 600 && t < 1500 },
    { label: "Поздняя", sub: "25+ мин", f: (t: number) => t >= 1500 },
  ];
  const btn = (on: boolean) => cn("border-b-2 px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider transition-colors", on ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground");

  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <section className="panel p-5">
          <p className="mb-1 font-mono text-[10px] uppercase tracking-widest text-primary">◆ Основа сборки</p>
          <p className="mb-4 text-xs text-muted-foreground">Самые частые покупки за последние {data.games} матчей</p>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
            {core.map((r, i) => (
              <motion.div key={r.item.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="text-center">
                <ItemImg item={r.item} size={56} />
                <p className="mt-1 truncate text-[11px]">{r.item.name}</p>
                <p className="font-mono text-[10px] text-muted-foreground">{Math.round((r.n / data.games) * 100)}% · {fmtDuration(Math.round(r.t / r.n))}</p>
              </motion.div>
            ))}
          </div>
        </section>
        <section className="panel p-5">
          <p className="mb-4 font-mono text-[10px] uppercase tracking-widest text-primary">◆ Профиль покупок</p>
          <div className="space-y-3">
            {Object.entries(SLOT).map(([k, s]) => {
              const pct = ((data.bySlot[k] ?? 0) / total) * 100;
              return (
                <div key={k}>
                  <div className="mb-1 flex justify-between text-xs"><span>{s.label}</span><span className="tabular font-mono">{pct.toFixed(0)}%</span></div>
                  <div className="h-2 bg-secondary"><motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.6 }} className={cn("h-full", s.tone)} /></div>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      <section className="grid gap-4 md:grid-cols-3">
        {phases.map((ph) => {
          const list = data.rows.filter((r) => ph.f(r.t / r.n)).sort((a, b) => b.n - a.n).slice(0, 8);
          return (
            <div key={ph.label} className="panel p-4">
              <div className="mb-3 flex items-baseline justify-between border-b border-border pb-2">
                <p className="font-display font-bold">{ph.label}</p>
                <p className="font-mono text-[10px] text-muted-foreground">{ph.sub}</p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {list.length ? list.map((r) => <ItemImg key={r.item.id} item={r.item} size={36} />) : <p className="text-xs text-muted-foreground">—</p>}
              </div>
            </div>
          );
        })}
      </section>

      <section className="panel">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 pt-2">
          <div className="flex">
            {([["all", "Все"], ["weapon", "Оружие"], ["vitality", "Живучесть"], ["spirit", "Дух"]] as const).map(([k, l]) => <button key={k} className={btn(slot === k)} onClick={() => setSlot(k)}>{l}</button>)}
          </div>
          <div className="flex">
            {([["n", "Частота"], ["wr", "Винрейт"], ["t", "Время"]] as const).map(([k, l]) => <button key={k} className={btn(sort === k)} onClick={() => setSort(k)}>{l}</button>)}
          </div>
        </div>
        <div className="divide-y divide-border/60">
          {rows.map((r) => {
            const wr = (r.wins / r.n) * 100;
            const pick = (r.n / data.games) * 100;
            return (
              <div key={r.item.id} className="grid grid-cols-[auto_1fr_auto] items-center gap-4 px-4 py-2.5 transition-colors hover:bg-accent/30 md:grid-cols-[36px_minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)_84px_72px]">
                <ItemImg item={r.item} size={36} />
                <div className="min-w-0">
                  <p className="truncate font-medium">{r.item.name}</p>
                  <p className="font-mono text-[10px] uppercase text-muted-foreground">{SLOT[r.item.item_slot_type ?? ""]?.label ?? "—"} · {r.item.cost ?? "?"} душ</p>
                </div>
                <Bar label="Частота" v={pick} text={`${pick.toFixed(0)}%`} className="hidden md:block" />
                <Bar label="Винрейт" v={wr} text={`${wr.toFixed(0)}%`} tone={wr >= 50 ? "bg-win" : "bg-loss"} className="hidden md:block" />
                <div className="tabular text-right">
                  <p className="font-mono text-sm">{fmtDuration(Math.round(r.t / r.n))}</p>
                  <p className="font-mono text-[10px] text-muted-foreground">ср. покупка</p>
                </div>
                <div className="tabular hidden text-right md:block">
                  <p className="font-mono text-sm">{r.n}</p>
                  <p className="font-mono text-[10px] text-muted-foreground">{r.sold ? `продан ${r.sold}` : "матчей"}</p>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function Bar({ label, v, text, tone = "bg-primary", className }: { label: string; v: number; text: string; tone?: string; className?: string }) {
  return (
    <div className={className}>
      <div className="mb-1 flex justify-between font-mono text-[10px] uppercase text-muted-foreground"><span>{label}</span><span className="text-foreground">{text}</span></div>
      <div className="h-1.5 bg-secondary"><div className={cn("h-full", tone)} style={{ width: `${Math.min(100, v)}%` }} /></div>
    </div>
  );
}

function ItemImg({ item, size }: { item: Item; size: number }) {
  const slot = item.item_slot_type ?? "";
  return (
    <span title={item.name} className="relative inline-block border border-border bg-secondary" style={{ width: size, height: size }}>
      <img src={item.shop_image_webp ?? item.shop_image ?? item.image_webp ?? item.image} alt={item.name} loading="lazy" className="h-full w-full object-contain" />
      <span className={cn("absolute inset-x-0 bottom-0 h-0.5", SLOT[slot]?.tone ?? "bg-muted")} />
    </span>
  );
}
