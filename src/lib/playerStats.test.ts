import { describe, expect, it } from "vitest";
import { deviationFromAverage } from "./playerStats";

describe("DNA comparison", () => {
  it("131 percent of average means 31 percent above average", () => {
    expect(deviationFromAverage(131)).toBe(31);
  });
  it("average is zero deviation and below-average values stay negative", () => {
    expect(deviationFromAverage(100)).toBe(0);
    expect(deviationFromAverage(85)).toBe(-15);
  });
});