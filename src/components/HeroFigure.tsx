import type { CSSProperties } from "react";
import type { Hero } from "@/lib/api";
import { cn } from "@/lib/utils";

/** Unframed game artwork with a stable footprint and touch-visible action pose. */
export function HeroFigure({ hero, className }: { hero: Hero | undefined; className?: string }) {
  if (!hero) return null;
  const idle = hero.images.icon_hero_card_webp ?? hero.images.icon_hero_card ?? hero.images.icon_image_small_webp;
  const action = hero.images.hero_card_gloat_webp ?? hero.images.hero_card_gloat;
  return (
    <div className={cn("dossier-figure", className)} style={{ "--hero": hero.colors?.style_hex ?? "var(--primary)" } as CSSProperties}>
      {idle && <img src={idle} alt={hero.name} className={cn("dossier-figure-art", action && "dossier-figure-idle")} />}
      {action && <img src={action} alt={idle ? "" : hero.name} aria-hidden={!!idle} className="dossier-figure-art dossier-figure-action" />}
    </div>
  );
}