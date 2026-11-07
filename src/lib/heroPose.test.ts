import { describe, expect, it } from "vitest";
import type { Hero } from "./api";
import { matchHeroPose } from "./heroPose";

const hero: Hero = {
  id: 1, name: "Infernus", class_name: "inferno", player_selectable: true,
  disabled: false, in_development: false,
  images: { hero_card_gloat_webp: "streak.webp", hero_card_critical_webp: "critical.webp", icon_hero_card_webp: "idle.webp" },
};

describe("match hero poses", () => {
  it("uses the streak artwork for a victory", () => {
    expect(matchHeroPose(hero, true)).toBe("streak.webp");
  });
  it("uses the critical artwork for a defeat", () => {
    expect(matchHeroPose(hero, false)).toBe("critical.webp");
  });
  it("falls back to the normal portrait when outcome artwork is absent", () => {
    expect(matchHeroPose({ ...hero, images: { icon_hero_card_webp: "idle.webp" } }, false)).toBe("idle.webp");
    expect(matchHeroPose(undefined, true)).toBeUndefined();
  });
});