import { describe, expect, it } from "vitest";
import { laneResults, type APlayer } from "./analysis";

const mk = (team: number, lane: number, nw9: number): APlayer => ({
  account_id: Math.random(), team, hero_id: 1, assigned_lane: lane, kills: 0, deaths: 0, assists: 0, net_worth: 0, last_hits: 0, denies: 0,
  stats: [{ time_stamp_s: 540, net_worth: nw9 } as never],
});

describe("laneResults", () => {
  it("picks the team with more souls at 9 minutes as lane winner", () => {
    const r = laneResults([mk(0, 1, 5000), mk(0, 1, 5000), mk(1, 1, 4000), mk(1, 1, 4000)]);
    expect(r[0].winner).toBe(0);
    expect(r[0].diff).toBe(2000);
  });
  it("calls a lane even when the gap is under 3%", () => {
    const r = laneResults([mk(0, 4, 5000), mk(1, 4, 4900)]);
    expect(r[0].winner).toBeNull();
  });
});
