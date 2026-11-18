import { describe, expect, it } from "vitest";
import { champion, generateBracket, reportWinner, roundRobin } from "./bracket";
import { DRAFT_ORDER, timeoutAction, validateMove } from "./draft";

const ids = (n: number) => Array.from({ length: n }, (_, i) => `p${i + 1}`);
const play = (all: ReturnType<typeof generateBracket>) => {
  for (let guard = 0; guard < 100; guard++) {
    const m = all.find((x) => x.status === "ready");
    if (!m) break;
    reportWinner(all, m.key, m.side_a!);
  }
};

describe("bracket", () => {
  it("single elimination of 5 gives 3 byes and finishes with one champion", () => {
    const b = generateBracket("single", ids(5));
    expect(b.filter((m) => m.round === 1 && m.status === "finished")).toHaveLength(3);
    play(b);
    expect(champion(b, "single")).toBe("p1");
  });
  it("double elimination of 8 has 7 winners, 6 losers and a grand final", () => {
    const b = generateBracket("double", ids(8));
    expect(b).toHaveLength(14);
    play(b);
    expect(b.every((m) => m.status === "finished")).toBe(true);
    expect(champion(b, "double")).not.toBeNull();
  });
  it("double elimination of 6 completes despite byes", () => {
    const b = generateBracket("double", ids(6));
    play(b);
    expect(b.every((m) => m.status === "finished")).toBe(true);
  });
  it("round robin of 4 gives 6 matches", () => {
    expect(roundRobin(ids(4))).toHaveLength(6);
    expect(roundRobin(ids(5))).toHaveLength(10);
  });
});

describe("draft", () => {
  it("has 6 picks per side and 3 bans per side", () => {
    for (const side of ["a", "b"]) {
      expect(DRAFT_ORDER.filter((s) => s.side === side && s.kind === "pick")).toHaveLength(6);
      expect(DRAFT_ORDER.filter((s) => s.side === side && s.kind === "ban")).toHaveLength(3);
    }
  });
  it("rejects moves out of turn and duplicates", () => {
    expect(validateMove(0, "b", 1, [], [1, 2])).toMatch(/соперника/);
    expect(validateMove(1, "b", 1, [{ step: 0, side: "a", kind: "ban", hero_id: 1 }], [1, 2])).toMatch(/уже/);
  });
  it("timeout skips bans and randomly picks a free hero", () => {
    expect(timeoutAction(0, [], [1, 2]).hero_id).toBeNull();
    expect(timeoutAction(4, [{ step: 0, side: "a", kind: "ban", hero_id: 1 }], [1, 2]).hero_id).toBe(2);
  });
});
