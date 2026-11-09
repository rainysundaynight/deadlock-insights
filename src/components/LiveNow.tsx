import { useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Radio } from "lucide-react";

import { Button } from "@/components/ui/button";
import { HeroIcon, useHeroMap } from "@/components/dl";
import { api } from "@/lib/api";
import { fmtAgo, fmtK } from "@/lib/format";

export interface ActiveMatch {
  match_id: number;
  start_time: number;
  spectators: number;
  net_worth_team_0: number;
  net_worth_team_1: number;
  match_mode_parsed: string;
  game_mode_parsed: string;
  region_mode_parsed: string;
  players: { account_id: number; team: number; hero_id: number }[];
}

/** Баннер «Сейчас в матче»: показывается, если игрок найден в одном из активных live-матчей. */
export function LiveNow({ accountId }: { accountId: number }) {
  const q = useQuery({
    queryKey: ["active"],
    queryFn: () => api<ActiveMatch[]>("/v1/matches/active"),
    refetchInterval: 20_000,
    refetchOnWindowFocus: true,
    staleTime: 15_000,
  });
  const heroes = useHeroMap();
  const qc = useQueryClient();
  const match = (q.data ?? []).find((m) => m.players.some((p) => p.account_id === accountId));
  const prev = useRef<number | null>(null);
  useEffect(() => {
    const now = match?.match_id ?? null;
    // Матч закончился — подтягиваем свежую историю (через минуту ещё раз: API догоняет не сразу).
    if (prev.current && !now) {
      qc.invalidateQueries({ queryKey: ["history", accountId] });
      const t = setTimeout(() => qc.invalidateQueries({ queryKey: ["history", accountId] }), 60_000);
      prev.current = now;
      return () => clearTimeout(t);
    }
    prev.current = now;
  }, [match?.match_id, accountId, qc]);
  if (!match) return null;
  const me = match.players.find((p) => p.account_id === accountId)!;
  const hero = heroes.get(me.hero_id);
  const mySouls = me.team === 0 ? match.net_worth_team_0 : match.net_worth_team_1;
  const foeSouls = me.team === 0 ? match.net_worth_team_1 : match.net_worth_team_0;
  const mode = match.game_mode_parsed.includes("StreetBrawl") ? "Street Brawl" : match.match_mode_parsed === "Ranked" ? "Рейтинговый" : "Обычный";

  return (
    <section className="relative overflow-hidden border border-telemetry/50 bg-card/70" aria-label="Игрок сейчас в матче">
      <div className="h-0.5 bg-telemetry/70" />
      <div className="flex flex-wrap items-center gap-4 p-4 sm:p-5">
        <span className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-widest text-telemetry">
          <Radio className="h-3.5 w-3.5 animate-pulse" /> Сейчас в матче
        </span>
        <div className="flex items-center gap-3">
          <HeroIcon heroId={me.hero_id} size={44} />
          <div>
            <p className="font-display text-lg font-bold leading-tight">{hero?.name ?? "Герой"}</p>
            <p className="text-xs text-muted-foreground">
              {mode} · {fmtAgo(match.start_time)} · {match.spectators} зрит.
            </p>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-4">
          <p className="font-mono text-sm">
            <span className={mySouls >= foeSouls ? "text-win" : "text-loss"}>{fmtK(mySouls)}</span>
            <span className="mx-1.5 text-muted-foreground">:</span>
            <span className="text-muted-foreground">{fmtK(foeSouls)}</span>
          </p>
          <Button asChild size="sm">
            <Link to="/matches/$matchId" params={{ matchId: String(match.match_id) }} search={{ from: "/live" }}>
              Перейти к лобби →
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
