import { useQuery } from "@tanstack/react-query";

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { RankBadge } from "@/components/dl";
import { api, type MatchHistoryEntry } from "@/lib/api";
import { potentialBadge } from "@/lib/potentialRank";

/** Estimated rank for unranked players, from the ranks of people they were matched with. */
export function PotentialRank({ accountId, history, compact = false }: { accountId: number; history: MatchHistoryEntry[]; compact?: boolean }) {
  const recent = history.slice(0, 15);
  const key = recent.map((m) => m.match_id).join(",");
  const q = useQuery({
    queryKey: ["potential-rank", accountId, key],
    enabled: recent.length > 0,
    staleTime: 1000 * 60 * 30,
    queryFn: async () => {
      const metas = await api<{ players: { account_id: number }[] }[]>("/v1/matches/metadata", { include_player_info: true, match_ids: key, limit: 15 });
      const ids = [...new Set(metas.flatMap((m) => m.players.map((p) => p.account_id)))].filter((x) => x && x !== accountId).slice(0, 100);
      if (!ids.length) return null;
      const ranks = await api<{ badge: number | null }[]>("/v1/players/rank", { account_ids: ids.join(",") });
      const badges = ranks.map((r) => r.badge ?? 0);
      const wr = recent.filter((m) => m.match_result === m.player_team).length / recent.length;
      const shift = Math.max(-3, Math.min(3, Math.round((wr - 0.5) / 0.05)));
      return { badge: potentialBadge(badges, wr), n: badges.filter((b) => b > 10).length, matches: metas.length, wr, shift };
    },
  });
  if (compact) {
    if (!q.data?.badge) return null;
    return (
      <TooltipProvider delayDuration={100}>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="cursor-help opacity-50 transition-opacity hover:opacity-90" aria-label="Потенциальный ранг"><RankBadge badge={q.data.badge} size={44} showName={false} /></span>
          </TooltipTrigger>
          <TooltipContent className="max-w-72 text-xs">
            <p className="font-semibold">Потенциальный ранг (оценка)</p>
            <p className="mt-1">Матчей учтено: {q.data.matches}. Ранговых союзников и соперников: {q.data.n}.</p>
            <p className="mt-1">Основа — медианный ранг этих игроков. Винрейт {Math.round(q.data.wr * 100)}%: каждые 5% выше или ниже 50% сдвигают оценку на одну ступень (не больше ±3).{" "}
              {q.data.shift === 0 ? "Сейчас сдвига нет." : `Сейчас: ${q.data.shift > 0 ? "+" : "−"}${Math.abs(q.data.shift)} ${Math.abs(q.data.shift) === 1 ? "ступень" : "ступени"}.`}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }
  if (!recent.length) return <RankBadge badge={null} size={64} />;
  if (q.isLoading) return <p className="text-sm text-muted-foreground">Считаем потенциальный ранг…</p>;
  if (!q.data?.badge) return <RankBadge badge={null} size={64} />;
  return (
    <div className="flex flex-col items-start gap-1 md:items-end" title={`По рангам ${q.data.n} игроков из последних ${recent.length} матчей и винрейту`}>
      <span className="rounded-full border border-dashed border-primary/50 px-2 py-0.5 text-[10px] uppercase tracking-wider text-primary">Потенциальный ранг</span>
      <RankBadge badge={q.data.badge} size={56} potential />
      <span className="text-[11px] text-muted-foreground">оценка по {q.data.n} соперникам и союзникам</span>
    </div>
  );
}
