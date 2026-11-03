import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Copy, X } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Chip, HeroIcon, HeroSelect, PageHeader, inputClass, useHeroMap } from "@/components/dl";
import { itemsQuery } from "@/lib/api";
import { fmtInt, SLOT_LABELS } from "@/lib/format";
import { cn } from "@/lib/utils";

export const MAX_ITEMS = 12;

export const Route = createFileRoute("/calculator")({
  validateSearch: (s: Record<string, unknown>) => ({
    hero: s["hero"] ? Number(s["hero"]) || undefined : undefined,
    items: typeof s["items"] === "string" ? s["items"] : s["items"] != null ? String(s["items"]) : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Калькулятор билдов Deadlock — собери и поделись" },
      { name: "description", content: "Соберите билд Deadlock: предметы по слотам, стоимость в душах и ссылка, чтобы поделиться." },
      { property: "og:title", content: "Калькулятор билдов Deadlock" },
      { property: "og:description", content: "Собери билд и поделись ссылкой." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Calculator,
});

const SLOTS = ["weapon", "vitality", "spirit"] as const;

function Calculator() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/calculator" });
  const heroes = useHeroMap();
  const items = useQuery(itemsQuery);
  const [slot, setSlot] = useState<(typeof SLOTS)[number]>("weapon");
  const [tier, setTier] = useState<number>(0);
  const [q, setQ] = useState("");
  const picked = useMemo(() => (search.items ?? "").split(",").map(Number).filter(Boolean), [search.items]);
  const byId = useMemo(() => new Map((items.data ?? []).map((i) => [i.id, i])), [items.data]);
  const update = (ids: number[], hero = search.hero) => navigate({ search: { hero, items: ids.length ? ids.join(",") : undefined }, replace: true });

  const shop = (items.data ?? []).filter((i) => i.shopable && i.item_slot_type === slot && (!tier || i.item_tier === tier) && i.name.toLowerCase().includes(q.toLowerCase()) && (!i.hero || i.hero === search.hero)).sort((a, b) => (a.cost ?? 0) - (b.cost ?? 0));
  const build = picked.map((id) => byId.get(id)).filter(Boolean) as NonNullable<ReturnType<typeof byId.get>>[];
  const total = build.reduce((s, i) => s + (i.cost ?? 0), 0);
  const perSlot = SLOTS.map((s) => build.filter((i) => i.item_slot_type === s).reduce((a, i) => a + (i.cost ?? 0), 0));

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Инструменты" title="Калькулятор билда">Добавляйте предметы, смотрите стоимость и вложения по слотам, делитесь ссылкой.</PageHeader>
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <section className="panel space-y-4 p-4">
          <div className="flex flex-wrap gap-2">{SLOTS.map((s) => <Chip key={s} active={slot === s} onClick={() => setSlot(s)}>{SLOT_LABELS[s] ?? s}</Chip>)}</div>
          <div className="flex flex-wrap gap-2">{[0, 1, 2, 3, 4].map((t) => <Chip key={t} active={tier === t} onClick={() => setTier(t)}>{t ? `Тир ${t}` : "Все тиры"}</Chip>)}</div>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Поиск предмета" className={inputClass} />
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
            {shop.map((i) => {
              const has = picked.includes(i.id);
              return (
                <button key={i.id} disabled={has || picked.length >= MAX_ITEMS} onClick={() => update([...picked, i.id])} className={cn("flex items-center gap-2 rounded-lg border border-border p-2 text-left text-sm hover:border-primary/60 disabled:opacity-40")}>
                  {(i.shop_image_webp ?? i.image_webp) && <img src={i.shop_image_webp ?? i.image_webp} alt="" className="h-8 w-8 rounded" />}
                  <span className="min-w-0 flex-1"><span className="block truncate">{i.name}</span><span className="tabular text-xs text-primary">{fmtInt(i.cost)}</span></span>
                </button>
              );
            })}
          </div>
        </section>
        <aside className="panel h-fit space-y-4 p-4 lg:sticky lg:top-20">
          <div className="flex items-center gap-3">
            {search.hero && <HeroIcon heroId={search.hero} size={40} />}
            <div className="flex-1"><HeroSelect value={search.hero ?? null} onChange={(h) => update(picked, h ?? undefined)} /></div>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Стоимость билда</p>
            <p className="tabular font-display text-3xl font-bold text-primary">{fmtInt(total)}</p>
            <p className="text-xs text-muted-foreground">{build.length}/{MAX_ITEMS} слотов{search.hero ? ` · ${heroes.get(search.hero)?.name}` : ""}</p>
          </div>
          <div className="space-y-1.5">
            {SLOTS.map((s, i) => (
              <div key={s} className="text-xs">
                <div className="flex justify-between"><span>{SLOT_LABELS[s] ?? s}</span><span className="tabular">{fmtInt(perSlot[i])}</span></div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-secondary"><div className="h-full bg-primary" style={{ width: `${total ? ((perSlot[i] ?? 0) / total) * 100 : 0}%` }} /></div>
              </div>
            ))}
          </div>
          <div className="space-y-1">
            {build.map((i, idx) => (
              <div key={i.id} className="flex items-center gap-2 rounded-md bg-secondary/50 p-1.5 text-sm">
                <span className="tabular w-5 text-xs text-muted-foreground">{idx + 1}</span>
                <span className="flex-1 truncate">{i.name}</span>
                <span className="tabular text-xs text-primary">{fmtInt(i.cost)}</span>
                <button aria-label="Убрать" onClick={() => update(picked.filter((x) => x !== i.id))}><X className="h-3.5 w-3.5 text-muted-foreground hover:text-loss" /></button>
              </div>
            ))}
            {!build.length && <p className="text-sm text-muted-foreground">Пока пусто — выберите предметы слева.</p>}
          </div>
          <div className="flex gap-2">
            <button onClick={() => { navigator.clipboard.writeText(location.href); toast.success("Ссылка на билд скопирована"); }} className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"><Copy className="h-4 w-4" />Поделиться</button>
            {build.length > 0 && <button onClick={() => update([])} className="rounded-full border border-border px-4 py-2 text-sm">Очистить</button>}
          </div>
        </aside>
      </div>
    </div>
  );
}
