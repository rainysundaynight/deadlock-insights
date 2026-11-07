import { useState } from "react";
import type { Hero } from "@/lib/api";
import { matchHeroPose } from "@/lib/heroPose";
import { cn } from "@/lib/utils";

export function MatchHeroPose({ hero, won, level }: { hero: Hero | undefined; won: boolean; level: number }) {
  const src = matchHeroPose(hero, won);
  const [failedSrc, setFailedSrc] = useState<string>();
  const fallback = hero?.images.icon_hero_card_webp ?? hero?.images.icon_hero_card;
  const visibleSrc = failedSrc === src ? fallback : src;
  return (
    <div className={cn("match-outcome-portrait", won ? "match-outcome-win" : "match-outcome-loss")}>
      {visibleSrc && <img src={visibleSrc} alt={hero?.name ?? "Герой"} loading="lazy" decoding="async" onError={() => setFailedSrc(visibleSrc)} className="match-outcome-art" />}
      <span className="match-outcome-level" aria-label={`Уровень ${level}`}>{level}</span>
    </div>
  );
}