import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";

import { Loading, PageHeader, inputClass, selectClass } from "@/components/dl";
import { SteamButton } from "@/components/SteamButton";
import { startSteamLogin, useAuth } from "@/hooks/useAuth";
import type { Format } from "@/lib/bracket";
import { createTournament } from "@/lib/tournaments.functions";
import { errMsg } from "@/lib/tournaments";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/tournaments/new")({
  head: () => ({
    meta: [
      { title: "Создать турнир — Deadlock Stats" },
      { name: "description", content: "Создайте турнир Deadlock 6x6 или 1x1, выберите формат сетки и пригласите игроков по ссылке." },
      { property: "og:title", content: "Создать турнир Deadlock" },
      { property: "og:description", content: "Режим, формат сетки и правила — за минуту." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: NewTournament,
});

function NewTournament() {
  const { user, ready } = useAuth();
  const nav = useNavigate();
  const create = useServerFn(createTournament);
  const [f, setF] = useState({ name: "", mode: "6x6" as "6x6" | "1x1", format: "single" as Format, max_slots: 8, starts_at: "", rules: "", random_heroes: false, same_random_hero: false, blind_builds: false });
  const [busy, setBusy] = useState(false);
  if (!ready) return <Loading />;
  if (!user) return <div className="panel mx-auto mt-10 max-w-lg p-10 text-center"><h1 className="font-display text-2xl font-bold">Войдите, чтобы создать турнир</h1><div className="mt-6 flex justify-center"><SteamButton onClick={startSteamLogin} /></div></div>;
  const submit = async () => {
    setBusy(true);
    try {
      const r = await create({ data: { ...f, starts_at: f.starts_at ? new Date(f.starts_at).toISOString() : null } });
      nav({ to: "/tournaments/$id", params: { id: r.id } });
    } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  };
  const label = "mb-1 block font-mono text-[10px] uppercase text-muted-foreground";
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader eyebrow="Новый турнир" title="Объявление о турнире" />
      <div className="panel space-y-5 p-6">
        <div><label className={label}>Название</label><input className={inputClass} value={f.name} maxLength={80} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Кубок Полуночи" /></div>
        <div>
          <label className={label}>Режим</label>
          <div className="grid grid-cols-2 gap-2">
            {(["6x6", "1x1"] as const).map((m) => <button key={m} type="button" onClick={() => setF({ ...f, mode: m })} className={cn("border p-4 text-left", f.mode === m ? "border-primary bg-primary/10" : "border-border")}><b className="font-display text-xl">{m}</b><p className="text-xs text-muted-foreground">{m === "6x6" ? "Команды, драфт пиков и банов" : "Дуэли со своими правилами"}</p></button>)}
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div><label className={label}>Формат сетки</label><select className={cn(selectClass, "w-full")} value={f.format} onChange={(e) => setF({ ...f, format: e.target.value as Format })}><option value="single">Single elimination</option><option value="double">Double elimination</option><option value="round_robin">Круговая</option></select></div>
          <div><label className={label}>{f.mode === "6x6" ? "Макс. команд" : "Макс. игроков"}</label><input type="number" min={2} max={64} className={inputClass} value={f.max_slots} onChange={(e) => setF({ ...f, max_slots: Number(e.target.value) })} /></div>
          <div className="sm:col-span-2"><label className={label}>Старт</label><input type="datetime-local" className={inputClass} value={f.starts_at} onChange={(e) => setF({ ...f, starts_at: e.target.value })} /></div>
        </div>
        {f.mode === "1x1" && (
          <div className="space-y-2 border-t border-border pt-4">
            <p className={label}>Правила дуэли</p>
            <Check v={f.random_heroes} on={(v) => setF({ ...f, random_heroes: v })}>Случайные герои</Check>
            {f.random_heroes && <Check v={f.same_random_hero} on={(v) => setF({ ...f, same_random_hero: v })}>Одинаковый герой у обоих</Check>}
            <Check v={f.blind_builds} on={(v) => setF({ ...f, blind_builds: v })}>Билды вслепую — выбор 1 из 3 закрытых карт</Check>
          </div>
        )}
        <div><label className={label}>Правила и описание</label><textarea className={cn(inputClass, "min-h-24")} value={f.rules} maxLength={2000} onChange={(e) => setF({ ...f, rules: e.target.value })} /></div>
        <button disabled={busy || !f.name.trim()} onClick={submit} className="w-full bg-primary py-3 font-semibold text-primary-foreground disabled:opacity-50">{busy ? "Создаём…" : "Опубликовать турнир"}</button>
      </div>
    </div>
  );
}

function Check({ v, on, children }: { v: boolean; on: (v: boolean) => void; children: ReactNode }) {
  return <label className="flex cursor-pointer items-center gap-3 text-sm"><input type="checkbox" checked={v} onChange={(e) => on(e.target.checked)} className="h-4 w-4 accent-primary" />{children}</label>;
}
