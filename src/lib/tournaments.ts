import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

import { supabase } from "@/integrations/supabase/client";

export const T_COLS = "id, owner_id, name, mode, format, max_slots, starts_at, rules, status, random_heroes, same_random_hero, blind_builds, created_at";
export const FORMAT_LABEL: Record<string, string> = { single: "Single elimination", double: "Double elimination", round_robin: "Круговая" };
export const STATUS_LABEL: Record<string, string> = { registration: "Регистрация", running: "Идёт", finished: "Завершён" };

export function useTournaments() {
  return useQuery({
    queryKey: ["tournaments"],
    queryFn: async () => {
      const { data, error } = await supabase.from("tournaments").select(T_COLS).order("created_at", { ascending: false }).limit(100);
      if (error) throw error;
      const { data: parts } = await supabase.from("tournament_participants").select("tournament_id");
      const counts = new Map<string, number>();
      for (const p of parts ?? []) counts.set(p.tournament_id, (counts.get(p.tournament_id) ?? 0) + 1);
      return (data ?? []).map((t) => ({ ...t, players: counts.get(t.id) ?? 0 }));
    },
  });
}

export function useTournament(id: string) {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["tournament", id],
    queryFn: async () => {
      const [t, teams, parts, matches] = await Promise.all([
        supabase.from("tournaments").select(T_COLS).eq("id", id).maybeSingle(),
        supabase.from("tournament_teams").select("id, tournament_id, name, captain_id, created_at").eq("tournament_id", id).order("created_at"),
        supabase.from("tournament_participants").select("*").eq("tournament_id", id).order("created_at"),
        supabase.from("tournament_matches").select("*").eq("tournament_id", id).order("round").order("idx"),
      ]);
      if (t.error) throw t.error;
      return { t: t.data, teams: teams.data ?? [], parts: parts.data ?? [], matches: matches.data ?? [] };
    },
  });
  useEffect(() => {
    const ch = supabase.channel(`t-${id}-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "tournament_matches", filter: `tournament_id=eq.${id}` }, () => qc.invalidateQueries({ queryKey: ["tournament", id] }))
      .on("postgres_changes", { event: "*", schema: "public", table: "tournament_participants", filter: `tournament_id=eq.${id}` }, () => qc.invalidateQueries({ queryKey: ["tournament", id] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [id, qc]);
  return q;
}

export type TData = NonNullable<ReturnType<typeof useTournament>["data"]>;

/** Display name for a bracket side (team for 6x6, player for 1x1). */
export function sideName(d: TData, sideId: string | null, bye = false) {
  if (!sideId) return bye ? "— пропуск —" : "Ожидание";
  if (d.t?.mode === "6x6") return d.teams.find((x) => x.id === sideId)?.name ?? "Команда";
  return d.parts.find((x) => x.id === sideId)?.persona_name ?? "Игрок";
}
export function errMsg(e: unknown) { return e instanceof Error ? e.message : "Ошибка"; }
