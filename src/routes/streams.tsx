import { createFileRoute } from "@tanstack/react-router";
import { ExternalLink, Plus, X } from "lucide-react";
import { useEffect, useState } from "react";

import { Empty, PageHeader, inputClass } from "@/components/dl";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/streams")({
  head: () => ({
    meta: [
      { title: "Стримы Deadlock — Twitch прямо на сайте" },
      { name: "description", content: "Смотрите Twitch-трансляции по Deadlock внутри Deadlock Stats и сохраняйте любимых стримеров." },
      { property: "og:title", content: "Стримы Deadlock" },
      { property: "og:description", content: "Twitch-трансляции Deadlock прямо на сайте." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Streams,
});

const KEY = "dl-streams";

function Streams() {
  const [channels, setChannels] = useState<string[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [host, setHost] = useState("");

  useEffect(() => {
    setHost(window.location.hostname);
    try { const c = JSON.parse(localStorage.getItem(KEY) ?? "[]") as string[]; setChannels(c); setActive(c[0] ?? null); } catch { /* ignore */ }
  }, []);
  const save = (c: string[]) => { setChannels(c); localStorage.setItem(KEY, JSON.stringify(c)); };
  const add = () => {
    const name = input.trim().replace(/^https?:\/\/(www\.)?twitch\.tv\//, "").replace(/\/.*$/, "").toLowerCase();
    if (!/^[a-z0-9_]{3,25}$/.test(name)) return;
    if (!channels.includes(name)) save([...channels, name]);
    setActive(name); setInput("");
  };

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Сообщество" title="Стримы">Добавьте Twitch-каналы — они сохранятся в этом браузере.</PageHeader>
      <div className="flex flex-wrap items-center gap-2">
        <form onSubmit={(e) => { e.preventDefault(); add(); }} className="flex gap-2">
          <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Канал или ссылка twitch.tv/…" className={cn(inputClass, "w-72 rounded-full")} />
          <button className="inline-flex items-center gap-1 rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground"><Plus className="h-4 w-4" />Добавить</button>
        </form>
        <a href="https://www.twitch.tv/directory/category/deadlock" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary">Найти стримы Deadlock на Twitch <ExternalLink className="h-3.5 w-3.5" /></a>
      </div>
      {channels.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {channels.map((c) => (
            <span key={c} className={cn("inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm", active === c ? "border-primary/60 bg-primary/15 text-primary" : "border-border bg-secondary")}>
              <button onClick={() => setActive(c)}>{c}</button>
              <button aria-label="Удалить" onClick={() => { const n = channels.filter((x) => x !== c); save(n); if (active === c) setActive(n[0] ?? null); }}><X className="h-3.5 w-3.5" /></button>
            </span>
          ))}
        </div>
      )}
      {active && host ? (
        <div className="grid gap-4 xl:grid-cols-[1fr_340px]">
          <div className="panel overflow-hidden"><iframe title={active} src={`https://player.twitch.tv/?channel=${active}&parent=${host}`} allowFullScreen className="aspect-video w-full" /></div>
          <div className="panel hidden overflow-hidden xl:block"><iframe title="Чат" src={`https://www.twitch.tv/embed/${active}/chat?parent=${host}&darkpopout`} className="h-full min-h-[480px] w-full" /></div>
        </div>
      ) : <Empty>Добавьте канал стримера, чтобы смотреть его здесь.</Empty>}
    </div>
  );
}
