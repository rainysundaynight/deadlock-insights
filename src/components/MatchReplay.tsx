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
type P = ModalPlayer & { death_details?: { game_time_s: number; killer_player_slot?: number; death_pos: { x: number; y: number } }[] };

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
/** Playback quality: update interval (ms) and whether heroes glide between recorded points. */
const QUALITY = {
  low: { label: "Качество: низкое", tick: 150, smooth: false },
  mid: { label: "Качество: среднее", tick: 66, smooth: true },
  high: { label: "Качество: плавное", tick: 33, smooth: true },
  ultra: { label: "Качество: максимум", tick: 16, smooth: true },
} as const;
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

type Layer = "trail" | "zip" | "camps" | "obj" | "buffs" | "shops" | "move";
const LAYERS: [Layer, string][] = [["trail", "Следы 40с"], ["obj", "Башни"], ["zip", "Зиплайны"], ["camps", "Лагеря"], ["buffs", "Урна · рифт · баффы"], ["shops", "Магазины"], ["move", "Тропы"]];
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
  const [quality, setQuality] = useState<keyof typeof QUALITY>("high");
  const Q = QUALITY[quality];
  const [sel, setSel] = useState<number | null>(null);
  const [mvpInfo, setMvpInfo] = useState(true);
  const [layers, setLayers] = useState<Set<Layer>>(new Set(["trail", "obj", "zip", "camps", "buffs"]));
  const on = (l: Layer) => layers.has(l);
  const stepS = (mult * Q.tick / 1000) / (paths?.interval_s || 1);

  useEffect(() => {
    if (!play) return;
    const iv = setInterval(() => setT((v) => (v + stepS >= len - 1 ? (setPlay(false), len - 1) : v + stepS)), Q.tick);
    return () => clearInterval(iv);
  }, [play, stepS, len, Q.tick]);

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
  const kills = players.flatMap((p) => (p.death_details ?? []).map((d) => ({ t: d.game_time_s, victim: p.player_slot, killer: d.killer_player_slot ?? -1, team: p.team }))).sort((a, b) => a.t - b.t);
  const streakOf = (slot: number) => {
    const lastDeath = Math.max(-1, ...kills.filter((k) => k.victim === slot && k.t <= sec).map((k) => k.t));
    return kills.filter((k) => k.killer === slot && k.t <= sec && k.t > lastDeath).length;
  };
  const snapAtSec = (p: P) => [...(p.stats ?? [])].reverse().find((x) => x.time_stamp_s <= sec);
  const MVP_W = [["nw", "Души", 0.24], ["dmg", "Урон по героям", 0.16], ["k", "Убийства", 0.14], ["kp", "Участие в убийствах", 0.12], ["a", "Помощь", 0.1], ["heal", "Лечение и щиты", 0.08], ["obj", "Урон по боссам", 0.08], ["d", "Смерти", -0.12]] as const;
  type MvpKey = (typeof MVP_W)[number][0];
  const scoreAt = (time: number) => {
    const snap = (p: P) => [...(p.stats ?? [])].reverse().find((x) => x.time_stamp_s <= time) as Record<string, number> | undefined;
    const rows = players.map((p) => {
      const s0 = snap(p);
      const teamK = players.filter((q) => q.team === p.team).reduce((acc, q) => acc + (snap(q)?.["kills"] ?? 0), 0);
      const g = (k: string) => s0?.[k] ?? 0;
      const v: Record<MvpKey, number> = { nw: g("net_worth"), k: g("kills"), a: g("assists"), dmg: g("player_damage"), heal: g("player_healing") + g("teammate_healing") + g("teammate_barriering"), obj: g("boss_damage"), kp: teamK ? (g("kills") + g("assists")) / teamK : 0, d: g("deaths") };
      return { slot: p.player_slot, v, k: g("kills"), a: g("assists"), d: g("deaths") };
    });
    if (!rows.some((r) => r.v.nw > 0)) return null;
    const mx = Object.fromEntries(MVP_W.map(([k]) => [k, Math.max(1e-9, ...rows.map((r) => r.v[k]))])) as Record<MvpKey, number>;
    const scored = rows.map((r) => {
      const parts = MVP_W.map(([k, label, w]) => ({ k, label, w, raw: r.v[k], pts: w * (r.v[k] / mx[k]) * 100 }));
      return { ...r, parts, sc: parts.reduce((x, q) => x + q.pts, 0) };
    }).sort((x, y) => y.sc - x.sc);
    return scored;
  };
  const mvpRows = scoreAt(sec);
  const mvpSlot = mvpRows?.[0]?.slot ?? null;
  const mvpHistory = (() => {
    if (mvpSlot == null) return [];
    const p = bySlot.get(mvpSlot); const times = (p?.stats ?? []).map((x) => x.time_stamp_s).filter((x) => x <= sec);
    const out: { t: number; dk: number; da: number; dd: number; dsc: number; sc: number }[] = [];
    let prev = null as null | { k: number; a: number; d: number; sc: number };
    for (const tm of times) {
      const r = scoreAt(tm)?.find((x) => x.slot === mvpSlot); if (!r) continue;
      if (prev && (r.k !== prev.k || r.a !== prev.a || r.d !== prev.d)) out.push({ t: tm, dk: r.k - prev.k, da: r.a - prev.a, dd: r.d - prev.d, dsc: r.sc - prev.sc, sc: r.sc });
      prev = { k: r.k, a: r.a, d: r.d, sc: r.sc };
    }
    return out.slice(-5).reverse();
  })();
  const [mvpOpen, setMvpOpen] = [mvpInfo, setMvpInfo];
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
    ...(objectives ?? []).filter((o) => STRUCT_OF[o.team_objective_id] && o.destroyed_time_s).map((o) => ({ t: o.destroyed_time_s, team: o.team, text: `${o.team === 0 ? "Hidden King" : "Archmother"} теряет: ${STRUCT_NAME[STRUCT_OF[o.team_objective_id]!]}` })),
    ...(midBoss ?? []).map((b) => ({ t: b.destroyed_time_s, team: b.team_killed, text: `${b.team_killed === 0 ? "Hidden King" : "Archmother"} убивает Мид-босса` })),
    ...timedEvents,
  ].sort((a, b) => a.t - b.t);

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
      <div className="panel relative overflow-hidden p-3">
        <span aria-hidden className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-amber-team via-primary to-sapphire-team" />
        <div className="mb-3 flex flex-wrap items-center gap-1.5">
          <span className="mr-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Слои</span>
          {LAYERS.map(([k, l]) => (
            <button key={k} onClick={() => setLayers((s) => { const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n; })}
              className={cn("border px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider transition-colors", on(k) ? "border-primary/70 bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground")}>{l}</button>
          ))}
        </div>
        <div className="relative overflow-hidden border border-border bg-background">
          <svg viewBox={`0 0 ${S} ${S}`} className="aspect-square w-full">
            {md && <image href={md.images.minimap} x={0} y={0} width={S} height={S} opacity={0.95} />}
            {on("move") && world.map((w) => {
              const p = bySlot.get(w.slot);
              return <polyline key={w.slot} points={w.pts.slice(0, ti + 1).filter((_, i) => i % 3 === 0).map((q) => q.join(",")).join(" ")} fill="none" stroke={p ? teamCol(p.team) : "white"} strokeOpacity={0.35} strokeWidth={2} />;
            })}
            {on("trail") && world.map((w) => {
              const p = bySlot.get(w.slot); if (!p) return null;
              const tail = Math.max(2, Math.round(40 / (paths!.interval_s || 1)));
              const end = Math.min(ti, w.pts.length - 1), start = Math.max(0, end - tail);
              const seg = w.pts.slice(start, end + 1).filter((_, i) => (w.health?.[start + i] ?? 100) > 0);
              const parts = 5, n = Math.ceil(seg.length / parts);
              return <g key={`tr${w.slot}`} strokeLinecap="round" strokeLinejoin="round">
                {Array.from({ length: parts }, (_, k) => {
                  const pts = seg.slice(k * n, (k + 1) * n + 1); if (pts.length < 2) return null;
                  return <polyline key={k} points={pts.map((q) => q.join(",")).join(" ")} fill="none" stroke={teamCol(p.team)} strokeOpacity={0.15 + 0.17 * k} strokeWidth={2 + k * 1.2} />;
                })}
              </g>;
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
                <title>{STRUCT_NAME[s.kind]} · {s.team === 0 ? "Hidden King" : "Archmother"}{s.dt ? ` · разрушен ${fmtDuration(s.dt)}` : ""}</title>
              </g>;
            })}
            {deaths.map((d, i) => { const [x, y] = toSvg(d.death_pos.x, d.death_pos.y); return <text key={i} x={x} y={y} fontSize={26} textAnchor="middle" fill="var(--loss)" stroke="black" strokeWidth={1}>✕</text>; })}
            {world.map((w) => {
              const p = bySlot.get(w.slot); if (!p) return null;
              const idx = Math.min(ti, w.pts.length - 1);
              const hpNow = w.health?.[idx] ?? 100;
              let ai = idx;
              if (hpNow <= 0) { while (ai > 0 && (w.health?.[ai] ?? 100) <= 0) ai--; }
              const a0 = w.pts[ai]; if (!a0) return null;
              const nextDead = (w.health?.[Math.min(idx + 1, w.pts.length - 1)] ?? 100) <= 0;
              const b0 = hpNow <= 0 || nextDead ? a0 : w.pts[Math.min(idx + 1, w.pts.length - 1)] ?? a0;
              const fr = Q.smooth ? Math.min(1, Math.max(0, t - idx)) : 0;
              const pt = [a0[0] + (b0[0] - a0[0]) * fr, a0[1] + (b0[1] - a0[1]) * fr];
              const hp = w.health?.[idx] ?? 100;
              const img = heroes.get(p.hero_id)?.images.icon_image_small_webp ?? heroes.get(p.hero_id)?.images.icon_image_small;
              const col = teamCol(p.team);
              return (
                <g key={w.slot} opacity={hp <= 0 ? 0.25 : 1} style={{ cursor: "pointer" }} transform={`translate(${pt[0]},${pt[1]})`} onClick={() => setSel(w.slot)}>
                  {mvpSlot === w.slot && hp > 0 && (() => {
                    const raw = names?.get(p.account_id ?? 0)?.personaname ?? heroes.get(p.hero_id)?.name ?? "";
                    const nm = raw.length > 18 ? `${raw.slice(0, 17)}…` : raw;
                    const wpx = nm.length * 6.6 + 32;
                    return <>
                      <circle r={40} fill="var(--primary)" opacity={0.1} />
                      <circle r={33} fill="var(--primary)" opacity={0.16} />
                      <circle r={27} fill="var(--primary)" opacity={0.22} />
                      <circle r={24} fill="none" stroke="var(--primary)" strokeWidth={2.5}>
                        <animate attributeName="r" values="24;44" dur="1.8s" repeatCount="indefinite" />
                        <animate attributeName="opacity" values="0.9;0" dur="1.8s" repeatCount="indefinite" />
                      </circle>
                      <circle r={24.5} fill="none" stroke="var(--primary)" strokeWidth={3} />
                      <path d="M-14,-33 L-14,-45 L-7,-39 L0,-49 L7,-39 L14,-45 L14,-33 Z" fill="var(--primary)" stroke="black" strokeWidth={1.6} />
                      <g transform="translate(0,33)">
                        <rect x={-wpx / 2} y={0} width={wpx} height={17} rx={3} fill="var(--card)" stroke="var(--primary)" strokeWidth={1.2} />
                        <text y={12.5} fontSize={11} textAnchor="middle" fill="var(--primary)" fontWeight={800}>♛ {nm}</text>
                      </g>
                    </>;
                  })()}
                  <circle r={21} fill="var(--card)" stroke={col} strokeWidth={4} />
                  {img && <image href={img} x={-17} y={-17} width={34} height={34} clipPath="circle(17px)" />}
                  {hp <= 0 && <text y={7} fontSize={22} textAnchor="middle" fill="var(--loss)" stroke="black" strokeWidth={1} fontWeight={800}>✕</text>}
                  <rect x={-20} y={24} width={40} height={5} rx={2} fill="black" /><rect x={-20} y={24} width={(40 * Math.max(0, hp)) / 100} height={5} rx={2} fill={col} />
                </g>
              );
            })}
          </svg>
          {(() => {
            const nwOf = (team: number) => players.filter((p) => p.team === team).reduce((a, p) => a + ([...(p.stats ?? [])].reverse().find((x) => x.time_stamp_s <= sec)?.net_worth ?? 0), 0);
            const a = nwOf(0), b = nwOf(1);
            const pa = winChance(a, b, sec);
            return [0, 1].map((team) => (
              <div key={team} className={cn("pointer-events-none absolute top-2 rounded-lg border bg-card/85 px-3 py-1.5 backdrop-blur", team === 0 ? "left-2 border-amber-team/60" : "right-2 border-sapphire-team/60 text-right")}>
                <div className={cn("text-xs font-bold uppercase", team === 0 ? "text-amber-team" : "text-sapphire-team")}>{team === 0 ? "Hidden King" : "Archmother"}</div>
                <div className="tabular text-sm font-semibold">{fmtK(team === 0 ? a : b)} <span className="text-[10px] font-normal text-muted-foreground">душ</span></div>
                <div className="tabular text-[11px] text-muted-foreground">победа ≈ {Math.round((team === 0 ? pa : 1 - pa) * 100)}%</div>
              </div>
            ));
          })()}
          {(() => {
            const since = sec - RIFT_FIRST;
            if (since < 0 || since % RIFT_EVERY > 8) return null;
            const rifts = md?.entities.unstable_rifts ?? [];
            const sides = [...new Set(rifts.map((r) => (r.left_relative < 0.4 ? "левой" : r.left_relative > 0.6 ? "правой" : "центральной")))];
            return <div className="pointer-events-none absolute left-1/2 top-3 -translate-x-1/2 rounded-full bg-foreground px-4 py-1.5 text-sm font-semibold text-background shadow-lg">Открылись рифты{sides.length ? ` · на ${sides.join(" и ")} линии` : ""}</div>;
          })()}
          {(() => {
            const ev = [...objEvents.filter((e) => e.team >= 0), ...fights.map((f) => ({ t: f.start, team: f.amber > f.sapph ? 0 : f.amber < f.sapph ? 1 : -1, text: `Файт: ${f.amber}:${f.sapph}` }))].filter((e) => e.t <= sec && e.t > sec - 6).at(-1);
            if (!ev) return null;
            return <div key={ev.t + ev.text} className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 border bg-card/90 px-4 py-1.5 font-display text-sm font-semibold backdrop-blur animate-in fade-in slide-in-from-bottom-2" style={{ borderColor: ev.team < 0 ? "var(--primary)" : teamCol(ev.team) }}>
              <span className="mr-2 font-mono text-[10px] text-muted-foreground">{fmtDuration(ev.t)}</span>{ev.text}
            </div>;
          })()}
          <div className="pointer-events-none absolute left-1/2 top-14 flex w-72 -translate-x-1/2 flex-col items-center gap-1">
            {kills.filter((k) => k.t <= sec && k.t > sec - 12).slice(-5).map((k) => {
              const kp = bySlot.get(k.killer), vp = bySlot.get(k.victim);
              const nmOf = (q?: P) => q ? (names?.get(q.account_id ?? 0)?.personaname ?? heroes.get(q.hero_id)?.name ?? "?") : "Нейтралы";
              const fade = Math.max(0.25, 1 - (sec - k.t) / 12);
              return <div key={`${k.t}-${k.victim}`} style={{ opacity: fade }} className="flex items-center gap-1.5 border border-border bg-card/90 px-2 py-0.5 text-[11px] backdrop-blur animate-in fade-in slide-in-from-top-1">
                {kp ? <HeroIcon heroId={kp.hero_id} size={18} className={kp.team === 0 ? "border-amber-team" : "border-sapphire-team"} /> : null}
                <span className={cn("max-w-24 truncate font-semibold", kp ? (kp.team === 0 ? "text-amber-team" : "text-sapphire-team") : "text-muted-foreground")}>{nmOf(kp)}</span>
                <span className="text-loss">✕</span>
                <span className={cn("max-w-24 truncate", vp?.team === 0 ? "text-amber-team" : "text-sapphire-team")}>{nmOf(vp)}</span>
                {vp && <HeroIcon heroId={vp.hero_id} size={18} className="opacity-70 grayscale" />}
              </div>;
            })}
          </div>
          {mvpRows && mvpSlot != null && (() => {
            const top = mvpRows[0]!, second = mvpRows[1];
            const p = bySlot.get(top.slot)!;
            const nm0 = names?.get(p.account_id ?? 0)?.personaname ?? heroes.get(p.hero_id)?.name;
            const fmtRaw = (k: string, v: number) => k === "kp" ? `${Math.round(v * 100)}%` : k === "nw" || k === "dmg" || k === "heal" || k === "obj" ? fmtK(v) : String(v);
            if (!mvpOpen) return <button onClick={() => setMvpOpen(true)} className="absolute bottom-3 left-3 border border-primary/60 bg-card/90 px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-primary backdrop-blur">♛ почему корона</button>;
            return <div className="absolute bottom-3 left-3 w-64 border border-primary/50 bg-card/92 p-2.5 text-[11px] backdrop-blur">
              <div className="mb-1.5 flex items-center gap-2">
                <span className="text-primary">♛</span><HeroIcon heroId={p.hero_id} size={22} className={p.team === 0 ? "border-amber-team" : "border-sapphire-team"} />
                <span className="min-w-0 flex-1 truncate font-display text-sm font-bold">{nm0}</span>
                <span className="tabular font-display text-sm font-bold text-primary">{top.sc.toFixed(0)}</span>
                <button onClick={() => setMvpOpen(false)} aria-label="Скрыть" className="text-muted-foreground hover:text-foreground">×</button>
              </div>
              {second && <p className="mb-1.5 font-mono text-[10px] text-muted-foreground">отрыв от №2: +{(top.sc - second.sc).toFixed(1)} очк.</p>}
              <div className="space-y-0.5">
                {top.parts.map((q) => (
                  <div key={q.k} className="grid grid-cols-[1fr_2.6rem_3.2rem] items-center gap-1.5">
                    <span className="truncate text-muted-foreground">{q.label}</span>
                    <span className="tabular text-right">{fmtRaw(q.k, q.raw)}</span>
                    <span className={cn("tabular text-right font-semibold", q.pts < 0 ? "text-loss" : "text-win")}>{q.pts >= 0 ? "+" : ""}{q.pts.toFixed(1)}</span>
                  </div>
                ))}
              </div>
              {mvpHistory.length > 0 && <div className="mt-2 border-t border-border pt-1.5">
                <p className="mb-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Изменение оценки</p>
                {mvpHistory.map((h) => (
                  <div key={h.t} className="grid grid-cols-[2.4rem_1fr_3rem] gap-1.5">
                    <span className="tabular text-muted-foreground">{fmtDuration(h.t)}</span>
                    <span className="truncate">{[h.dk && `+${h.dk} уб.`, h.da && `+${h.da} пом.`, h.dd && `+${h.dd} см.`].filter(Boolean).join(", ")}</span>
                    <span className={cn("tabular text-right font-semibold", h.dsc < 0 ? "text-loss" : "text-win")}>{h.dsc >= 0 ? "+" : ""}{h.dsc.toFixed(1)}</span>
                  </div>
                ))}
              </div>}
            </div>;
          })()}
          <PlayerMatchModal player={selP} name={selP?.account_id ? names?.get(selP.account_id)?.personaname : undefined} sec={sec} hp={selW?.health?.[Math.min(ti, selW.pts.length - 1)] ?? 100} onClose={() => setSel(null)} />
          {!md && <div className="absolute inset-0 grid place-items-center text-sm text-muted-foreground">Загрузка карты…</div>}
        </div>
        <div className="mt-3 border border-border bg-card/60 p-3">
          <div className="flex flex-wrap items-center gap-3">
            <button onClick={() => setPlay((v) => !v)} aria-label={play ? "Пауза" : "Играть"} className="grid h-10 w-10 shrink-0 place-items-center border border-primary bg-primary text-primary-foreground transition-transform hover:scale-105">{play ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}</button>
            <span className="tabular font-display text-2xl font-bold">{fmtDuration(sec)}</span>
            <span className="tabular font-mono text-[10px] text-muted-foreground">/ {fmtDuration((len - 1) * (paths!.interval_s || 1))}</span>
            <div className="ml-auto flex items-center gap-1">
              {[1, 2, 5, 10].map((s2) => (
                <button key={s2} onClick={() => setMult(s2)} className={cn("border px-2 py-1 font-mono text-[11px]", mult === s2 ? "border-primary bg-primary/15 text-primary" : "border-border text-muted-foreground hover:text-foreground")}>×{s2}</button>
              ))}
              <select value={mult} onChange={(e) => setMult(+e.target.value)} aria-label="Скорость" className="border border-border bg-secondary px-1.5 py-1 font-mono text-[11px]">
                {SPEEDS.map((s2) => <option key={s2} value={s2}>×{s2}</option>)}
              </select>
              <select value={quality} onChange={(e) => setQuality(e.target.value as keyof typeof QUALITY)} title="Качество воспроизведения" className="border border-border bg-secondary px-1.5 py-1 font-mono text-[11px]">
                {Object.entries(QUALITY).map(([k, q]) => <option key={k} value={k}>{q.label}</option>)}
              </select>
            </div>
          </div>
          {(() => {
            const dur = Math.max(1, (len - 1) * (paths!.interval_s || 1));
            const pct = (x: number) => `${Math.min(100, Math.max(0, (x / dur) * 100))}%`;
            const seek = (x: number) => setT(Math.max(0, Math.round(x / (paths!.interval_s || 1))));
            const allDeaths = players.flatMap((p) => (p.death_details ?? []).map((d) => ({ t: d.game_time_s, team: p.team })));
            return <div className="mt-3">
              <div className="relative h-7">
                {fights.map((f, i) => <button key={`f${i}`} onClick={() => seek(f.start - 5)} title={`Файт ${fmtDuration(f.start)} · ${f.amber}:${f.sapph}`} className="absolute top-0 h-3 bg-primary/30 hover:bg-primary/60" style={{ left: pct(f.start), width: `max(4px, ${((f.end - f.start) / dur) * 100}%)` }} />)}
                {objEvents.filter((e) => e.team >= 0).map((e, i) => <button key={`o${i}`} onClick={() => seek(e.t)} title={`${fmtDuration(e.t)} · ${e.text}`} className="absolute top-3.5 h-3 w-3 -translate-x-1/2 rotate-45 border border-background hover:scale-125" style={{ left: pct(e.t), background: teamCol(e.team) }} />)}
              </div>
              <div className="relative">
                <div className="pointer-events-none absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 bg-muted" />
                <div className="pointer-events-none absolute left-0 top-1/2 h-1.5 -translate-y-1/2 bg-primary" style={{ width: pct(sec) }} />
                {allDeaths.map((d, i) => <span key={i} aria-hidden className="pointer-events-none absolute top-1/2 h-2.5 w-px -translate-y-1/2" style={{ left: pct(d.t), background: teamCol(d.team === 0 ? 1 : 0), opacity: 0.7 }} />)}
                <input type="range" min={0} max={len - 1} step="any" value={t} onChange={(e) => setT(+e.target.value)} aria-label="Время матча" className="relative w-full cursor-pointer opacity-0" />
                <span aria-hidden className="pointer-events-none absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rotate-45 border-2 border-background bg-primary" style={{ left: pct(sec) }} />
              </div>
              <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                <span><span className="mr-1 inline-block h-2 w-3 bg-primary/40" />файты</span>
                <span><span className="mr-1 inline-block h-2 w-2 rotate-45 bg-amber-team" /><span className="mr-1 inline-block h-2 w-2 rotate-45 bg-sapphire-team" />разрушения</span>
                <span>| убийства</span><span>клик — перейти</span>
              </div>
            </div>;
          })()}
        </div>
        <ValueChart players={players} names={names} sec={sec} sel={sel} onSelect={setSel} fights={fights} onSeek={(s2) => setT(Math.round(s2 / (paths!.interval_s || 1)))} />
        <PlayerCompare players={players} names={names} sec={sec} />
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
          <span>щит — Guardian</span><span>шагоход — Walker</span><span>прямоугольник — Base Guardian</span><span>ромб — Shrine</span><span>корона — Patron</span><span>R — рифт, B — руна (пульсируют, когда активны; таймеры примерные)</span><span>нажмите на героя — карточка с билдом</span><span>U — урна</span><span>M — мид-босс</span><span>T — телепорт</span><span>● лагеря (красный — сильный)</span><span>◆ жёлтый — хранилище</span><span>пунктир — зиплайны</span>
        </div>
      </div>
      <div className="space-y-4">
        <div className="panel space-y-1 p-3 text-sm">
          <p className="mb-2 flex justify-between border-b border-border pb-1.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground"><span className="font-display text-sm normal-case tracking-normal text-foreground">Игроки</span><span>K/D/A · души</span></p>
          {[0, 1].map((team) => {
            const tp = players.filter((p) => p.team === team);
            const snapOf = (p: P) => [...(p.stats ?? [])].reverse().find((x) => x.time_stamp_s <= sec);
            const tot = tp.reduce((a, p) => a + (snapOf(p)?.net_worth ?? 0), 0);
            const maxNw = Math.max(1, ...players.map((p) => snapOf(p)?.net_worth ?? 0));
            return (
              <div key={team} className="mb-2">
                <div className={cn("mb-1 flex justify-between text-[11px] font-semibold", team === 0 ? "text-amber-team" : "text-sapphire-team")}><span>{team === 0 ? "Hidden King" : "Archmother"}</span><span className="tabular">{fmtK(tot)}</span></div>
                {tp.map((p) => {
                  const w = world.find((x) => x.slot === p.player_slot);
                  const hp = w?.health?.[Math.min(ti, (w?.pts.length ?? 1) - 1)] ?? 100;
                  const sn = snapOf(p);
                  return (
                    <button key={p.player_slot} onClick={() => setSel(p.player_slot)} className={cn("w-full rounded px-1 py-0.5 text-left hover:bg-secondary", sel === p.player_slot && "bg-secondary", mvpSlot === p.player_slot && hp > 0 && "bg-primary/10 ring-1 ring-primary/60", hp <= 0 && "opacity-40")}>
                      <div className="flex items-center gap-2">
                        <HeroIcon heroId={p.hero_id} size={24} className={team === 0 ? "border-amber-team" : "border-sapphire-team"} />
                        <span className="min-w-0 flex-1 truncate text-xs">{mvpSlot === p.player_slot && <span title="Сильнейший сейчас" className="mr-1 text-primary">♛</span>}{names?.get(p.account_id ?? 0)?.personaname ?? heroes.get(p.hero_id)?.name}</span>
                        {(() => { const st = streakOf(p.player_slot); return st >= 3 ? <span title={`Серия: ${st} убийств без смерти`} className="tabular text-[11px] font-bold text-primary">🔥{st}</span> : null; })()}
                        <span className="tabular text-[11px] text-muted-foreground">{`${kills.filter((k) => k.killer === p.player_slot && k.t <= sec).length}/${kills.filter((k) => k.victim === p.player_slot && k.t <= sec).length}/${sn?.assists ?? 0}`}</span>
                        <span className={cn("tabular w-10 text-right text-[11px] font-semibold", team === 0 ? "text-amber-team" : "text-sapphire-team")}>{sn ? fmtK(sn.net_worth ?? 0) : "—"}</span>
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
            <p className="mb-2 border-b border-border pb-1.5 font-display text-sm text-foreground">Ключевые файты</p>
            {fights.map((f, i) => (
              <button key={i} onClick={() => { setT(Math.max(0, Math.round((f.start - 8) / (paths!.interval_s || 1)))); setPlay(true); if (mult > 10) setMult(5); }}
                className={cn("flex w-full items-center gap-2 rounded px-1 py-1 text-left hover:bg-secondary", sec >= f.start - 8 && sec <= f.end + 2 && "bg-primary/10")}>
                <span className="tabular w-10 text-muted-foreground">{fmtDuration(f.start)}</span>
                <span className="text-amber-team tabular">{f.amber}</span><span className="text-muted-foreground">:</span><span className="text-sapphire-team tabular">{f.sapph}</span>
                <span className="flex-1 truncate">{f.amber === f.sapph ? "Размен" : f.amber > f.sapph ? "Hidden King выигрывает" : "Archmother выигрывает"} · {f.amber + f.sapph} смертей</span>
                <Play className="h-3 w-3 text-primary" />
              </button>
            ))}
          </div>
        )}
        {objEvents.length > 0 && (
          <div className="panel max-h-80 space-y-1 overflow-auto p-3 text-xs">
            <p className="mb-2 border-b border-border pb-1.5 font-display text-sm text-foreground">Объекты и события</p>
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

/** Rough win chance for Amber from the soul lead, weighted more as the game goes on. Own heuristic. */
export function winChance(a: number, b: number, sec: number) {
  if (a + b <= 0) return 0.5;
  const lead = (a - b) / ((a + b) / 2);
  const k = 4 + Math.min(1, sec / 1800) * 8;
  return 1 / (1 + Math.exp(-lead * k));
}

const CMP = [["net_worth", "Души"], ["kills", "Убийства"], ["deaths", "Смерти"], ["assists", "Помощь"], ["player_damage", "Урон"], ["player_healing", "Лечение"], ["creep_kills", "Крипы"], ["denies", "Денаи"], ["level", "Уровень"]] as const;

function PlayerCompare({ players, names, sec }: { players: P[]; names?: Map<number, { personaname: string }> | undefined; sec: number }) {
  const heroes = useHeroMap();
  const [a, setA] = useState(players.find((p) => p.team === 0)?.player_slot ?? 0);
  const [b, setB] = useState(players.find((p) => p.team === 1)?.player_slot ?? 1);
  const nm = (p: P) => names?.get(p.account_id ?? 0)?.personaname ?? heroes.get(p.hero_id)?.name ?? "";
  const pa = players.find((p) => p.player_slot === a), pb = players.find((p) => p.player_slot === b);
  const snap = (p?: P) => [...(p?.stats ?? [])].reverse().find((x) => x.time_stamp_s <= sec);
  const sa = snap(pa), sb = snap(pb);
  const [metric, setMetric] = useState<(typeof CMP)[number][0]>("net_worth");
  const series = (p?: P) => (p?.stats ?? []).map((x) => ({ t: x.time_stamp_s, v: (x[metric] as number | undefined) ?? 0 }));
  const ra = series(pa), rb = series(pb);
  const maxT = Math.max(60, ...ra.map((r) => r.t), ...rb.map((r) => r.t));
  const maxV = Math.max(1, ...ra.map((r) => r.v), ...rb.map((r) => r.v));
  const W = 800, H = 140;
  const line = (r: { t: number; v: number }[]) => r.map((q) => `${(q.t / maxT) * W},${H - (q.v / maxV) * (H - 8)}`).join(" ");
  const minutes = [...new Set([...ra, ...rb].map((r) => r.t))].sort((x, y) => x - y);
  const at = (r: { t: number; v: number }[], t: number) => [...r].reverse().find((q) => q.t <= t)?.v ?? 0;
  const picker = (v: number, other: number, set: (n: number) => void, side: 0 | 1) => (
    <div className="flex flex-1 flex-wrap justify-center gap-1.5">
      {players.map((p) => {
        const active = p.player_slot === v;
        const taken = p.player_slot === other;
        return (
          <button
            key={p.player_slot}
            onClick={() => set(p.player_slot)}
            title={nm(p)}
            className={cn(
              "flex w-16 flex-col items-center gap-0.5 rounded-md border p-1 transition-colors",
              active
                ? side === 0
                  ? "border-amber-team bg-amber-team/15"
                  : "border-sapphire-team bg-sapphire-team/15"
                : "border-transparent opacity-70 hover:border-border hover:opacity-100",
              taken && "opacity-30",
            )}
          >
            <HeroIcon heroId={p.hero_id} size={32} />
            <span className={cn("w-full truncate text-center text-[10px] leading-tight", active ? (side === 0 ? "text-amber-team" : "text-sapphire-team") : "text-muted-foreground")}>{nm(p)}</span>
          </button>
        );
      })}
    </div>
  );
  return (
    <div className="mt-4 rounded-lg bg-secondary/30 p-3">
      <p className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">Сравнение игроков · на {fmtDuration(sec)}</p>
      <div className="mb-3 flex items-start gap-3">
        {picker(a, b, setA, 0)}
        <span className="mt-3 shrink-0 text-xs font-semibold uppercase text-muted-foreground">vs</span>
        {picker(b, a, setB, 1)}
      </div>
      <div className="space-y-1.5">
        {CMP.map(([k, l]) => {
          const va = (sa?.[k] as number | undefined) ?? 0, vb = (sb?.[k] as number | undefined) ?? 0;
          const tot = va + vb || 1;
          const better = k === "deaths" ? va < vb : va > vb;
          return (
            <div key={k} className="grid grid-cols-[3.5rem_1fr_5rem_1fr_3.5rem] items-center gap-2 text-xs">
              <span className={cn("tabular text-right", va !== vb && better && "font-semibold text-primary")}>{fmtK(va)}</span>
              <div className="flex h-1.5 justify-end overflow-hidden rounded-full bg-muted"><div className="h-full bg-amber-team" style={{ width: `${(va / tot) * 100}%` }} /></div>
              <span className="text-center text-[10px] uppercase text-muted-foreground">{l}</span>
              <div className="h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full bg-sapphire-team" style={{ width: `${(vb / tot) * 100}%` }} /></div>
              <span className={cn("tabular", va !== vb && !better && "font-semibold text-primary")}>{fmtK(vb)}</span>
            </div>
          );
        })}
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-1">
        <span className="mr-1 text-[11px] uppercase tracking-wider text-muted-foreground">По минутам:</span>
        {CMP.map(([k, l]) => <button key={k} onClick={() => setMetric(k)} className={cn("rounded-full border px-2 py-0.5 text-[11px]", metric === k ? "border-primary/60 bg-primary/15 text-primary" : "border-border text-muted-foreground")}>{l}</button>)}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="mt-2 h-36 w-full rounded-md bg-background/50">
        <polyline points={line(ra)} fill="none" stroke="var(--team-amber)" strokeWidth={2.5} vectorEffect="non-scaling-stroke" />
        <polyline points={line(rb)} fill="none" stroke="var(--team-sapphire)" strokeWidth={2.5} vectorEffect="non-scaling-stroke" />
        <line x1={(sec / maxT) * W} x2={(sec / maxT) * W} y1={0} y2={H} stroke="var(--primary)" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="mt-2 overflow-x-auto">
        <table className="tabular text-[11px]">
          <tbody>
            {[["Мин", (t: number) => String(Math.round(t / 60)), ""], [pa ? nm(pa) : "", (t: number) => fmtK(at(ra, t)), "text-amber-team"], [pb ? nm(pb) : "", (t: number) => fmtK(at(rb, t)), "text-sapphire-team"], ["Разница", (t: number) => { const d = at(ra, t) - at(rb, t); return (d > 0 ? "+" : "") + fmtK(d); }, "text-muted-foreground"]].map(([l, f, c]) => (
              <tr key={l as string}>
                <td className={cn("sticky left-0 max-w-24 truncate bg-card pr-2", c as string)}>{l as string}</td>
                {minutes.map((t) => <td key={t} className={cn("px-1.5 text-right", c as string, t <= sec && "font-semibold")}>{(f as (t: number) => string)(t)}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
