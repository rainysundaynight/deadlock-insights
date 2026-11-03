import { describe, expect, it } from "vitest";
import { potentialBadge } from "./potentialRank";

describe("potentialBadge", () => {
  it("uses the lobby median at 50% winrate", () => {
    expect(potentialBadge([81, 83, 85, 85, 86], 0.5)).toBe(85);
  });
  it("adds a subrank per 5% winrate above 50%, crossing tiers", () => {
    expect(potentialBadge([85, 85, 85, 85, 85], 0.6)).toBe(91);
  });
  it("needs at least 5 ranked lobby players", () => {
    expect(potentialBadge([85, 85, 0, 0], 0.5)).toBeNull();
  });
});
