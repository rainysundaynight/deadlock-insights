// Browser-only: Deadlock UI web components touch `window` on import.
import { DlItemCard, DlProvider } from "@deadlock-api/ui-react";
import type { ReactNode } from "react";

export function GameItemsProvider({ children }: { children: ReactNode }) {
  return <DlProvider language={"russian" as never} tooltipTrigger={"none" as never}>{children}</DlProvider>;
}

export default function GameItemCard({ itemId, data, variant = "card" }: { itemId: number; data?: unknown; variant?: "card" | "icon" }) {
  return <DlItemCard className="game-item" itemId={itemId} itemData={data as never} variant={variant} hoverEffect="scale" showTierBadge={variant === "card"} tooltipTrigger="none" />;
}
