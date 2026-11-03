import { useQuery } from "@tanstack/react-query";
import { Pause, Play } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { HeroIcon, useHeroMap } from "@/components/dl";
import { api } from "@/lib/api";
import { fmtDuration } from "@/lib/format";
import { cn } from "@/lib/utils";

export interface MatchPath {
  player_slot: number; x_min: number; y_min: number; x_max: number; y_max: number;
  x_pos: number[]; y_pos: number[]; health?: number[];
}
export interface MatchPaths { interval_s: number; x_resolution: number; y_resolution: number; paths: MatchPath[] }
export interface MatchObjective { destroyed_time_s: number; team_objective_id: number; team: number }
interface P { player_slot: number; team: number; hero_id: number; death_details?: { game_time_s: number; death_pos: { x: number; y: number } }[] }

type Rel = { left_relative: number; top_relative: number };
interface MapData {
  radius: number;
  images: { minimap: string; frame?: string };
  objective_positions: Record<string, Rel>;
  zipline_paths: { origin: number[]; color: string; P0_points: number[][] }[];
  neutral_camps: (Rel & { kind: string; name: string })[];
  entities: Record<string, (Rel & { kind?: string; team?: number })[]>;
}
const mapQuery = { queryKey: ["map-assets"], queryFn: () => api<MapData>("/v1/assets/map"), staleTime: Infinity };

const S = 1000;
// objective id (ECitadelTeamObjective) → position key suffix
const OBJ_KEY: Record<number, string> = { 0: "core", 1: "tier1_1", 3: "tier1_3", 4: "tier1_4", 5: "tier2_1", 7: "tier2_3", 8: "tier2_4", 9: "titan" };

type Layer = "zip" | "camps" | "obj" | "buffs" | "shops" | "move";
const LAYERS: [Layer, string][] = [["obj", "Башни"], ["zip", "Зиплайны"], ["camps", "Лагеря"], ["buffs", "Урна · рифт · баффы"], ["shops", "Магазины"], ["move", "Тропы"]];

