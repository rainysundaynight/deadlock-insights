import { Pause, Play } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { HeroIcon, useHeroMap } from "@/components/dl";
import { fmtDuration } from "@/lib/format";
import { cn } from "@/lib/utils";

export interface MatchPath {
  player_slot: number; x_min: number; y_min: number; x_max: number; y_max: number;
  x_pos: number[]; y_pos: number[]; health?: number[];
}
export interface MatchPaths { interval_s: number; x_resolution: number; y_resolution: number; paths: MatchPath[] }
interface P { player_slot: number; team: number; hero_id: number; death_details?: { game_time_s: number; death_pos: { x: number; y: number } }[] }

const R = 10800; // world half-size
const S = 1000;
const toSvg = (x: number, y: number) => [((x + R) / (2 * R)) * S, S - ((y + R) / (2 * R)) * S] as const;

export function MatchReplay({ paths, players, names }: { paths?: MatchPaths; players: P[]; names?: Map<number, { personaname: string }> }) {
  const heroes = useHeroMap();
  const len = Math.max(0, ...(paths?.paths ?? []).map((p) => p.x_pos.length));
  const [t, setT] = useState(0);
  const [play, setPlay] = useState(false);
  const [speed, setSpeed] = useState(8);

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
        const y = p.y_min + (p.y_pos[i] / paths.y_resolution) * (p.y_max - p.y_min);
        return toSvg(x, y) as [number, number];
      });
      return { slot: p.player_slot, pts, health: p.health };
    });
  }, [paths]);

  // Faint background "map" built from everyone's movement
  const bg = useMemo(() => (world ?? []).flatMap((w) => w.pts.filter((_, i) => i % 6 === 0)), [world]);

  if (!world || !len) return <div className="panel p-6 text-sm text-muted-foreground">Для этого матча нет данных о передвижении игроков.</div>;
  const bySlot = new Map(players.map((p) => [p.player_slot, p]));
  const sec = t * (paths!.interval_s || 1);
  const deaths = players.flatMap((p) => (p.death_details ?? []).filter((d) => d.game_time_s <= sec && d.game_time_s > sec - 20).map((d) => ({ ...d, team: p.team })));

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
      <div className="panel p-3">
        <svg viewBox={`0 0 ${S} ${S}`} className="aspect-square w-full rounded-lg bg-background">
          {bg.map(([x, y], i) => <rect key={i} x={x} y={y} width={3} height={3} fill="var(--muted-foreground)" opacity={0.08} />)}
          {deaths.map((d, i) => { const [x, y] = toSvg(d.death_pos.x, d.death_pos.y); return <text key={i} x={x} y={y} fontSize={22} textAnchor="middle" fill="var(--loss)">✕</text>; })}
          {world.map((w) => {
            const p = bySlot.get(w.slot); if (!p) return null;
            const pt = w.pts[Math.min(t, w.pts.length - 1)]; if (!pt) return null;
            const hp = w.health?.[Math.min(t, w.pts.length - 1)] ?? 100;
            const img = heroes.get(p.hero_id)?.images.icon_image_small_webp ?? heroes.get(p.hero_id)?.images.icon_image_small;
            const col = p.team === 0 ? "var(--team-amber)" : "var(--team-sapphire)";
            return (
              <g key={w.slot} opacity={hp <= 0 ? 0.25 : 1} style={{ transition: "transform 100ms linear" }} transform={`translate(${pt[0]},${pt[1]})`}>
                <circle r={22} fill="var(--card)" stroke={col} strokeWidth={4} />
                {img && <image href={img} x={-18} y={-18} width={36} height={36} clipPath="circle(18px)" />}
                <rect x={-20} y={25} width={40} height={4} fill="var(--border)" /><rect x={-20} y={25} width={(40 * Math.max(0, hp)) / 100} height={4} fill={col} />
              </g>
            );
          })}
        </svg>
        <div className="mt-3 flex items-center gap-3">
          <button onClick={() => setPlay((v) => !v)} className="grid h-9 w-9 place-items-center rounded-full bg-primary text-primary-foreground">{play ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}</button>
          <input type="range" min={0} max={len - 1} value={t} onChange={(e) => setT(+e.target.value)} className="flex-1 accent-[var(--primary)]" />
          <span className="tabular w-14 text-sm">{fmtDuration(sec)}</span>
          <select value={speed} onChange={(e) => setSpeed(+e.target.value)} className="rounded-md border border-border bg-secondary px-2 py-1 text-xs">
            {[2, 8, 20, 50].map((s) => <option key={s} value={s}>×{s * 10}</option>)}
          </select>
        </div>
      </div>
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
        <p className="pt-3 text-xs text-muted-foreground">Фон карты построен из передвижений всех игроков. ✕ — смерть за последние 20 с.</p>
      </div>
    </div>
  );
}
