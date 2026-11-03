import { useQuery } from "@tanstack/react-query";
import { Map as MapIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { HeroIcon } from "@/components/dl";
import { API, api } from "@/lib/api";
import type { LivePlayer } from "@/lib/liveStream";

const QUERY = `SELECT entity_index, "m_iTeamNum" AS team, "m_hController" AS ctl, "m_iHealth" AS hp, "m_iMaxHealth" AS mhp,
"CBodyComponent__m_cellX" AS cx, "CBodyComponent__m_cellY" AS cy, "CBodyComponent__m_vecX" AS vx, "CBodyComponent__m_vecY" AS vy
FROM CCitadelPlayerPawn WHERE "m_iTeamNum" IN (2, 3)`;

interface Pawn { team?: number; ctl?: number; hp?: number; mhp?: number; cx?: number; cy?: number; vx?: number; vy?: number }
const S = 1000;
// Source 2 world coordinate: 512-unit cells offset by half the grid.
const world = (cell = 0, v = 0) => cell * 512 - 32768 + v;

/** Live positions of every hero on the real minimap. Opt-in: opens its own (rate-limited) broadcast connection. */
export function LiveMap({ matchId, players }: { matchId: number; players: LivePlayer[] }) {
  const [on, setOn] = useState(false);
  const [pawns, setPawns] = useState<[number, Pawn][]>([]);
  const [err, setErr] = useState("");
  const map = useQuery({ queryKey: ["map-assets"], queryFn: () => api<{ radius: number; images: { minimap: string } }>("/v1/assets/map"), staleTime: Infinity });
  const store = useRef(new Map<number, Pawn>());

  useEffect(() => {
    if (!on) return;
    const es = new EventSource(`${API}/v1/matches/demo/live/query?${new URLSearchParams({ query: QUERY, match_id: String(matchId) })}`);
    es.onmessage = (e) => {
      const r = JSON.parse(e.data) as Pawn & { entity_index: number };
      if (r.entity_index == null) return;
      const prev = store.current.get(r.entity_index) ?? {};
      const next = { ...prev };
      for (const [k, v] of Object.entries(r)) if (v != null) (next as Record<string, unknown>)[k] = v;
      store.current.set(r.entity_index, next);
    };
    es.addEventListener("error", (e) => { const d = (e as MessageEvent).data; if (d) { setErr(String(d).slice(0, 120)); es.close(); } });
    const iv = setInterval(() => setPawns([...store.current.entries()]), 500);
    return () => { clearInterval(iv); es.close(); };
  }, [on, matchId]);

  if (!on)
    return (
      <button onClick={() => setOn(true)} className="panel panel-hover flex w-full items-center justify-center gap-2 p-4 text-sm font-medium text-primary">
        <MapIcon className="h-4 w-4" /> Открыть live-карту (отдельное подключение к трансляции)
      </button>
    );

  const R = map.data?.radius ?? 10752;
  const byEntity = new Map(players.map((p) => [p.entity_index, p]));
  return (
    <div className="panel p-4">
      <p className="mb-3 text-xs uppercase tracking-wider text-muted-foreground">Live-карта</p>
      {err && <p className="mb-2 text-sm text-loss">Не удалось подключиться: {err}</p>}
      <div className="relative mx-auto aspect-square w-full max-w-[640px] overflow-hidden rounded-lg bg-secondary">
        {map.data && <img src={map.data.images.minimap} alt="Карта Deadlock" className="absolute inset-0 h-full w-full opacity-80" />}
        <svg viewBox={`0 0 ${S} ${S}`} className="absolute inset-0 h-full w-full">
          {pawns.map(([id, p]) => {
            if (p.cx == null || p.cy == null) return null;
            const x = ((world(p.cx, p.vx) + R) / (2 * R)) * S;
            const y = ((R - world(p.cy, p.vy)) / (2 * R)) * S;
            const owner = p.ctl != null ? byEntity.get(p.ctl & 0x3fff) : undefined;
            const dead = (p.hp ?? 1) <= 0;
            const col = p.team === 2 ? "var(--team-amber)" : "var(--team-sapphire)";
            const hpPct = p.mhp ? Math.max(0, Math.min(1, (p.hp ?? 0) / p.mhp)) : 1;
            return (
              <g key={id} transform={`translate(${x} ${y})`} opacity={dead ? 0.35 : 1} style={{ transition: "transform 0.5s linear" }}>
                <circle r={22} fill="none" stroke={col} strokeWidth={4} />
                <foreignObject x={-18} y={-18} width={36} height={36}>
                  {owner ? <HeroIcon heroId={owner.hero} size={36} /> : <div style={{ width: 36, height: 36, borderRadius: 999, background: col }} />}
                </foreignObject>
                <rect x={-20} y={26} width={40} height={5} fill="rgba(0,0,0,.6)" />
                <rect x={-20} y={26} width={40 * hpPct} height={5} fill={hpPct > 0.4 ? "var(--win)" : "var(--loss)"} />
              </g>
            );
          })}
        </svg>
        {!pawns.length && !err && <p className="absolute inset-x-0 bottom-3 text-center text-sm text-muted-foreground">Подключаемся…</p>}
      </div>
    </div>
  );
}
