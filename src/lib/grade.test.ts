import { describe, expect, it } from "vitest";

import { gradeFromScore, perfScore } from "./grade";

describe("grades", () => {
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