export function MatchReplay({ paths, players, names, objectives, midBoss }: {
  paths?: MatchPaths | undefined; players: P[]; names?: Map<number, { personaname: string }> | undefined;
  objectives?: MatchObjective[]; midBoss?: { team_killed: number; destroyed_time_s: number }[];
}) {
  const heroes = useHeroMap();
  const map = useQuery(mapQuery);
  const R = map.data?.radius ?? 10752;
  const toSvg = (x: number, y: number) => [((x + R) / (2 * R)) * S, ((R - y) / (2 * R)) * S] as const;
  const rel = (r: Rel) => [r.left_relative * S, r.top_relative * S] as const;

  const len = Math.max(0, ...(paths?.paths ?? []).map((p) => p.x_pos.length));
  const [t, setT] = useState(0);
  const [play, setPlay] = useState(false);
  const [speed, setSpeed] = useState(8);
  const [layers, setLayers] = useState<Set<Layer>>(new Set(["obj", "zip", "camps", "buffs"]));
  const on = (l: Layer) => layers.has(l);

  useEffect(() => {
    if (!play) return;
    const iv = setInterval(() => setT((v) => (v + speed >= len - 1 ? (setPlay(false), len - 1) : v + speed)), 100);
    return () => clearInterval(iv);
  }, [play, speed, len]);

  const world = useMemo(() => {
    if (!paths) return null;
    return paths.paths.map((p) => {
      const pts: [number, number][] = p.x_pos.map((xp, i) => {
        const x = p.x_min + (xp / paths.x_resolution) * (p.x_max - p.x_min);
        const y = p.y_min + ((p.y_pos[i] ?? 0) / paths.y_resolution) * (p.y_max - p.y_min);
        return [((x + R) / (2 * R)) * S, ((R - y) / (2 * R)) * S];
      });
      return { slot: p.player_slot, pts, health: p.health };
    });
  }, [paths, R]);

  if (!world || !len) return <div className="panel p-6 text-sm text-muted-foreground">Для этого матча нет данных о передвижении игроков.</div>;
  const bySlot = new Map(players.map((p) => [p.player_slot, p]));
  const sec = t * (paths!.interval_s || 1);
  const deaths = players.flatMap((p) => (p.death_details ?? []).filter((d) => d.game_time_s <= sec && d.game_time_s > sec - 20).map((d) => ({ ...d, team: p.team })));
  const destroyed = new Map<string, number>();
  for (const o of objectives ?? []) { const k = OBJ_KEY[o.team_objective_id]; if (k && o.destroyed_time_s) destroyed.set(`team${o.team}_${k}`, o.destroyed_time_s); }
  const md = map.data;
  const bossDead = (midBoss ?? []).filter((b) => b.destroyed_time_s <= sec);
  const teamCol = (team: number) => (team === 0 ? "var(--team-amber)" : "var(--team-sapphire)");

  const objEvents = [
    ...(objectives ?? []).filter((o) => OBJ_KEY[o.team_objective_id] && o.destroyed_time_s).map((o) => ({ t: o.destroyed_time_s, team: o.team, text: `${o.team === 0 ? "Амбер" : "Сапфир"} теряет ${objName(OBJ_KEY[o.team_objective_id])}` })),
    ...(midBoss ?? []).map((b) => ({ t: b.destroyed_time_s, team: b.team_killed, text: `${b.team_killed === 0 ? "Амбер" : "Сапфир"} убивает Мид-босса` })),
  ].sort((a, b) => a.t - b.t);

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
      <div className="panel p-3">
        <div className="mb-3 flex flex-wrap gap-1.5">
          {LAYERS.map(([k, l]) => (
            <button key={k} onClick={() => setLayers((s) => { const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n; })}
              className={cn("rounded-full border px-3 py-1 text-xs", on(k) ? "border-primary/60 bg-primary/15 text-primary" : "border-border text-muted-foreground")}>{l}</button>
          ))}
        </div>
        <div className="relative overflow-hidden rounded-xl bg-background">
          <svg viewBox={`0 0 ${S} ${S}`} className="aspect-square w-full">
            {md && <image href={md.images.minimap} x={0} y={0} width={S} height={S} opacity={0.95} />}
            {on("move") && world.map((w) => {
              const p = bySlot.get(w.slot);
              return <polyline key={w.slot} points={w.pts.slice(0, t + 1).filter((_, i) => i % 3 === 0).map((q) => q.join(",")).join(" ")} fill="none" stroke={p ? teamCol(p.team) : "white"} strokeOpacity={0.35} strokeWidth={2} />;
            })}
            {md && on("zip") && md.zipline_paths.map((z, i) => (
              <polyline key={i} points={z.P0_points.map((pt) => toSvg(z.origin[0] + pt[0], z.origin[1] + pt[1]).join(",")).join(" ")}
                fill="none" stroke={z.color} strokeWidth={3} strokeOpacity={0.85} strokeDasharray="10 5" />
            ))}
            {md && on("camps") && md.neutral_camps.map((c, i) => {
              const [x, y] = rel(c);
              const r = c.kind === "strong" ? 9 : c.kind === "vault" ? 8 : c.kind === "medium" ? 7 : 5;
              return c.kind === "vault"
                ? <rect key={i} x={x - r} y={y - r} width={r * 2} height={r * 2} transform={`rotate(45 ${x} ${y})`} fill="oklch(0.8 0.15 85)" stroke="black" strokeWidth={1.5}><title>Хранилище</title></rect>
                : <circle key={i} cx={x} cy={y} r={r} fill={c.kind === "strong" ? "oklch(0.65 0.2 25)" : c.kind === "medium" ? "oklch(0.75 0.15 60)" : "oklch(0.8 0.08 130)"} stroke="black" strokeWidth={1.5}><title>Лагерь: {c.kind}</title></circle>;
            })}
            {md && on("shops") && (md.entities.shops ?? []).map((s, i) => { const [x, y] = rel(s); return <g key={i}><rect x={x - 8} y={y - 8} width={16} height={16} rx={3} fill={s.kind === "secret" ? "oklch(0.7 0.2 300)" : "oklch(0.8 0.14 160)"} stroke="black" strokeWidth={1.5} /><text x={x} y={y + 4} fontSize={11} textAnchor="middle" fill="black" fontWeight={700}>$</text><title>{s.kind === "secret" ? "Тайный магазин" : "Магазин"}</title></g>; })}
            {md && on("buffs") && <>
              {(md.entities.bridge_buffs ?? []).map((b, i) => { const [x, y] = rel(b); return <Marker key={`b${i}`} x={x} y={y} c="oklch(0.85 0.17 95)" label="Бафф моста" short="B" />; })}
              {(md.entities.unstable_rifts ?? []).map((b, i) => { const [x, y] = rel(b); return <Marker key={`r${i}`} x={x} y={y} c="oklch(0.65 0.25 310)" label="Нестабильный рифт" short="R" />; })}
              {(md.entities.soul_urn_pads ?? []).map((b, i) => { const [x, y] = rel(b); return <Marker key={`u${i}`} x={x} y={y} c="oklch(0.75 0.15 200)" label="Урна душ (точка сдачи)" short="U" />; })}
              {(md.entities.teleporters ?? []).map((b, i) => { const [x, y] = rel(b); return <Marker key={`t${i}`} x={x} y={y} c="oklch(0.7 0.12 250)" label="Телепорт" short="T" small />; })}
              <g opacity={bossDead.length ? 0.45 : 1}><Marker x={S / 2} y={S / 2} c="oklch(0.6 0.22 20)" label="Мид-босс" short="M" big /></g>
            </>}
            {md && on("obj") && Object.entries(md.objective_positions).map(([k, r]) => {
              const [x, y] = rel(r);
              const team = k.startsWith("team0") ? 0 : 1;
              const dt = destroyed.get(k);
              const dead = dt != null && dt <= sec;
              const size = k.includes("core") ? 14 : k.includes("titan") ? 12 : k.includes("tier2") ? 10 : 8;
              return <g key={k} opacity={dead ? 0.35 : 1}>
                <polygon points={`${x},${y - size} ${x + size},${y} ${x},${y + size} ${x - size},${y}`} fill={dead ? "var(--muted)" : teamCol(team)} stroke="black" strokeWidth={2} />
                {dead && <text x={x} y={y + 5} fontSize={14} textAnchor="middle" fill="var(--loss)" fontWeight={700}>✕</text>}
                <title>{objName(k.replace(/^team\d_/, ""))}{dt ? ` · разрушена ${fmtDuration(dt)}` : ""}</title>
              </g>;
            })}
            {deaths.map((d, i) => { const [x, y] = toSvg(d.death_pos.x, d.death_pos.y); return <text key={i} x={x} y={y} fontSize={26} textAnchor="middle" fill="var(--loss)" stroke="black" strokeWidth={1}>✕</text>; })}
            {world.map((w) => {
              const p = bySlot.get(w.slot); if (!p) return null;
              const idx = Math.min(t, w.pts.length - 1);
              const pt = w.pts[idx]; if (!pt) return null;
              const hp = w.health?.[idx] ?? 100;
              const img = heroes.get(p.hero_id)?.images.icon_image_small_webp ?? heroes.get(p.hero_id)?.images.icon_image_small;
              const col = teamCol(p.team);
              return (
                <g key={w.slot} opacity={hp <= 0 ? 0.25 : 1} style={{ transition: "transform 100ms linear" }} transform={`translate(${pt[0]},${pt[1]})`}>
                  <circle r={21} fill="var(--card)" stroke={col} strokeWidth={4} />
                  {img && <image href={img} x={-17} y={-17} width={34} height={34} clipPath="circle(17px)" />}
                  <rect x={-20} y={24} width={40} height={5} rx={2} fill="black" /><rect x={-20} y={24} width={(40 * Math.max(0, hp)) / 100} height={5} rx={2} fill={col} />
                </g>
              );
            })}
          </svg>
          {!md && <div className="absolute inset-0 grid place-items-center text-sm text-muted-foreground">Загрузка карты…</div>}
        </div>
        <div className="mt-3 flex items-center gap-3">
          <button onClick={() => setPlay((v) => !v)} className="grid h-9 w-9 place-items-center rounded-full bg-primary text-primary-foreground">{play ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}</button>
          <input type="range" min={0} max={len - 1} value={t} onChange={(e) => setT(+e.target.value)} className="flex-1 accent-[var(--primary)]" />
          <span className="tabular w-14 text-sm">{fmtDuration(sec)}</span>
          <select value={speed} onChange={(e) => setSpeed(+e.target.value)} className="rounded-md border border-border bg-secondary px-2 py-1 text-xs">
            {[2, 8, 20, 50].map((s) => <option key={s} value={s}>×{s * 10}</option>)}
          </select>
        </div>
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
          <span>◆ башни (серые — разрушены)</span><span>B — бафф моста</span><span>R — рифт</span><span>U — урна</span><span>M — мид-босс</span><span>T — телепорт</span><span>● лагеря (красный — сильный)</span><span>◆ жёлтый — хранилище</span><span>пунктир — зиплайны</span>
        </div>
      </div>
      <div className="space-y-4">
        <div className="panel space-y-1 p-3 text-sm">
          <p className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">Игроки</p>
          {players.map((p) => {
            const w = world.find((x) => x.slot === p.player_slot);
            const hp = w?.health?.[Math.min(t, (w?.pts.length ?? 1) - 1)] ?? 100;
            return (
              <div key={p.player_slot} className={cn("flex items-center gap-2", hp <= 0 && "opacity-40")}>
                <HeroIcon heroId={p.hero_id} size={24} className={p.team === 0 ? "border-amber-team" : "border-sapphire-team"} />
                <span className="truncate">{names?.get((p as unknown as { account_id: number }).account_id)?.personaname ?? heroes.get(p.hero_id)?.name}</span>
                {hp <= 0 && <span className="ml-auto text-xs text-loss">мёртв</span>}
              </div>
            );
          })}
        </div>
        {objEvents.length > 0 && (
          <div className="panel max-h-80 space-y-1 overflow-auto p-3 text-xs">
            <p className="mb-2 uppercase tracking-wider text-muted-foreground">Объекты</p>
            {objEvents.map((e, i) => (
              <button key={i} onClick={() => setT(Math.round(e.t / (paths!.interval_s || 1)))} className={cn("flex w-full items-center gap-2 rounded px-1 py-0.5 text-left hover:bg-secondary", e.t > sec && "opacity-40")}>
                <span className="tabular w-10 text-muted-foreground">{fmtDuration(e.t)}</span>
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: teamCol(e.team) }} />
                <span>{e.text}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Marker({ x, y, c, label, short, big, small }: { x: number; y: number; c: string; label: string; short: string; big?: boolean; small?: boolean }) {
  const r = big ? 18 : small ? 8 : 12;
  return <g><circle cx={x} cy={y} r={r} fill={c} stroke="black" strokeWidth={2} /><text x={x} y={y + r * 0.4} fontSize={r * 1.1} textAnchor="middle" fill="black" fontWeight={800}>{short}</text><title>{label}</title></g>;
}

function objName(k: string) {
  if (k === "core") return "Патрон (базу)";
  if (k === "titan") return "Титана";
  const [tier, lane] = k.split("_").length === 2 ? k.split("_") : [k, ""];
  return `${tier === "tier1" ? "Стража" : "Хранителя"} (линия ${lane})`;
}
