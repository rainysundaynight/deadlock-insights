import { describe, expect, it } from "vitest";

import { gradeFromScore, perfScore, gradeHistory, gradeVsGlobal } from "./grade";

describe("grades", () => {
  it("uses the identical grade for match and profile history with one death in a 3094 second match", () => {
    const baseline = { k: 8, d: 8, a: 15, nw: 40000, lh: 180 };
    const match = gradeVsGlobal({ k: 6, d: 1, a: 26, nw: 89897, lh: 404, won: true }, baseline, 3094);
    const history = gradeHistory({ match_id: 131871467, hero_id: 7, hero_level: 30, start_time: 0, player_team: 1, player_kills: 6, player_deaths: 1, player_assists: 26, denies: 0, net_worth: 89897, last_hits: 404, match_duration_s: 3094, match_result: 1, game_mode: 1, match_mode: 1 }, baseline);
    expect(match.score).toBeGreaterThan(66);
    expect(history).toEqual(match);
  });
  it("maps score boundaries to D..S+", () => {
    expect(gradeFromScore(95)).toBe("S+");
    expect(gradeFromScore(80)).toBe("S");
    expect(gradeFromScore(70)).toBe("A");
    expect(gradeFromScore(55)).toBe("B");
    expect(gradeFromScore(45)).toBe("C");
    expect(gradeFromScore(10)).toBe("D");
  });
  it("average player in a win is B, in a loss is C", () => {
    const b = { k: 5, d: 5, a: 10, nw: 30000, lh: 100, dmg: 20000 };
    expect(gradeFromScore(perfScore({ ...b, won: true }, b))).toBe("B");
    expect(gradeFromScore(perfScore({ ...b, won: false }, b))).toBe("C");
  });
  it("double everything in a win is S+", () => {
    const b = { k: 5, d: 5, a: 10, nw: 30000, lh: 100, dmg: 20000 };
    expect(gradeFromScore(perfScore({ k: 10, d: 2, a: 20, nw: 60000, lh: 200, dmg: 40000, won: true }, b))).toBe("S+");
  });
});

import { explainGrade as _eg } from "./grade";
describe("explainGrade", () => {
  it("shows ratios vs average and the win bonus", () => {
    const l = _eg({ k: 10, d: 2, a: 10, nw: 40000, lh: 200, won: true }, { k: 5, d: 5, a: 8, nw: 20000, lh: 200 });
    expect(l).toContain("Крипы: 100% от среднего");
    expect(l.at(-1)).toBe("Победа: +10 баллов");
  });
});
