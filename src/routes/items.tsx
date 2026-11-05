import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";

import { Chip, ErrorBox, Loading, PageHeader, WinrateBar, inputClass } from "@/components/dl";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { api, itemsQuery, type Item } from "@/lib/api";
import { fmtInt, SLOT_LABELS, stripHtml, winrate } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/items")({
  head: () => ({
    meta: [
      { title: "Предметы Deadlock — каталог и винрейт" },
      { name: "description", content: "Все предметы магазина Deadlock: оружие, живучесть, духовность — с ценой и винрейтом." },
      { property: "og:title", content: "Предметы Deadlock" },
      { property: "og:description", content: "Каталог предметов Deadlock с винрейтом." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ItemsPage,
});

interface ItemStat { item_id: number; wins: number; matches: number }
const SLOTS = ["weapon", "vitality", "spirit"] as const;
const slotTone: Record<string, string> = {
  weapon: "border-amber-team/50 bg-amber-team/10 text-amber-team",
  vitality: "border-win/50 bg-win/10 text-win",
  spirit: "border-chart-5/50 bg-chart-5/10 text-chart-5",
};

function ItemsPage() {
  const items = useQuery(itemsQuery);
  const stats = useQuery({
    queryKey: ["item-stats-all"],
    queryFn: () => api<ItemStat[]>("/v1/analytics/item-stats", { min_unix_timestamp: Math.floor(Date.now() / 1000 / 3600) * 3600 - 14 * 86400 }),
  });
  const [slot, setSlot] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<Item | null>(null);
  const statMap = useMemo(() => new Map((stats.data ?? []).map((s) => [s.item_id, s])), [stats.data]);

  const list = useMemo(
    () =>
      (items.data ?? [])
        .filter((i) => i.shopable && i.item_tier)
        .filter((i) => !slot || i.item_slot_type === slot)
        .filter((i) => !q || i.name.toLowerCase().includes(q.toLowerCase())),
    [items.data, slot, q],
  );
  const tiers = [1, 2, 3, 4];

  return (
    <div>
      <PageHeader eyebrow="Магазин" title="Предметы">Нажмите на предмет, чтобы увидеть описание и статистику за 14 дней.</PageHeader>
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <Chip active={!slot} onClick={() => setSlot(null)}>Все</Chip>
        {SLOTS.map((s) => <Chip key={s} active={slot === s} onClick={() => setSlot(s)}>{SLOT_LABELS[s]}</Chip>)}
        <div className="ml-auto w-64"><input className={inputClass} placeholder="Поиск предмета" value={q} onChange={(e) => setQ(e.target.value)} /></div>
      </div>
      {items.isLoading ? <Loading /> : items.error ? <ErrorBox error={items.error} /> : (
        <div className="space-y-8">
          {tiers.map((t) => {
            const row = list.filter((i) => i.item_tier === t).sort((a, b) => (a.item_slot_type ?? "").localeCompare(b.item_slot_type ?? ""));
            if (!row.length) return null;
            return (
              <section key={t}>
                <h2 className="mb-3 font-display text-lg uppercase tracking-wider text-primary">Тир {t} · {fmtInt(row[0]?.cost)} душ</h2>
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 md:grid-cols-7 lg:grid-cols-9">
                  {row.map((i) => {
                    const s = statMap.get(i.id);
                    const wr = s ? winrate(s.wins, s.matches) : null;
                    return (
                      <button key={i.id} onClick={() => setOpen(i)} className={cn("panel panel-hover flex flex-col items-center gap-1 p-2 text-center")}>
                        <span className={cn("grid h-14 w-14 place-items-center rounded-md border", slotTone[i.item_slot_type ?? ""])}>
                          <img src={i.shop_image_webp ?? i.image_webp} alt="" className="h-10 w-10 object-contain" loading="lazy" />
                        </span>
                        <span className="line-clamp-2 text-xs leading-tight">{i.name}</span>
                        {wr != null && <span className={cn("tabular text-[10px]", wr >= 0.5 ? "text-win" : "text-loss")}>{(wr * 100).toFixed(1)}%</span>}
                      </button>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      )}
      <Dialog open={!!open} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent className="border-primary/30 bg-card">
          {open && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-3 font-display text-2xl uppercase">
                  <span className={cn("grid h-14 w-14 place-items-center rounded-md border", slotTone[open.item_slot_type ?? ""])}>
                    <img src={open.shop_image_webp ?? open.image_webp} alt="" className="h-10 w-10" />
                  </span>
                  {open.name}
                </DialogTitle>
              </DialogHeader>
              <div className="flex flex-wrap gap-4 text-sm">
                <span className="text-primary">{fmtInt(open.cost)} душ</span>
                <span className="text-muted-foreground">{SLOT_LABELS[open.item_slot_type ?? ""]} · Тир {open.item_tier}</span>
                {open.is_active_item && <span className="text-primary">Активный</span>}
              </div>
              {open.description?.desc && <p className="whitespace-pre-line text-sm text-muted-foreground">{stripHtml(open.description.desc)}</p>}
              {statMap.get(open.id) && (
                <div className="flex items-center justify-between border-t border-border pt-4 text-sm">
                  <span className="text-muted-foreground">{fmtInt(statMap.get(open.id)!.matches)} матчей</span>
                  <WinrateBar value={winrate(statMap.get(open.id)!.wins, statMap.get(open.id)!.matches)} />
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
