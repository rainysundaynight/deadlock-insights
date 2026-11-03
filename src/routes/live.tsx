import { useQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { Eye, RefreshCw } from "lucide-react";
import { useMemo, useState } from "react";

import { Chip, ErrorBox, HeroIcon, Loading, PageHeader } from "@/components/dl";
import { api } from "@/lib/api";
import { fmtAgo, fmtK } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/live")({
  head: () => ({
    meta: [
      { title: "Live матчи Deadlock — игры прямо сейчас" },
      { name: "description", content: "Матчи Deadlock, которые идут прямо сейчас: составы, души команд, зрители." },
      { property: "og:title", content: "Live матчи Deadlock" },
      { property: "og:description", content: "Матчи Deadlock в реальном времени." },
    ],
  }),
  component: LivePage,
});

interface ActiveMatch {
  match_id: number;
  start_time: number;
  spectators: number;
  net_worth_team_0: number;
  net_worth_team_1: number;
  match_mode_parsed: string;
  game_mode_parsed: string;
  region_mode_parsed: string;
  match_score: number;
  players: { account_id: number; team: number; hero_id: number }[];
}

const REGION_RU: Record<string, string> = { europe: "Европа", row: "Америка", south_america: "Юж. Америка", russia: "Россия", oceania: "Океания", asia: "Азия" };

type Kind = "all" | "ranked" | "brawl" | "unranked";
const KINDS: [Kind, string][] = [["all", "Все типы"], ["ranked", "Рейтинговые"], ["unranked", "Обычные"], ["brawl", "Street Brawl"]];
export const kindOf = (m: { match_mode_parsed: string; game_mode_parsed: string }): Exclude<Kind, "all"> =>
  m.game_mode_parsed.includes("StreetBrawl") ? "brawl" : m.match_mode_parsed === "Ranked" ? "ranked" : "unranked";

function LivePage() {
  const [region, setRegion] = useState<string | null>(null);
  const [kind, setKind] = useState<Kind>("all");
  const q = useQuery({ queryKey: ["active"], queryFn: () => api<ActiveMatch[]>("/v1/matches/active"), refetchInterval: 60_000 });
  const regions = useMemo(() => [...new Set((q.data ?? []).map((m) => m.region_mode_parsed))], [q.data]);
  const list = useMemo(
    () => (q.data ?? []).filter((m) => (!region || m.region_mode_parsed === region) && (kind === "all" || kindOf(m) === kind)).sort((a, b) => b.match_score - a.match_score).slice(0, 60),
    [q.data, region, kind],
  );

  return (
    <div>
      <PageHeader eyebrow="Прямо сейчас" title={<span className="inline-flex items-center gap-3"><span className="h-3 w-3 animate-pulse rounded-full bg-loss" /> Live матчи</span>}>
        Топ матчей по рейтингу, которые идут прямо сейчас. Обновляется каждую минуту.
      </PageHeader>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {KINDS.map(([k, l]) => <Chip key={k} active={kind === k} onClick={() => setKind(k)}>{l} {k !== "all" && <span className="text-muted-foreground">{(q.data ?? []).filter((m) => kindOf(m) === k).length}</span>}</Chip>)}
      </div>
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <Chip active={!region} onClick={() => setRegion(null)}>Все регионы</Chip>
        {regions.map((r) => <Chip key={r} active={region === r} onClick={() => setRegion(r)}>{REGION_RU[r] ?? r}</Chip>)}
        <button onClick={() => q.refetch()} className="ml-auto inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary">
          <RefreshCw className={cn("h-4 w-4", q.isFetching && "animate-spin")} /> Обновить
        </button>
      </div>
      {q.isLoading ? <Loading /> : q.error ? <ErrorBox error={q.error} /> : (
        <div className="grid gap-3 lg:grid-cols-2">
          {list.map((m) => {
            const total = m.net_worth_team_0 + m.net_worth_team_1 || 1;
            return (
              <Link key={m.match_id} to="/matches/$matchId" params={{ matchId: String(m.match_id) }} className="panel panel-hover block p-4">
                <div className="mb-3 flex items-center justify-between text-xs text-muted-foreground">
                  <span>#{m.match_id} · {KINDS.find(([k]) => k === kindOf(m))?.[1]} · {REGION_RU[m.region_mode_parsed] ?? m.region_mode_parsed} · начался {fmtAgo(m.start_time)}</span>
                  <span className="inline-flex items-center gap-1"><Eye className="h-3 w-3" />{m.spectators}</span>
                </div>
                {[0, 1].map((t) => (
                  <div key={t} className="mb-2 flex items-center gap-2">
                    <span className={cn("w-16 text-xs uppercase", t === 0 ? "text-amber-team" : "text-sapphire-team")}>{t === 0 ? "Amber" : "Sapphire"}</span>
                    <div className="flex gap-1">
                      {m.players.filter((p) => p.team === t).map((p) => <HeroIcon key={p.account_id} heroId={p.hero_id} size={30} />)}
                    </div>
                    <span className="tabular ml-auto text-sm text-primary">{fmtK(t === 0 ? m.net_worth_team_0 : m.net_worth_team_1)}</span>
                  </div>
                ))}
                <div className="mt-2 flex h-1.5 overflow-hidden rounded-full">
                  <div className="bg-amber-team" style={{ width: `${(m.net_worth_team_0 / total) * 100}%` }} />
                  <div className="flex-1 bg-sapphire-team" />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
