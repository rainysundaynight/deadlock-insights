import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { toast } from "sonner";

import { useHeroMap } from "@/components/dl";
import { useFollows } from "@/hooks/useAuth";
import { api } from "@/lib/api";

interface Active { match_id: number; players: { account_id: number; hero_id: number }[] }

/** While the site is open, watches live matches for followed players and notifies on start/finish. */
export function FriendNotifier({ userId }: { userId: string }) {
  const follows = useFollows(userId);
  const heroes = useHeroMap();
  const navigate = useNavigate();
  const ids = new Set((follows.data ?? []).map((f) => Number(f.account_id)));
  const names = new Map((follows.data ?? []).map((f) => [Number(f.account_id), f.name ?? `#${f.account_id}`]));
  const active = useQuery({ queryKey: ["active"], queryFn: () => api<Active[]>("/v1/matches/active"), refetchInterval: 60_000, enabled: ids.size > 0 });
  const prev = useRef<Map<number, { match: number; hero: number }> | null>(null);

  useEffect(() => {
    if (!active.data || !ids.size) return;
    const now = new Map<number, { match: number; hero: number }>();
    active.data.forEach((m) => m.players.forEach((p) => { if (ids.has(p.account_id)) now.set(p.account_id, { match: m.match_id, hero: p.hero_id }); }));
    const before = prev.current;
    prev.current = now;
    if (!before) return; // first poll: just remember who's already playing
    const notify = (title: string, body: string, matchId: number) => {
      toast(title, { description: body, action: { label: "Открыть", onClick: () => navigate({ to: "/matches/$matchId", params: { matchId: String(matchId) } }) } });
      if (typeof Notification !== "undefined" && Notification.permission === "granted" && document.hidden) {
        const n = new Notification(title, { body });
        n.onclick = () => { window.focus(); navigate({ to: "/matches/$matchId", params: { matchId: String(matchId) } }); };
      }
    };
    now.forEach((v, id) => { if (before.get(id)?.match !== v.match) notify(`${names.get(id)} начал матч`, `Играет за ${heroes.get(v.hero)?.name ?? "героя"} — можно смотреть live`, v.match); });
    before.forEach((v, id) => { if (!now.has(id)) notify(`${names.get(id)} закончил матч`, "Разбор матча появится через несколько минут", v.match); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active.data]);

  return null;
}
