import { useQuery } from "@tanstack/react-query";
import { Pause, Play } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { HeroIcon, useHeroMap } from "@/components/dl";
import { PlayerMatchModal, type ModalPlayer } from "@/components/PlayerMatchModal";
import { api } from "@/lib/api";
import { fmtDuration, fmtK } from "@/lib/format";
import { cn } from "@/lib/utils";

export interface MatchPath {
  player_slot: number; x_min: number; y_min: number; x_max: number; y_max: number;
  x_pos: number[]; y_pos: number[]; health?: number[];
}
export interface MatchPaths { interval_s: number; x_resolution: number; y_resolution: number; paths: MatchPath[] }
export interface MatchObjective { destroyed_time_s: number; team_objective_id: number; team: number }
type P = ModalPlayer & { death_details?: { game_time_s: number; death_pos: { x: number; y: number } }[] };

type Rel = { left_relative: number; top_relative: number };
interface MapData {
  radius: number;
  images: { minimap: string; frame?: string };
  objective_positions: Record<string, Rel>;
  zipline_paths: { origin: number[]; color: string; P0_points: number[][] }[];
  neutral_camps: (Rel & { kind: string; name: string })[];
  entities: Partial<Record<"shops" | "bridge_buffs" | "unstable_rifts" | "soul_urn_pads" | "teleporters" | "base_sentries", (Rel & { kind?: string; team?: number })[]>>;
}
const mapQuery = { queryKey: ["map-assets"], queryFn: () => api<MapData>("/v1/assets/map"), staleTime: Infinity };

