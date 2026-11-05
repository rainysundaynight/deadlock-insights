// Browser-only: Deadlock UI web components touch `window` on import.
import { DlItemCard, DlProvider } from "@deadlock-api/ui-react";
import type { ReactNode } from "react";

export function GameItemsProvider({ children }: { children: ReactNode }) {
  return <DlProvider language={"russian" as never} tooltipPlacement="auto" tooltipDelay={250}>{children}</DlProvider>;
}

export default function GameItemCard({ itemId }: { itemId: number }) {
  return <DlItemCard itemId={itemId} variant="card" hoverEffect="scale" showTierBadge tooltipTrigger="hover" />;
}
