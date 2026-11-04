import { useQuery } from "@tanstack/react-query";
import { Map as MapIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { useHeroMap } from "@/components/dl";
import { API, api } from "@/lib/api";
import type { LivePlayer } from "@/lib/liveStream";

const QUERY = `SELECT entity_index, "m_iTeamNum" AS team, "m_hController" AS ctl, "m_iHealth" AS hp, "m_iMaxHealth" AS mhp,
"CBodyComponent__m_cellX" AS cx, "CBodyComponent__m_cellY" AS cy, "CBodyComponent__m_vecX" AS vx, "CBodyComponent__m_vecY" AS vy
FROM CCitadelPlayerPawn WHERE "m_iTeamNum" IN (2, 3)`;

interface Pawn { team?: number; ctl?: number; hp?: number; mhp?: number; cx?: number; cy?: number; vx?: number; vy?: number }
const S = 1000;
// Source 2 world coordinate: 512-unit cells offset by half the grid.
const world = (cell = 0, v = 0) => cell * 512 - 32768 + v;

/** Live positions of every hero on the real minimap. Opens its own broadcast connection. */
export function LiveMap({ matchId, players }: { matchId: number; players: LivePlayer[] }) {
  const heroes = useHeroMap();
  const [attempt, setAttempt] = useState(0);
  const [pawns, setPawns] = useState<[number, Pawn][]>([]);
  const [err, setErr] = useState("");
  const [stale, setStale] = useState(false);
  const map = useQuery({ queryKey: ["map-assets"], queryFn: () => api<{ radius: number; images: { minimap: string } }>("/v1/assets/map"), staleTime: Infinity });
  const store = useRef(new Map<number, Pawn>());

  useEffect(() => {
    setErr(""); setStale(false); store.current.clear(); setPawns([]);
    let last = Date.now();
    const es = new EventSource(`${API}/v1/matches/demo/live/query?${new URLSearchParams({ query: QUERY, match_id: String(matchId) })}`);
    es.onmessage = (e) => {
      last = Date.now();
      const r = JSON.parse(e.data) as Pawn & { entity_index: number };
      if (r.entity_index == null) return;
      const prev = store.current.get(r.entity_index) ?? {};
      const next = { ...prev };
      for (const [k, v] of Object.entries(r)) if (v != null) (next as Record<string, unknown>)[k] = v;
      store.current.set(r.entity_index, next);
    };
    es.addEventListener("error", (e) => {
      const d = (e as MessageEvent).data;
      if (d) setErr(String(d).slice(0, 160));
      else if (es.readyState === EventSource.CLOSED) setErr("Трансляция закрыла соединение");
      if (d) es.close();
    });
    const iv = setInterval(() => {
      setPawns([...store.current.entries()]);
      setStale(Date.now() - last > 15000);
    }, 400);
    return () => { clearInterval(iv); es.close(); };
  }, [matchId, attempt]);

  const R = map.data?.radius ?? 10752;
  const byEntity = new Map(players.map((p) => [p.entity_index, p]));
  // Ignore placeholder pawns that no player controls (they sit in the spawn).
  const live = pawns.filter(([, p]) => p.cx != null && p.cy != null && p.ctl != null && p.ctl !== 16777215);
  const count = (t: number) => live.filter(([, p]) => p.team === t && (p.hp ?? 1) > 0).length;
  return (
    <section className="panel overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
        <p className="flex items-center gap-2 font-display text-sm uppercase tracking-wider">
          <MapIcon className="h-4 w-4 text-primary" /> Live-карта
          {live.length > 0 && !stale && <span className="flex items-center gap-1 text-[11px] text-loss"><span className="h-2 w-2 animate-pulse rounded-full bg-loss" />LIVE</span>}
        </p>
        <div className="flex items-center gap-3 text-xs">
          <span className="text-amber-team">Амбер · живы {count(2)}</span>
          <span className="text-sapphire-team">Сапфир · живы {count(3)}</span>
          {(err || stale) && <button onClick={() => setAttempt((a) => a + 1)} className="rounded-full border border-border px-3 py-1 hover:border-primary hover:text-primary">Переподключить</button>}
        </div>
      </div>
      <div className="relative mx-auto aspect-square w-full max-w-[720px] bg-background">
        <svg viewBox={`0 0 ${S} ${S}`} className="absolute inset-0 h-full w-full">
          {map.data && <image href={map.data.images.minimap} x={0} y={0} width={S} height={S} opacity={0.95} />}
          {live.map(([id, p]) => {
            const x = ((world(p.cx, p.vx) + R) / (2 * R)) * S;
            const y = ((R - world(p.cy, p.vy)) / (2 * R)) * S;
            const owner = byEntity.get((p.ctl ?? 0) & 0x3fff);
            const dead = (p.hp ?? 1) <= 0;
            const col = p.team === 2 ? "var(--team-amber)" : "var(--team-sapphire)";
            const hpPct = p.mhp ? Math.max(0, Math.min(1, (p.hp ?? 0) / p.mhp)) : 1;
            const h = owner ? heroes.get(owner.hero) : undefined;
            const img = h?.images.icon_image_small_webp ?? h?.images.icon_image_small;
            return (
              <g key={id} transform={`translate(${x} ${y})`} opacity={dead ? 0.3 : 1} style={{ transition: "transform 0.4s linear" }}>
                <title>{owner ? `${owner.name} · ${h?.name ?? ""}` : "Герой"}{dead ? " · мёртв" : ""}</title>
                <circle r={21} fill="var(--card)" stroke={col} strokeWidth={4} />
                {img && <image href={img} x={-17} y={-17} width={34} height={34} clipPath="circle(17px)" />}
                {dead && <text y={7} textAnchor="middle" fontSize={22} fontWeight={800} fill="var(--loss)">✕</text>}
                <rect x={-20} y={24} width={40} height={5} rx={2} fill="black" />
                <rect x={-20} y={24} width={40 * hpPct} height={5} rx={2} fill={col} />
              </g>
            );
          })}
        </svg>
        {!live.length && (
          <div className="absolute inset-0 grid place-items-center bg-background/40 p-6 text-center">
            <p className="max-w-sm rounded-lg border border-border bg-card/90 px-4 py-3 text-sm text-muted-foreground">
              {err ? <>Не удалось получить позиции: {err}. Трансляцию можно смотреть ограниченное число раз в час — попробуйте позже.</> : "Подключаемся к трансляции… позиции героев появятся через несколько секунд."}
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
