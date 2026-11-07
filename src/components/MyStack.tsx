import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";

import { useAuth, useFollows } from "@/hooks/useAuth";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

interface Active { match_id: number; players: { account_id: number; hero_id: number }[] }

/** Sidebar quick list of followed players with an «в игре» marker from active matches. */
export function MyStack({ onNavigate }: { onNavigate?: (() => void) | undefined }) {
  const { user } = useAuth();
  const follows = useFollows(user?.id);
  const list = follows.data ?? [];
  const active = useQuery({ queryKey: ["active"], queryFn: () => api<Active[]>("/v1/matches/active"), refetchInterval: 60_000, enabled: list.length > 0 });
  if (!user || !list.length) return null;
  const playing = new Map<number, number>();
  active.data?.forEach((m) => m.players.forEach((p) => playing.set(p.account_id, m.match_id)));
  const sorted = [...list].sort((a, b) => Number(playing.has(Number(b.account_id))) - Number(playing.has(Number(a.account_id))));
  return (
    <div>
      <p className="mb-2 flex items-center justify-between border-b border-border px-3 pb-2 font-masthead text-[10px] font-semibold uppercase text-primary">
        Мой стак<span className="font-mono text-muted-foreground">{playing.size ? [...list].filter((f) => playing.has(Number(f.account_id))).length : 0} в игре</span>
      </p>
      <div className="space-y-0.5">
        {sorted.slice(0, 8).map((f) => {
          const id = Number(f.account_id);
          const match = playing.get(id);
          const cls = "flex min-w-0 items-center gap-2.5 px-3 py-1 text-sm text-muted-foreground hover:text-foreground";
          const body = (<>
            <span className={cn("h-2 w-2 shrink-0 rounded-full", match ? "animate-pulse bg-telemetry" : "bg-muted")} />
            <span className="min-w-0 flex-1 truncate">{f.name ?? `#${id}`}</span>
            {match && <span className="font-mono text-[9px] uppercase text-telemetry">live</span>}
          </>);
          return match
            ? <Link key={id} to="/matches/$matchId" params={{ matchId: String(match) }} onClick={onNavigate} className={cls}>{body}</Link>
            : <Link key={id} to="/players/$accountId" params={{ accountId: String(id) }} onClick={onNavigate} className={cls}>{body}</Link>;
        })}
        {list.length > 8 && <Link to="/me" onClick={onNavigate} className="block px-3 py-1 text-xs text-primary">Все ({list.length}) →</Link>}
      </div>
    </div>
  );
}
