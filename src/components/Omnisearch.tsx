import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Command as Cmd } from "cmdk";
import { Search } from "lucide-react";
import { useEffect, useState } from "react";

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { api, heroesQuery, itemsQuery, type SteamProfile } from "@/lib/api";

const row = "flex cursor-pointer items-center gap-3 px-4 py-2.5 text-sm aria-selected:bg-accent aria-selected:text-primary";
const group = "[&_[cmdk-group-heading]]:border-b [&_[cmdk-group-heading]]:border-border [&_[cmdk-group-heading]]:px-4 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:font-mono [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-widest [&_[cmdk-group-heading]]:text-primary";

/** Global Ctrl/Cmd+K search: players, match id, heroes, items. */
export function Omnisearch() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [deb, setDeb] = useState("");
  const navigate = useNavigate();
  useEffect(() => {
    const on = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setOpen((v) => !v); } };
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  }, []);
  useEffect(() => { const t = setTimeout(() => setDeb(q.trim()), 300); return () => clearTimeout(t); }, [q]);
  const heroes = useQuery({ ...heroesQuery, enabled: open });
  const items = useQuery({ ...itemsQuery, enabled: open });
  const players = useQuery({
    queryKey: ["steam-search", deb],
    queryFn: () => api<SteamProfile[]>("/v1/players/steam-search", { search_query: deb, limit: 6 }),
    enabled: open && deb.length >= 2 && !/^\d+$/.test(deb),
  });
  const s = q.trim().toLowerCase();
  const hs = s ? (heroes.data ?? []).filter((h) => h.name.toLowerCase().includes(s)).slice(0, 5) : [];
  const is = s.length >= 2 ? (items.data ?? []).filter((i) => i.shopable !== false && i.name.toLowerCase().includes(s)).slice(0, 5) : [];
  const num = /^\d{3,}$/.test(s) ? s : null;
  const settled = !!deb && !players.isFetching && !(deb.length >= 2 && !/^\d+$/.test(deb) && !players.data);
  useEffect(() => {
    if (!open || !settled) return;
    const d = deb.toLowerCase();
    const isNum = /^\d{3,}$/.test(d);
    const counts = {
      heroes: (heroes.data ?? []).filter((h) => h.name.toLowerCase().includes(d)).slice(0, 5).length,
      items: d.length >= 2 ? (items.data ?? []).filter((i) => i.shopable !== false && i.name.toLowerCase().includes(d)).slice(0, 5).length : 0,
      players: players.data?.length ?? 0,
      ids: isNum ? 2 : 0,
    };
    const total = counts.heroes + counts.items + counts.players + counts.ids;
    const base = { input_type: isNum ? "number" : "text", char_count: d.length };
    window.__lovableEvents?.track?.("project.omnisearch_query", { ...base, result_count: total, hero_count: counts.heroes, item_count: counts.items, player_count: counts.players });
    if (total === 0) window.__lovableEvents?.track?.("project.omnisearch_no_results", base);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deb, settled, open]);
  const go = (fn: () => void, kind: string, position: number) => {
    window.__lovableEvents?.track?.("project.omnisearch_result_selected", { result_kind: kind, position, char_count: q.trim().length });
    fn(); setOpen(false); setQ("");
  };

  return (
    <>
      <button onClick={() => setOpen(true)} className="hidden shrink-0 items-center gap-2 border border-border bg-secondary px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground hover:border-primary/60 hover:text-primary md:inline-flex" aria-label="Поиск по сайту">
        <Search className="h-3.5 w-3.5" /> Поиск <kbd className="border border-border px-1">Ctrl K</kbd>
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="overflow-hidden p-0">
          <DialogTitle className="sr-only">Поиск по сайту</DialogTitle>
          <Cmd shouldFilter={false} className="bg-popover">
            <div className="flex items-center gap-2 border-b border-border px-4">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Cmd.Input value={q} onValueChange={setQ} autoFocus placeholder="Игрок, ID матча, герой или предмет…" className="h-12 w-full bg-transparent text-sm outline-none" />
            </div>
            <Cmd.List className="max-h-96 overflow-y-auto">
              {!s && <p className="px-4 py-6 text-center text-sm text-muted-foreground">Начните вводить. Число — откроет матч или игрока по ID.</p>}
              {num && (
                <Cmd.Group heading="По номеру" className={group}>
                  <Cmd.Item value={`m${num}`} onSelect={() => go(() => navigate({ to: "/matches/$matchId", params: { matchId: num }, search: {} }), "match", 0)} className={row}>Открыть матч #{num}</Cmd.Item>
                  <Cmd.Item value={`p${num}`} onSelect={() => go(() => navigate({ to: "/players/$accountId", params: { accountId: num } }), "player_id", 1)} className={row}>Открыть игрока ID {num}</Cmd.Item>
                </Cmd.Group>
              )}
              {hs.length > 0 && (
                <Cmd.Group heading="Герои" className={group}>
                  {hs.map((h, idx) => (
                    <Cmd.Item key={h.id} value={`h${h.id}`} onSelect={() => go(() => navigate({ to: "/heroes/$heroId", params: { heroId: String(h.id) } }), "hero", idx)} className={row}>
                      <img src={h.images.icon_image_small_webp ?? h.images.icon_image_small} alt="" className="h-7 w-7 rounded-sm" />{h.name}
                    </Cmd.Item>
                  ))}
                </Cmd.Group>
              )}
              {(players.data?.length ?? 0) > 0 && (
                <Cmd.Group heading="Игроки" className={group}>
                  {players.data!.map((p, idx) => (
                    <Cmd.Item key={p.account_id} value={`a${p.account_id}`} onSelect={() => go(() => navigate({ to: "/players/$accountId", params: { accountId: String(p.account_id) } }), "player", idx)} className={row}>
                      <img src={p.avatarmedium ?? p.avatar} alt="" className="h-7 w-7 rounded-sm" />{p.personaname}<span className="ml-auto text-xs text-muted-foreground">ID {p.account_id}</span>
                    </Cmd.Item>
                  ))}
                </Cmd.Group>
              )}
              {is.length > 0 && (
                <Cmd.Group heading="Предметы" className={group}>
                  {is.map((i, idx) => (
                    <Cmd.Item key={i.id} value={`i${i.id}`} onSelect={() => go(() => navigate({ to: "/items" }), "item", idx)} className={row}>
                      <img src={i.shop_image_webp ?? i.image_webp ?? i.image} alt="" className="h-7 w-7" />{i.name}<span className="ml-auto text-xs text-muted-foreground">T{i.item_tier} · {i.cost}</span>
                    </Cmd.Item>
                  ))}
                </Cmd.Group>
              )}
              {s && !num && !hs.length && !is.length && !players.data?.length && <p className="px-4 py-6 text-center text-sm text-muted-foreground">{players.isFetching ? "Ищем…" : "Ничего не нашли"}</p>}
            </Cmd.List>
          </Cmd>
        </DialogContent>
      </Dialog>
    </>
  );
}
