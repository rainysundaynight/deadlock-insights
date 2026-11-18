import { Link, createFileRoute } from "@tanstack/react-router";
import { Plus, Swords, Users } from "lucide-react";
import { useState } from "react";

import { Empty, Loading, PageHeader } from "@/components/dl";
import { FORMAT_LABEL, STATUS_LABEL, useTournaments } from "@/lib/tournaments";
import { fmtAgo } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/tournaments/")({
  head: () => ({
    meta: [
      { title: "Турниры и кастомные лобби — Deadlock Stats" },
      { name: "description", content: "Турниры Deadlock 6x6 с драфтом и 1x1 со случайными героями и слепыми билдами. Создайте свой и пригласите игроков." },
      { property: "og:title", content: "Турниры Deadlock" },
      { property: "og:description", content: "Сетки, драфт пиков и банов, дуэли 1x1 со слепыми билдами." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TournamentsPage,
});

const TABS = [["all", "Все"], ["registration", "Регистрация"], ["running", "Идут"], ["finished", "Завершены"]] as const;

function TournamentsPage() {
  const { data, isLoading } = useTournaments();
  const [status, setStatus] = useState<string>("all");
  const [mode, setMode] = useState<string>("all");
  const list = (data ?? []).filter((t) => (status === "all" || t.status === status) && (mode === "all" || t.mode === mode));
  return (
    <div>
      <PageHeader eyebrow="Арена" title="Турниры и кастомные лобби">Соберите сетку, раздайте ссылку и проведите драфт в прямом эфире.</PageHeader>
      <div className="mb-6 flex flex-wrap items-center gap-2">
        {TABS.map(([k, l]) => <button key={k} onClick={() => setStatus(k)} className={cn("game-plate px-3 py-1.5 text-xs", status === k ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground")}>{l}</button>)}
        <span className="mx-2 h-5 w-px bg-border" />
        {["all", "6x6", "1x1"].map((k) => <button key={k} onClick={() => setMode(k)} className={cn("game-plate px-3 py-1.5 text-xs", mode === k ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground")}>{k === "all" ? "Любой режим" : k}</button>)}
        <Link to="/tournaments/new" className="ml-auto inline-flex items-center gap-2 bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"><Plus className="h-4 w-4" />Создать турнир</Link>
      </div>
      {isLoading ? <Loading /> : list.length === 0 ? <Empty>Турниров пока нет — создайте первый.</Empty> : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {list.map((t) => (
            <Link key={t.id} to="/tournaments/$id" params={{ id: t.id }} className="panel group block p-5 transition-colors hover:border-primary/60">
              <div className="flex items-center justify-between font-mono text-[10px] uppercase text-primary"><span>{STATUS_LABEL[t.status]}</span><span>{fmtAgo(new Date(t.created_at).getTime() / 1000)}</span></div>
              <h3 className="mt-2 font-display text-xl font-bold group-hover:text-primary">{t.name}</h3>
              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                <span className="game-plate bg-secondary px-2 py-1 inline-flex items-center gap-1"><Swords className="h-3 w-3" />{t.mode}</span>
                <span className="game-plate bg-secondary px-2 py-1">{FORMAT_LABEL[t.format]}</span>
                <span className="game-plate bg-secondary px-2 py-1 inline-flex items-center gap-1"><Users className="h-3 w-3" />{t.players}</span>
                {t.random_heroes && <span className="game-plate bg-secondary px-2 py-1">Случайные герои</span>}
                {t.blind_builds && <span className="game-plate bg-secondary px-2 py-1">Слепые билды</span>}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
