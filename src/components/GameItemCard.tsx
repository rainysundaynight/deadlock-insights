// Browser-only: Deadlock UI web components touch `window` on import.
import { DlItemCard, DlProvider } from "@deadlock-api/ui-react";
import { useEffect, useRef, type ReactNode } from "react";

// Russian names are longer than the English ones the cards were sized for.
const SHADOW_FIX = `
.mod-name{font-family:"PT Serif",Georgia,serif!important;font-size:10.5px!important;line-height:1.05!important;hyphens:auto;overflow-wrap:anywhere;padding:0 3px!important}
.mod-name.name-size-sm,.mod-name.name-size-xs{font-size:9.5px!important}
.mod-name-container{overflow:hidden}
`;

export function GameItemsProvider({ children }: { children: ReactNode }) {
  return <DlProvider language={"russian" as never} tooltipTrigger={"hover" as never}>{children}</DlProvider>;
}

export default function GameItemCard({ itemId, data, variant = "card" }: { itemId: number; data?: unknown; variant?: "card" | "icon" | "image" }) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    let tries = 0;
    const t = setInterval(() => {
      const root = ref.current?.shadowRoot;
      if (root && !root.querySelector("style[data-fix]")) {
        const s = document.createElement("style");
        s.setAttribute("data-fix", "1");
        s.textContent = SHADOW_FIX;
        root.appendChild(s);
      }
      if (root || ++tries > 40) clearInterval(t);
    }, 50);
    return () => clearInterval(t);
  }, []);
  return <DlItemCard ref={ref as never} lang="ru" className="game-item" itemId={itemId} itemData={data as never} variant={variant} hoverEffect="scale" showTierBadge={variant === "card"} tooltipTrigger="hover" />;
}
