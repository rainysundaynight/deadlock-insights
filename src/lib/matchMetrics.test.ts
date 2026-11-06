import { describe, expect, it } from "vitest";
import { compareMetric } from "./matchMetrics";

describe("match metric comparisons", () => {
  it("less received damage is favorable even when 6378 below the team mean", () => {
    const result = compareMetric(50167, [50167, 34063, 44052, 52706, 88617, 69663], "lower");
    expect(result.avg - 50167).toBeCloseTo(6377.6667, 3);
    expect(result.rank).toBe(3);
    expect(result.tone).toBe("good");
  });
  it("third team damage remains favorable despite an outlier lifting the mean", () => {
    const result = compareMetric(61108, [61108, 57929, 43788, 52708, 102133, 66470]);
    expect(result.rank).toBe(3);
    expect(result.avg).toBeGreaterThan(61108);
    expect(result.tone).toBe("good");
  });
  it("fewer deaths means a higher survival rank", () => {
    expect(compareMetric(1, [9, 1, 9, 8, 10, 13], "lower").rank).toBe(1);
    expect(compareMetric(9, [9, 1, 9, 8, 10, 13], "lower").tone).toBe("bad");
  });
  it("tied and solo metrics remain neutral", () => {
    expect(compareMetric(0, [0, 0, 0]).tone).toBe("neutral");
    expect(compareMetric(12, [12]).percentile).toBe(0.5);
  });
});