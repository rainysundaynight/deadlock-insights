import { describe, expect, it } from "vitest";
import { coachNotes, type CoachPlayer } from "./coach";
import { damageTargets, defense } from "./damage";

const mk = (o: Partial<CoachPlayer> & { s?: Record<string, number> }): CoachPlayer => ({
  account_id: Math.random(), team: 0, hero_id: 1, kills: 5, deaths: 3, assists: 5, net_worth: 30000, last_hits: 200, denies: 0, ...o, stats: [o.s ?? {}],
});

describe("coachNotes", () => {
  it("flags a player who died 30%+ of team deaths", () => {
    const me = mk({ deaths: 9 });
    const lobby = [me, mk({ deaths: 3 }), mk({ deaths: 3 }), mk({ deaths: 3, team: 1 })];
    expect(coachNotes(me, lobby, 1800, 1).find((n) => n.id === "deaths")?.tone).toBe("bad");
  });
  it("flags low objective damage share below 8%", () => {
    const me = mk({ s: { boss_damage: 500 } });
    const lobby = [me, mk({ s: { boss_damage: 20000 } })];
    expect(coachNotes(me, lobby, 1800, 0).find((n) => n.id === "objectives")?.tone).toBe("bad");
  });
});

describe("damage breakdown", () => {
  it("splits targets into percentages summing to 100", () => {
    const p = damageTargets({ player_damage: 30000, creep_damage: 10000, neutral_damage: 0, boss_damage: 10000 });
    expect(p[0]!.pct).toBe(60);
    expect(p.reduce((s, x) => s + x.pct, 0)).toBeCloseTo(100);
  });
  it("defense share is relative to all incoming damage", () => {
    expect(defense({ player_damage_taken: 50, damage_mitigated: 30, damage_absorbed: 20 })[1]!.pct).toBe(30);
  });
});
