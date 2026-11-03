import { describe, expect, it } from "vitest";

import { heroTrends } from "./trends";

describe("heroTrends", () => {
  it("compares last window against previous window", () => {
    const rows = [
      { hero_id: 1, bucket: 1, wins: 40, matches: 100, matches_per_bucket: 1000 },
      { hero_id: 1, bucket: 2, wins: 60, matches: 100, matches_per_bucket: 1000 },
    ];
    const [t] = heroTrends(rows, 1, 10);
    expect(t.prevWr).toBe(0.4);
    expect(t.recentWr).toBe(0.6);
    expect(t.delta).toBeCloseTo(0.2);
  });
  it("drops heroes below the match threshold", () => {
    expect(heroTrends([{ hero_id: 1, bucket: 1, wins: 1, matches: 5 }, { hero_id: 1, bucket: 2, wins: 1, matches: 5 }], 1, 10)).toEqual([]);
  });
});
