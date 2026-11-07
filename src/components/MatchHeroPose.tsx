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
      <span className="absolute bottom-1 left-1/2 -translate-x-1/2 border border-border bg-background px-1.5 font-mono text-[9px] text-foreground">LVL {level}</span>
    </div>
  );
}