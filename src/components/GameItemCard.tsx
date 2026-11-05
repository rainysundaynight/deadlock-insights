// Browser-only: Deadlock UI web components touch `window` on import.
import { DlItemCard, DlProvider } from "@deadlock-api/ui-react";
import { useEffect, useRef, type ReactNode } from "react";

// Russian names are longer than the English ones the cards were sized for.
const SHADOW_FIX = `
.mod-name{font-family:"PT Serif",Georgia,serif!important;font-size:10.5px!important;line-height:1.05!important;hyphens:auto;overflow-wrap:anywhere;padding:0 3px!important}
.mod-name.name-size-sm,.mod-name.name-size-xs{font-size:9.5px!important}
.mod-name-container{overflow:hidden}
`;
const TIP_FIX = `
.stats-block-props{flex-wrap:wrap!important;row-gap:4px}
.block-prop-item{min-width:0!important;flex:1 1 45%!important;overflow:visible!important}
.block-prop-item .attribute-name{white-space:normal!important;overflow-wrap:anywhere}
`;

export function GameItemsProvider({ children }: { children: ReactNode }) {
  return <DlProvider language={"russian" as never} tooltipTrigger={"hover" as never}>{children}</DlProvider>;
}

function injectAll(root: ShadowRoot | Document | null | undefined) {
  if (!root) return;
  if (root instanceof ShadowRoot && !root.querySelector("style[data-tip]")) {
    const st = document.createElement("style");
    st.setAttribute("data-tip", "1");
    st.textContent = TIP_FIX;
    root.appendChild(st);
  }
  root.querySelectorAll("*").forEach((e) => e.shadowRoot && injectAll(e.shadowRoot));
}
const fixTooltips = () => requestAnimationFrame(() => { injectAll(document); setTimeout(() => injectAll(document), 120); });

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
  return <DlItemCard ref={ref as never} lang="ru" className="game-item" itemId={itemId} itemData={data as never} variant={variant} hoverEffect="scale" showTierBadge={variant === "card"} tooltipTrigger="hover" onTooltipOpen={fixTooltips as never} onMouseEnter={fixTooltips} />;
}
