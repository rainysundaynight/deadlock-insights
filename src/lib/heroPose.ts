import type { Hero } from "./api";

/** The API calls the game's celebratory/streak artwork `gloat`. */
export function matchHeroPose(hero: Hero | undefined, won: boolean) {
  if (!hero) return undefined;
  const images = hero.images;
  return (won
    ? images.hero_card_gloat_webp ?? images.hero_card_gloat
    : images.hero_card_critical_webp ?? images.hero_card_critical)
    ?? images.icon_hero_card_webp ?? images.icon_hero_card
    ?? images.icon_image_small_webp ?? images.icon_image_small;
}