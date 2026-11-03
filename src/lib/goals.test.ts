import { describe, expect, it } from "vitest";
import type { MatchHistoryEntry } from "@/lib/api";
import { goalProgress } from "./goals";

const m = (deaths: number) => ({ player_deaths: deaths } as unknown as MatchHistoryEntry);

describe("goalProgress", () => {
  it("counts matches with at most 5 deaths in the last 10", () => {
    const h = [3, 5, 6, 9, 2, 1, 7, 5, 4, 8, 0].map(m);
    const r = goalProgress(h, "deaths", "lte", 5);
    expect(r.total).toBe(10);
    expect(r.met).toBe(6);
  });
});
