import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { Clock3, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Button } from "@/components/ui/button";

import { api, type SteamProfile } from "@/lib/api";
import { inputClass } from "@/components/dl";

/** Steam64 → account id (32-bit) */
function toAccountId(q: string): number | null {
  const s = q.trim();
  const m = s.match(/profiles\/(\d+)/);
  const digits = m ? m[1] : /^\d+$/.test(s) ? s : null;
  if (!digits) return null;
  const n = BigInt(digits);
  if (n > 76561197960265728n) return Number(n - 76561197960265728n);
  return Number(n);
}

export function PlayerSearch({ autoFocus, compact, onPick, placeholder }: { autoFocus?: boolean; compact?: boolean; onPick?: (p: { account_id: number; personaname?: string }) => void; placeholder?: string }) {
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  const [focused, setFocused] = useState(false);
  const [recent, setRecent] = useState<{ account_id: number; personaname?: string }[]>([]);
  useEffect(() => {
    try { const data = JSON.parse(localStorage.getItem("gazette-recent-players") ?? "[]"); if (Array.isArray(data)) setRecent(data.filter((p) => typeof p.account_id === "number").slice(0, 5)); } catch { /* optional history */ }
  }, []);
  const remember = (p: { account_id: number; personaname?: string }) => {
    const next = [p, ...recent.filter((r) => r.account_id !== p.account_id)].slice(0, 5);
    setRecent(next);
    try { localStorage.setItem("gazette-recent-players", JSON.stringify(next)); } catch { /* storage unavailable */ }
  };
  const navigate = useNavigate();
  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 350);
    return () => clearTimeout(t);
  }, [q]);

  const { data, isFetching } = useQuery({
    queryKey: ["steam-search", debounced],
    queryFn: () => api<SteamProfile[]>("/v1/players/steam-search", { search_query: debounced, limit: 8 }),
    enabled: debounced.length >= 2,
  });

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const id = toAccountId(q);
    const picked = id ? { account_id: id } : data?.[0];
    if (picked) remember(picked);
    if (onPick) {
      if (id) onPick({ account_id: id });
      else if (data?.[0]) onPick(data[0]);
      setQ("");
      return;
    }
    if (id) navigate({ to: "/players/$accountId", params: { accountId: String(id) } });
    else if (data?.[0]) navigate({ to: "/players/$accountId", params: { accountId: String(data[0].account_id) } });
  };

  return (
    <div className="relative w-full" onFocus={() => setFocused(true)} onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setFocused(false); }}>
      <form onSubmit={onSubmit} className="telegram relative rounded-sm border border-input bg-background/90 transition-shadow">
        <Search className={`pointer-events-none absolute top-1/2 -translate-y-1/2 text-muted-foreground ${compact ? "left-3 h-4 w-4" : "left-4 h-5 w-5"}`} />
        <input
          autoFocus={autoFocus}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={placeholder ?? (compact ? "Найти игрока…" : "Ник в Steam, Steam ID или ссылка на профиль")}
          aria-label="Найти игрока"
          className={compact ? `${inputClass} h-10 border-0 bg-transparent pl-9 focus:ring-0` : `${inputClass} h-14 border-0 bg-transparent pl-12 pr-12 text-sm focus:ring-0`}
        />
        {!compact && <Button type="submit" variant="ghost" size="icon" aria-label="Искать" className="absolute right-2 top-1/2 -translate-y-1/2 text-primary"><Search /></Button>}
      </form>
      <AnimatePresence>{focused && (debounced.length >= 2 || (!q && recent.length > 0)) && (
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} className="absolute z-50 mt-2 w-full overflow-hidden rounded-sm border border-primary/40 bg-popover shadow-2xl">
          {!q && <><p className="flex items-center gap-2 border-b border-border px-4 py-2 text-[10px] uppercase text-primary"><Clock3 className="h-3 w-3" />Недавние досье</p>{recent.map((p) => <Link key={p.account_id} to="/players/$accountId" params={{ accountId: String(p.account_id) }} onClick={(e) => { remember(p); if (onPick) { e.preventDefault(); onPick(p); } setFocused(false); }} className="block px-4 py-3 text-sm hover:bg-accent">{p.personaname ?? `ID ${p.account_id}`}</Link>)}</>}
          {isFetching && !data && <p className="p-4 text-sm text-muted-foreground">Поиск…</p>}
          {data?.length === 0 && <p className="p-4 text-sm text-muted-foreground">Никого не нашли</p>}
          {data?.map((p) => (
            <Link
              key={p.account_id}
              to="/players/$accountId"
              params={{ accountId: String(p.account_id) }}
              onClick={(e) => {
                remember(p);
                if (onPick) { e.preventDefault(); onPick(p); }
                setQ("");
                setFocused(false);
              }}
              className="flex items-center gap-3 border-b border-border px-4 py-3 last:border-0 hover:bg-accent"
            >
              <img src={p.avatarmedium ?? p.avatar} alt="" className="h-9 w-9 rounded" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{p.personaname}</p>
                <p className="text-xs text-muted-foreground">ID {p.account_id}</p>
              </div>
              {p.matches_played_last_30d != null && (
                <span className="text-xs text-muted-foreground">{p.matches_played_last_30d} матчей / 30 дн</span>
              )}
            </Link>
          ))}
        </motion.div>
      )}</AnimatePresence>
    </div>
  );
}