const S = 1000;
// objective id (ECitadelTeamObjective) → position key suffix
const OBJ_KEY: Record<number, string> = { 1: "tier1_1", 3: "tier1_3", 4: "tier1_4", 5: "tier2_1", 7: "tier2_3", 8: "tier2_4" };
type StructKind = "guardian" | "walker" | "patron" | "shrine" | "baseGuardian";
const STRUCT_NAME: Record<StructKind, string> = { guardian: "Guardian", walker: "Walker", patron: "Patron", shrine: "Shrine", baseGuardian: "Base Guardian" };
const STRUCT_OF: Record<number, StructKind> = { 0: "patron", 1: "guardian", 3: "guardian", 4: "guardian", 5: "walker", 7: "walker", 8: "walker", 9: "patron", 10: "shrine", 11: "shrine", 12: "baseGuardian", 13: "baseGuardian", 14: "baseGuardian", 15: "baseGuardian", 16: "baseGuardian", 17: "baseGuardian" };
// Game timers (approximate, the match data has no spawn events): runes on bridges and rift openings.
const RUNE_FIRST = 300, RUNE_EVERY = 300, RUNE_STAY = 120;
const RIFT_FIRST = 600, RIFT_EVERY = 300, RIFT_OPEN = 90;
function cycle(sec: number, first: number, every: number, stay: number) {
  if (sec < first) return { active: false, next: first - sec };
  const into = (sec - first) % every;
  return into < stay ? { active: true, next: null } : { active: false, next: every - into };
}
type Pt = readonly [number, number];
/** Nearest point on any zipline (objective_positions in the assets are offset, structures sit on the ziplines). */
function snapToZip(p: Pt, lines: Pt[][]): Pt {
  let best: Pt = p, bd = Infinity;
  for (const l of lines) for (let i = 1; i < l.length; i++) {
    const a = l[i - 1]!, b = l[i]!; const dx = b[0] - a[0], dy = b[1] - a[1]; const L = dx * dx + dy * dy || 1;
    const u = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L));
    const q: Pt = [a[0] + u * dx, a[1] + u * dy]; const d = (q[0] - p[0]) ** 2 + (q[1] - p[1]) ** 2;
    if (d < bd) { bd = d; best = q; }
  }
  return best;
}
function buildStructures(md: MapData, objectives: MatchObjective[], toSvg: (x: number, y: number) => Pt, rel: (r: Rel) => Pt) {
  const lines = md.zipline_paths.map((z) => z.P0_points.map((pt) => toSvg((z.origin[0] ?? 0) + (pt[0] ?? 0), (z.origin[1] ?? 0) + (pt[1] ?? 0))));
  const out: { key: string; kind: StructKind; team: number; x: number; y: number; dt?: number | undefined }[] = [];
  const killed = (team: number, ids: number[]) => objectives.filter((o) => o.team === team && ids.includes(o.team_objective_id) && o.destroyed_time_s > 0).map((o) => o.destroyed_time_s).sort((a, b) => a - b);
  for (const [k, r] of Object.entries(md.objective_positions)) {
    const m = k.match(/^team(\d)_(tier[12])_(\d)$/); if (!m) continue;
    const team = +m[1]!; const [x, y] = snapToZip(rel(r), lines);
    const id = Object.entries(OBJ_KEY).find(([, v]) => v === `${m[2]}_${m[3]}`)?.[0];
    const dt = objectives.find((o) => o.team === team && String(o.team_objective_id) === id && o.destroyed_time_s > 0)?.destroyed_time_s;
    out.push({ key: k, kind: m[2] === "tier1" ? "guardian" : "walker", team, x, y, dt });
  }
  for (const team of [0, 1]) {
    const s = (md.entities.base_sentries ?? []).filter((e) => e.team === team).map(rel).sort((a, b) => a[0] - b[0]);
    if (!s.length) continue;
    const cx = s.reduce((a, p) => a + p[0], 0) / s.length, cy = s.reduce((a, p) => a + p[1], 0) / s.length;
    const outer = [s[0]!, s[s.length - 1]!], inner = s.slice(1, -1);
    const bg = killed(team, [12, 13, 14, 15, 16, 17]), sh = killed(team, [10, 11]);
    outer.forEach((p, i) => out.push({ key: `bg${team}${i}`, kind: "baseGuardian", team, x: p[0], y: p[1], dt: bg[i] }));
    inner.forEach((p, i) => out.push({ key: `sh${team}${i}`, kind: "shrine", team, x: p[0], y: p[1], dt: sh[i] }));
    const patronDt = objectives.find((o) => o.team === team && (o.team_objective_id === 0 || o.team_objective_id === 9) && o.destroyed_time_s > 0)?.destroyed_time_s;
    out.push({ key: `pt${team}`, kind: "patron", team, x: cx, y: cy + (team === 0 ? 22 : -22), dt: patronDt });
  }
  return out;
}
function StructIcon({ kind, fill }: { kind: StructKind; fill: string }) {
  const st = { fill, stroke: "black", strokeWidth: 2, strokeLinejoin: "round" as const };
  if (kind === "guardian") return <path d="M0,-11 L9,-7 L8,3 Q5,9 0,12 Q-5,9 -8,3 L-9,-7 Z" {...st} />;
  if (kind === "walker") return <g><path d="M-6,4 L-11,13 M6,4 L11,13 M0,5 L0,14" stroke="black" strokeWidth={4} /><path d="M-6,4 L-11,13 M6,4 L11,13 M0,5 L0,14" stroke={fill} strokeWidth={2} /><path d="M0,-13 L11,-6 L11,4 L0,8 L-11,4 L-11,-6 Z" {...st} /><circle r={3} cy={-3} fill="black" /></g>;
  if (kind === "baseGuardian") return <g><rect x={-9} y={-12} width={18} height={22} rx={2} {...st} /><rect x={-5} y={-8} width={10} height={4} fill="black" opacity={0.6} /></g>;
  if (kind === "shrine") return <g><path d="M0,-12 L9,0 L0,12 L-9,0 Z" {...st} /><path d="M0,-5 Q4,0 0,6 Q-4,0 0,-5 Z" fill="black" opacity={0.6} /></g>;
  return <g><circle r={17} {...st} strokeWidth={2.5} /><path d="M-9,4 L-10,-6 L-4,-1 L0,-9 L4,-1 L10,-6 L9,4 Z" fill="black" opacity={0.7} /></g>;
}

