import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { ChevronDown, ExternalLink } from "lucide-react";
import { useState } from "react";

import { ErrorBox, Loading, PageHeader } from "@/components/dl";
import { api } from "@/lib/api";
import { stripHtml } from "@/lib/format";

export const Route = createFileRoute("/patches")({
  head: () => ({
    meta: [
      { title: "Патчи Deadlock — список изменений" },
      { name: "description", content: "Последние обновления и патчноуты Deadlock." },
      { property: "og:title", content: "Патчи Deadlock" },
      { property: "og:description", content: "Последние изменения в Deadlock." },
    ],
  }),
  component: PatchesPage,
});

interface Patch { title: string; pub_date: string; link: string; content_encoded: string; dc_creator?: string }

function PatchesPage() {
  const q = useQuery({ queryKey: ["patches"], queryFn: () => api<Patch[]>("/v1/patches"), staleTime: 3600_000 });
  const [open, setOpen] = useState<string | null>(null);
  return (
    <div>
      <PageHeader eyebrow="Обновления" title="Патчи">Официальные списки изменений с форума разработчиков (на английском).</PageHeader>
      {q.isLoading ? <Loading /> : q.error ? <ErrorBox error={q.error} /> : (
        <div className="space-y-3">
          {[...q.data!].sort((a, b) => +new Date(b.pub_date) - +new Date(a.pub_date)).map((p) => {
            const isOpen = open === p.link;
            return (
              <div key={p.link} className="panel overflow-hidden">
                <button onClick={() => setOpen(isOpen ? null : p.link)} className="flex w-full items-center gap-4 p-4 text-left hover:bg-accent/30">
                  <div className="flex-1">
                    <p className="font-display text-xl">{p.title}</p>
                    <p className="text-xs text-muted-foreground">{new Date(p.pub_date).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" })}{p.dc_creator ? ` · ${p.dc_creator}` : ""}</p>
                  </div>
                  <ChevronDown className={`h-5 w-5 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                </button>
                {isOpen && (
                  <div className="border-t border-border p-4">
                    <p className="max-h-[60vh] overflow-y-auto whitespace-pre-line text-sm leading-relaxed text-muted-foreground">{stripHtml(p.content_encoded)}</p>
                    <a href={p.link} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-1 text-sm text-primary hover:underline">
                      Открыть на форуме <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
