import { describe, expect, it } from "vitest";
import { buildTierList, tierFor } from "./tier";

describe("tier list", () => {
  it("maps score thresholds to tiers", () => {
    expect(tierFor(3)).toBe("S");
    expect(tierFor(1.5)).toBe("A");
    expect(tierFor(0)).toBe("B");
    expect(tierFor(-1)).toBe("C");
    expect(tierFor(-2.5)).toBe("D");
  });
  it("ranks a 55% hero above a 45% hero with equal picks", () => {
    const r = buildTierList([
      { hero_id: 1, wins: 4500, matches: 10000 },
      { hero_id: 2, wins: 5500, matches: 10000 },
    ]);
    expect(r[0]!.hero_id).toBe(2);
    expect(r[0]!.tier).toBe("S");
    expect(r[1]!.tier).toBe("D");
  });
});
