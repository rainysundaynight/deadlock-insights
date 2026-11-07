/** Damage breakdown by type from the final stats snapshot. The match data has no bullet-vs-spirit damage split. */
export type Snap = Partial<Record<string, number | unknown>>;

export interface Part { key: string; label: string; value: number; pct: number }

const num = (s: Snap | undefined, k: string) => { const v = s?.[k]; return typeof v === "number" && Number.isFinite(v) ? Math.max(0, v) : 0; };

function parts(s: Snap | undefined, defs: [string, string][]): Part[] {
  const vals = defs.map(([key, label]) => ({ key, label, value: num(s, key) }));
  const total = vals.reduce((a, b) => a + b.value, 0);
  return vals.map((v) => ({ ...v, pct: total ? (v.value / total) * 100 : 0 }));
}

/** Where the damage went: heroes, lane creeps, jungle, objectives. */
export const damageTargets = (s: Snap | undefined) => parts(s, [
  ["player_damage", "По героям"], ["creep_damage", "По крипам"], ["neutral_damage", "По нейтралам"], ["boss_damage", "По объектам"],
]);

/** How kills were finished. */
export const killTypes = (s: Snap | undefined) => parts(s, [
  ["bullet_kills", "Оружием"], ["ability_kills", "Способностями"], ["melee_kills", "Ближним боем"],
]);

/** Damage that never reached health: mitigated by resist, absorbed by barriers. Share is relative to all incoming damage. */
export function defense(s: Snap | undefined): Part[] {
  const taken = num(s, "player_damage_taken"), mit = num(s, "damage_mitigated"), abs = num(s, "damage_absorbed");
  const total = taken + mit + abs;
  const pct = (v: number) => (total ? (v / total) * 100 : 0);
  return [
    { key: "player_damage_taken", label: "Дошло до здоровья", value: taken, pct: pct(taken) },
    { key: "damage_mitigated", label: "Снижено резистами", value: mit, pct: pct(mit) },
    { key: "damage_absorbed", label: "Поглощено барьерами", value: abs, pct: pct(abs) },
  ];
}

/** Share of bullet hits on heroes that were crits (headshots). */
export function critRate(s: Snap | undefined) {
  const hit = num(s, "hero_bullets_hit");
  return hit ? (num(s, "hero_bullets_hit_crit") / hit) * 100 : 0;
}