type Layer = "zip" | "camps" | "obj" | "buffs" | "shops" | "move";
const LAYERS: [Layer, string][] = [["obj", "Башни"], ["zip", "Зиплайны"], ["camps", "Лагеря"], ["buffs", "Урна · рифт · баффы"], ["shops", "Магазины"], ["move", "Тропы"]];
const SPEEDS = [1, 2, 5, 10, 20, 80, 200, 500];

export function MatchReplay({ paths, players, names, objectives, midBoss }: {
  paths?: MatchPaths | undefined; players: P[]; names?: Map<number, { personaname: string }> | undefined;
  objectives?: MatchObjective[] | undefined; midBoss?: { team_killed: number; destroyed_time_s: number }[] | undefined;
}) {
  const heroes = useHeroMap();
  const map = useQuery(mapQuery);
  const R = map.data?.radius ?? 10752;
  const toSvg = (x: number, y: number) => [((x + R) / (2 * R)) * S, ((R - y) / (2 * R)) * S] as const;
  const rel = (r: Rel) => [r.left_relative * S, r.top_relative * S] as const;

  const len = Math.max(0, ...(paths?.paths ?? []).map((p) => p.x_pos.length));
  const [t, setT] = useState(0);
  const [play, setPlay] = useState(false);
  const [mult, setMult] = useState(80);
  const [sel, setSel] = useState<number | null>(null);
  const [layers, setLayers] = useState<Set<Layer>>(new Set(["obj", "zip", "camps", "buffs"]));
  const on = (l: Layer) => layers.has(l);
  const stepS = (mult * 0.1) / (paths?.interval_s || 1);

  useEffect(() => {
    if (!play) return;
    const iv = setInterval(() => setT((v) => (v + stepS >= len - 1 ? (setPlay(false), len - 1) : v + stepS)), 100);
    return () => clearInterval(iv);
  }, [play, stepS, len]);

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
  const ti = Math.max(0, Math.min(Math.floor(t), len - 1));
  const deaths = players.flatMap((p) => (p.death_details ?? []).filter((d) => d.game_time_s <= sec && d.game_time_s > sec - 20).map((d) => ({ ...d, team: p.team })));
  const destroyed = new Map<string, number>();
  for (const o of objectives ?? []) { const k = OBJ_KEY[o.team_objective_id]; if (k && o.destroyed_time_s) destroyed.set(`team${o.team}_${k}`, o.destroyed_time_s); }
  const md = map.data;
  const bossDead = (midBoss ?? []).filter((b) => b.destroyed_time_s <= sec);
  const teamCol = (team: number) => (team === 0 ? "var(--team-amber)" : "var(--team-sapphire)");
  const structures = md ? buildStructures(md, objectives ?? [], toSvg, rel) : [];
  const timed = md ? [
    ...(md.entities.unstable_rifts ?? []).map((r) => ({ ...cycle(sec, RIFT_FIRST, RIFT_EVERY, RIFT_OPEN), x: rel(r)[0], y: rel(r)[1], c: "oklch(0.7 0.25 310)", short: "R", label: "Рифт" })),
    ...(md.entities.bridge_buffs ?? []).map((r) => ({ ...cycle(sec, RUNE_FIRST, RUNE_EVERY, RUNE_STAY), x: rel(r)[0], y: rel(r)[1], c: "oklch(0.85 0.17 95)", short: "B", label: "Руна (бафф моста)" })),
  ] : [];
  const selP = sel != null ? players.find((p) => p.player_slot === sel) ?? null : null;
  const selW = sel != null ? world.find((w) => w.slot === sel) : undefined;

  const timedEvents: { t: number; team: number; text: string }[] = [];
  for (let t0 = RUNE_FIRST; t0 < (len * (paths!.interval_s || 1)); t0 += RUNE_EVERY) timedEvents.push({ t: t0, team: -1, text: "Появились руны на мостах" });
  for (let t0 = RIFT_FIRST; t0 < (len * (paths!.interval_s || 1)); t0 += RIFT_EVERY) timedEvents.push({ t: t0, team: -1, text: "Открылись рифты" });
  const fights = (() => {
    const ds = players.flatMap((p) => (p.death_details ?? []).map((d) => ({ t: d.game_time_s, team: p.team }))).sort((a, b) => a.t - b.t);
    const out: { start: number; end: number; amber: number; sapph: number }[] = [];
    let cur: typeof ds = [];
    const flush = () => { if (cur.length >= 3) out.push({ start: cur[0]!.t, end: cur.at(-1)!.t, amber: cur.filter((d) => d.team === 1).length, sapph: cur.filter((d) => d.team === 0).length }); cur = []; };
    for (const d of ds) { if (cur.length && d.t - cur.at(-1)!.t > 20) flush(); cur.push(d); }
    flush();
    return out.sort((a, b) => b.amber + b.sapph - (a.amber + a.sapph)).slice(0, 12).sort((a, b) => a.start - b.start);
  })();
  const objEvents = [
    ...(objectives ?? []).filter((o) => STRUCT_OF[o.team_objective_id] && o.destroyed_time_s).map((o) => ({ t: o.destroyed_time_s, team: o.team, text: `${o.team === 0 ? "Амбер" : "Сапфир"} теряет: ${STRUCT_NAME[STRUCT_OF[o.team_objective_id]!]}` })),
    ...(midBoss ?? []).map((b) => ({ t: b.destroyed_time_s, team: b.team_killed, text: `${b.team_killed === 0 ? "Амбер" : "Сапфир"} убивает Мид-босса` })),
    ...timedEvents,
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
              return <polyline key={w.slot} points={w.pts.slice(0, ti + 1).filter((_, i) => i % 3 === 0).map((q) => q.join(",")).join(" ")} fill="none" stroke={p ? teamCol(p.team) : "white"} strokeOpacity={0.35} strokeWidth={2} />;
            })}
            {md && on("zip") && md.zipline_paths.map((z, i) => (
              <polyline key={i} points={z.P0_points.map((pt) => toSvg((z.origin[0] ?? 0) + (pt[0] ?? 0), (z.origin[1] ?? 0) + (pt[1] ?? 0)).join(",")).join(" ")}
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
              {(md.entities.soul_urn_pads ?? []).map((b, i) => { const [x, y] = rel(b); return <Marker key={`u${i}`} x={x} y={y} c="oklch(0.75 0.15 200)" label="Урна душ (точка сдачи)" short="U" />; })}
              {(md.entities.teleporters ?? []).map((b, i) => { const [x, y] = rel(b); return <Marker key={`t${i}`} x={x} y={y} c="oklch(0.7 0.12 250)" label="Телепорт" short="T" small />; })}
              <g opacity={bossDead.length ? 0.45 : 1}><Marker x={S / 2} y={S / 2} c="oklch(0.6 0.22 20)" label="Мид-босс" short="M" big /></g>
            </>}
            {md && on("buffs") && timed.map((m, i) => (
              <g key={`tm${i}`} transform={`translate(${m.x},${m.y})`}>
                {m.active && <circle r={20} fill="none" stroke={m.c} strokeWidth={3}><animate attributeName="r" values="12;26;12" dur="1.6s" repeatCount="indefinite" /><animate attributeName="opacity" values="1;0.2;1" dur="1.6s" repeatCount="indefinite" /></circle>}
                <circle r={m.active ? 13 : 9} fill={m.active ? m.c : "var(--muted)"} stroke="black" strokeWidth={2} opacity={m.active ? 1 : 0.7} />
                <text y={m.active ? 5 : 4} fontSize={m.active ? 13 : 10} textAnchor="middle" fill="black" fontWeight={800}>{m.short}</text>
                {!m.active && m.next != null && <text y={24} fontSize={11} textAnchor="middle" fill="white" stroke="black" strokeWidth={3} paintOrder="stroke" fontWeight={700}>{fmtDuration(m.next)}</text>}
                <title>{m.label}{m.active ? " · активно" : m.next != null ? ` · через ${fmtDuration(m.next)}` : ""}</title>
              </g>
            ))}
            {md && on("obj") && structures.map((s) => {
              const dead = s.dt != null && s.dt <= sec;
              return <g key={s.key} transform={`translate(${s.x},${s.y})`} opacity={dead ? 0.4 : 1}>
                <StructIcon kind={s.kind} fill={dead ? "var(--muted)" : teamCol(s.team)} />
                {dead && <text y={6} fontSize={16} textAnchor="middle" fill="var(--loss)" fontWeight={800} stroke="black" strokeWidth={0.8}>✕</text>}
                <title>{STRUCT_NAME[s.kind]} · {s.team === 0 ? "Амбер" : "Сапфир"}{s.dt ? ` · разрушен ${fmtDuration(s.dt)}` : ""}</title>
              </g>;
            })}
            {deaths.map((d, i) => { const [x, y] = toSvg(d.death_pos.x, d.death_pos.y); return <text key={i} x={x} y={y} fontSize={26} textAnchor="middle" fill="var(--loss)" stroke="black" strokeWidth={1}>✕</text>; })}
            {world.map((w) => {
              const p = bySlot.get(w.slot); if (!p) return null;
              const idx = Math.min(ti, w.pts.length - 1);
              const pt = w.pts[idx]; if (!pt) return null;
              const hp = w.health?.[idx] ?? 100;
              const img = heroes.get(p.hero_id)?.images.icon_image_small_webp ?? heroes.get(p.hero_id)?.images.icon_image_small;
              const col = teamCol(p.team);
              return (
                <g key={w.slot} opacity={hp <= 0 ? 0.25 : 1} style={{ transition: "transform 100ms linear", cursor: "pointer" }} transform={`translate(${pt[0]},${pt[1]})`} onClick={() => setSel(w.slot)}>
                  <circle r={21} fill="var(--card)" stroke={col} strokeWidth={4} />
                  {img && <image href={img} x={-17} y={-17} width={34} height={34} clipPath="circle(17px)" />}
                  <rect x={-20} y={24} width={40} height={5} rx={2} fill="black" /><rect x={-20} y={24} width={(40 * Math.max(0, hp)) / 100} height={5} rx={2} fill={col} />
                </g>
              );
            })}
          </svg>
          <PlayerMatchModal player={selP} name={selP?.account_id ? names?.get(selP.account_id)?.personaname : undefined} sec={sec} hp={selW?.health?.[Math.min(ti, selW.pts.length - 1)] ?? 100} onClose={() => setSel(null)} />
          {!md && <div className="absolute inset-0 grid place-items-center text-sm text-muted-foreground">Загрузка карты…</div>}
        </div>
        <div className="mt-3 flex items-center gap-3">
          <button onClick={() => setPlay((v) => !v)} className="grid h-9 w-9 place-items-center rounded-full bg-primary text-primary-foreground">{play ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}</button>
          <input type="range" min={0} max={len - 1} step="any" value={t} onChange={(e) => setT(+e.target.value)} className="flex-1 accent-[var(--primary)]" />
          <span className="tabular w-14 text-sm">{fmtDuration(sec)}</span>
          <select value={mult} onChange={(e) => setMult(+e.target.value)} className="rounded-md border border-border bg-secondary px-2 py-1 text-xs">
            {SPEEDS.map((s) => <option key={s} value={s}>×{s}</option>)}
          </select>
        </div>
        <ValueChart players={players} names={names} sec={sec} sel={sel} onSelect={setSel} fights={fights} onSeek={(s2) => setT(Math.round(s2 / (paths!.interval_s || 1)))} />
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
          <span>щит — Guardian</span><span>шагоход — Walker</span><span>прямоугольник — Base Guardian</span><span>ромб — Shrine</span><span>корона — Patron</span><span>R — рифт, B — руна (пульсируют, когда активны; таймеры примерные)</span><span>нажмите на героя — карточка с билдом</span><span>U — урна</span><span>M — мид-босс</span><span>T — телепорт</span><span>● лагеря (красный — сильный)</span><span>◆ жёлтый — хранилище</span><span>пунктир — зиплайны</span>
        </div>
      </div>
      <div className="space-y-4">
        <div className="panel space-y-1 p-3 text-sm">
          <p className="mb-2 flex justify-between text-xs uppercase tracking-wider text-muted-foreground"><span>Игроки</span><span>K/D/A · души</span></p>
          {[0, 1].map((team) => {
            const tp = players.filter((p) => p.team === team);
            const snapOf = (p: P) => [...(p.stats ?? [])].reverse().find((x) => x.time_stamp_s <= sec);
            const tot = tp.reduce((a, p) => a + (snapOf(p)?.net_worth ?? 0), 0);
            const maxNw = Math.max(1, ...players.map((p) => snapOf(p)?.net_worth ?? 0));
            return (
              <div key={team} className="mb-2">
                <div className={cn("mb-1 flex justify-between text-[11px] font-semibold", team === 0 ? "text-amber-team" : "text-sapphire-team")}><span>{team === 0 ? "Амбер" : "Сапфир"}</span><span className="tabular">{fmtK(tot)}</span></div>
                {tp.map((p) => {
                  const w = world.find((x) => x.slot === p.player_slot);
                  const hp = w?.health?.[Math.min(ti, (w?.pts.length ?? 1) - 1)] ?? 100;
                  const sn = snapOf(p);
                  return (
                    <button key={p.player_slot} onClick={() => setSel(p.player_slot)} className={cn("w-full rounded px-1 py-0.5 text-left hover:bg-secondary", sel === p.player_slot && "bg-secondary", hp <= 0 && "opacity-40")}>
                      <div className="flex items-center gap-2">
                        <HeroIcon heroId={p.hero_id} size={24} className={team === 0 ? "border-amber-team" : "border-sapphire-team"} />
                        <span className="min-w-0 flex-1 truncate text-xs">{names?.get(p.account_id ?? 0)?.personaname ?? heroes.get(p.hero_id)?.name}</span>
                        <span className="tabular text-[11px] text-muted-foreground">{sn ? `${sn.kills ?? 0}/${sn.deaths ?? 0}/${sn.assists ?? 0}` : "—"}</span>
                        <span className="tabular w-10 text-right text-[11px] text-primary">{sn ? fmtK(sn.net_worth ?? 0) : "—"}</span>
                      </div>
                      <div className="ml-8 mt-0.5 flex gap-1">
                        <div className="h-1 flex-1 overflow-hidden rounded-full bg-muted"><div className={team === 0 ? "h-full bg-amber-team" : "h-full bg-sapphire-team"} style={{ width: `${((sn?.net_worth ?? 0) / maxNw) * 100}%` }} /></div>
                        <div className="h-1 w-10 overflow-hidden rounded-full bg-muted"><div className={cn("h-full", hp > 0 ? "bg-win" : "bg-loss")} style={{ width: `${Math.max(0, hp)}%` }} /></div>
                      </div>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
        {fights.length > 0 && (
          <div className="panel max-h-72 space-y-1 overflow-auto p-3 text-xs">
            <p className="mb-2 uppercase tracking-wider text-muted-foreground">Ключевые файты</p>
            {fights.map((f, i) => (
              <button key={i} onClick={() => { setT(Math.max(0, Math.round((f.start - 8) / (paths!.interval_s || 1)))); setPlay(true); if (mult > 10) setMult(5); }}
                className={cn("flex w-full items-center gap-2 rounded px-1 py-1 text-left hover:bg-secondary", sec >= f.start - 8 && sec <= f.end + 2 && "bg-primary/10")}>
                <span className="tabular w-10 text-muted-foreground">{fmtDuration(f.start)}</span>
                <span className="text-amber-team tabular">{f.amber}</span><span className="text-muted-foreground">:</span><span className="text-sapphire-team tabular">{f.sapph}</span>
                <span className="flex-1 truncate">{f.amber === f.sapph ? "Размен" : f.amber > f.sapph ? "Амбер выигрывает" : "Сапфир выигрывает"} · {f.amber + f.sapph} смертей</span>
                <Play className="h-3 w-3 text-primary" />
              </button>
            ))}
          </div>
        )}
        {objEvents.length > 0 && (
          <div className="panel max-h-80 space-y-1 overflow-auto p-3 text-xs">
            <p className="mb-2 uppercase tracking-wider text-muted-foreground">Объекты</p>
            {objEvents.map((e, i) => (
              <button key={i} onClick={() => setT(Math.round(e.t / (paths!.interval_s || 1)))} className={cn("flex w-full items-center gap-2 rounded px-1 py-0.5 text-left hover:bg-secondary", e.t > sec && "opacity-40")}>
                <span className="tabular w-10 text-muted-foreground">{fmtDuration(e.t)}</span>
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: e.team < 0 ? "oklch(0.75 0.2 310)" : teamCol(e.team) }} />
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

/** Souls (player value) over time for every player; click a line to select, click the chart to seek. */
function ValueChart({ players, names, sec, sel, onSelect, fights, onSeek }: {
  players: P[]; names?: Map<number, { personaname: string }> | undefined; sec: number; sel: number | null;
  onSelect: (s: number) => void; fights: { start: number }[]; onSeek: (s: number) => void;
}) {
  const heroes = useHeroMap();
  const W = 800, H = 180;
  const maxT = Math.max(60, ...players.map((p) => p.stats?.at(-1)?.time_stamp_s ?? 0));
  const maxV = Math.max(1, ...players.map((p) => p.stats?.at(-1)?.net_worth ?? 0));
  const x = (t: number) => (t / maxT) * W, y = (v: number) => H - (v / maxV) * (H - 10);
  const col = (team: number) => (team === 0 ? "var(--team-amber)" : "var(--team-sapphire)");
  return (
    <div className="mt-4">
      <p className="mb-1 flex justify-between text-xs uppercase tracking-wider text-muted-foreground"><span>Ценность игроков (души)</span><span className="normal-case">нажмите на график — перемотка</span></p>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-44 w-full cursor-crosshair rounded-lg bg-secondary/40" preserveAspectRatio="none"
        onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); onSeek(((e.clientX - r.left) / r.width) * maxT); }}>
        {fights.map((f, i) => <rect key={i} x={x(f.start) - 2} y={0} width={6} height={H} fill="var(--loss)" opacity={0.15} />)}
        {players.map((p) => {
          const pts = (p.stats ?? []).map((s) => `${x(s.time_stamp_s)},${y(s.net_worth ?? 0)}`).join(" ");
          const active = sel === p.player_slot;
          return <polyline key={p.player_slot} points={`0,${H} ${pts}`} fill="none" stroke={col(p.team)} strokeWidth={active ? 3 : 1.3} opacity={sel == null || active ? 0.9 : 0.25} vectorEffect="non-scaling-stroke"
            style={{ cursor: "pointer" }} onClick={(e) => { e.stopPropagation(); onSelect(p.player_slot); }}>
            <title>{names?.get(p.account_id ?? 0)?.personaname ?? heroes.get(p.hero_id)?.name}</title>
          </polyline>;
        })}
        <line x1={x(sec)} x2={x(sec)} y1={0} y2={H} stroke="var(--primary)" strokeWidth={2} vectorEffect="non-scaling-stroke" />
      </svg>
    </div>
  );
}
