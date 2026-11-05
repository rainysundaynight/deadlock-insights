import { lazy, Suspense, useEffect, useState } from "react";

import { ItemHint } from "@/components/ItemHint";
import type { Item } from "@/lib/api";

const LazyCard = lazy(() => import("@/components/GameItemCard"));

/** In-game style item card (client-only) with our own Russian hint on hover. */
export function GameItem({ item, size = 72, hint = true }: { item: Item; size?: number; hint?: boolean }) {
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  const fallback = <img src={item.shop_image_webp ?? item.image_webp} alt={item.name} className="mx-auto object-contain" style={{ width: size * 0.7, height: size * 0.7 }} />;
  const card = (
    <span className="flex shrink-0 justify-center overflow-hidden" style={{ width: size }}>
      {ready ? <Suspense fallback={fallback}><LazyCard itemId={item.id} data={item} /></Suspense> : fallback}
    </span>
  );
  return hint ? <ItemHint item={item}>{card}</ItemHint> : card;
}
