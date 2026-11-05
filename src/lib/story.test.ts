import { describe, expect, it } from "vitest";
import { abilityOrder, findFights, mastery, turningPoint } from "./story";

describe("findFights", () => {
  it("groups 3+ deaths within 20s into one fight and picks the side that lost fewer", () => {
    const mk = (team: number, ts: number[]) => ({ account_id: team * 10 + ts[0]!, team, hero_id: 1, assigned_lane: 1, kills: 0, deaths: 0, assists: 0, net_worth: 0, last_hits: 0, denies: 0, stats: [], death_details: ts.map((t) => ({ game_time_s: t })) });
    const f = findFights([mk(0, [100]), mk(1, [105]), mk(1, [110]), mk(1, [500])]);
    expect(f).toHaveLength(1);
    expect(f[0]!.lost1).toBe(2);
    expect(f[0]!.winner).toBe(0);
  });
});

describe("turningPoint", () => {
  it("flags a comeback when the eventual loser led by 5k+", () => {
    const tp = turningPoint([{ t: 0, diff: 0 }, { t: 600, diff: 6000 }, { t: 720, diff: -2000 }], 1);
    expect(tp.comeback).toBe(true);
    expect(tp.swingStart).toBe(600);
    expect(tp.swingAmount).toBe(8000);
  });
});

describe("abilityOrder", () => {
  it("counts unlock as level 0 then upgrades", () => {
    const r = abilityOrder([{ game_time_s: 50, item_id: 7 }, { game_time_s: 10, item_id: 7 }, { game_time_s: 20, item_id: 99 }], new Set([7]));
    expect(r.map((x) => x.level)).toEqual([0, 1]);
  });
});

describe("mastery", () => {
  it("needs at least 3 games for any level", () => {
    expect(mastery(2, 1, 10).level).toBe(0);
  });
});
