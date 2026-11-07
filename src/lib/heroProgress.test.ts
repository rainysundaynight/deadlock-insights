import { describe, expect, it } from "vitest";
import { heroProgress } from "./heroProgress";
import type { MatchHistoryEntry } from "./api";

const m = (i: number, won: boolean, hero = 1): MatchHistoryEntry => ({
  match_id: i, hero_id: hero, hero_level: 30, start_time: i, player_team: 0, player_kills: 5, player_deaths: 2,
  player_assists: 5, denies: 0, net_worth: 30000, last_hits: 100, match_duration_s: 1800, match_result: won ? 0 : 1, game_mode: 1, match_mode: 1,
});

describe("heroProgress", () => {
  it("skips heroes with fewer than 6 games", () => {
    expect(heroProgress([1, 2, 3, 4, 5].map((i) => m(i, true)))).toEqual([]);
  });
  it("marks improvement when recent games win more than older ones", () => {
    const h = [...Array.from({ length: 10 }, (_, i) => m(i, false)), ...Array.from({ length: 10 }, (_, i) => m(100 + i, true))];
    const p = heroProgress(h)[0]!;
    expect(p.recent.winrate).toBe(1);
    expect(p.previous?.winrate).toBe(0);
    expect(p.trend).toBe("up");
  });
});
