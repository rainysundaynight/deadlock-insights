import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { useEffect, useState } from "react";

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

export function PlayerSearch({ autoFocus }: { autoFocus?: boolean }) {
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
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
    if (id) navigate({ to: "/players/$accountId", params: { accountId: String(id) } });
    else if (data?.[0]) navigate({ to: "/players/$accountId", params: { accountId: String(data[0].account_id) } });
  };

  return (
    <div className="relative w-full">
      <form onSubmit={onSubmit} className="relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
        <input
          autoFocus={autoFocus}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Ник в Steam, Steam ID или ссылка на профиль"
          className={`${inputClass} h-14 pl-12 text-base`}
        />
      </form>
      {debounced.length >= 2 && (
        <div className="panel absolute z-30 mt-2 w-full overflow-hidden shadow-2xl">
          {isFetching && !data && <p className="p-4 text-sm text-muted-foreground">Поиск…</p>}
          {data?.length === 0 && <p className="p-4 text-sm text-muted-foreground">Никого не нашли</p>}
          {data?.map((p) => (
            <Link
              key={p.account_id}
              to="/players/$accountId"
              params={{ accountId: String(p.account_id) }}
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
        </div>
      )}
    </div>
  );
}
