import { lazy, Suspense, useEffect, useState } from "react";

import type { Item } from "@/lib/api";
import { cn } from "@/lib/utils";

const LazyCard = lazy(() => import("@/components/GameItemCard"));

/** Deadlock UI item (client-only) with the original ui.deadlock-api.com tooltip on hover. */
export function GameItem({ item, size = 72, variant = "card", className, dim }: { item: Item; size?: number; variant?: "card" | "image"; className?: string; dim?: boolean; hint?: boolean }) {
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  const img = item.shop_image_webp ?? item.shop_image ?? item.image_webp ?? item.image;
  const fallback = <img src={img} alt={item.name} className="mx-auto object-contain" style={{ width: variant === "image" ? size : size * 0.7, height: variant === "image" ? size : size * 0.7 }} />;
  return (
    <span className={cn("game-item-wrap flex shrink-0 justify-center", variant === "image" && "game-item-image", dim && "opacity-40 grayscale", className)} style={{ width: size, ...(variant === "image" ? { height: size, ["--gi-size" as string]: `${size}px` } : {}) }}>
      {ready ? <Suspense fallback={fallback}><LazyCard itemId={item.id} data={item} variant={variant} /></Suspense> : fallback}
    </span>
  );
}
