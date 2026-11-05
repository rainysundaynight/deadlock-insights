import { useLocation } from "@tanstack/react-router";
import { animate, inView } from "framer-motion";
import { useEffect, type RefObject } from "react";

/** Fades/slides every `.panel` card into view as it scrolls in; re-scans on route change and new content. */
export function useRevealCards(root: RefObject<HTMLElement | null>) {
  const path = useLocation({ select: (l) => l.pathname });
  useEffect(() => {
    const el = root.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const seen = new WeakSet<Element>();
    const stops: (() => void)[] = [];
    const scan = () => {
      const fresh = [...el.querySelectorAll<HTMLElement>(".panel, .reveal-item")].filter((p) => !seen.has(p) && !p.closest("[data-motion-owner]") && !p.parentElement?.closest(".panel, .reveal-item"));
      fresh.forEach((p, i) => {
        seen.add(p);
        stops.push(
          inView(p, () => {
            // once only, GPU-friendly (no blur/filter), so fast scrolling stays smooth
            animate(p, { opacity: [0, 1], y: [16, 0] }, { duration: 0.35, delay: (i % 4) * 0.04, ease: "easeOut" });
          }, { amount: 0.05 }),
        );
      });
    };
    scan();
    let raf = 0;
    const mo = new MutationObserver(() => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; scan(); }); });
    mo.observe(el, { childList: true, subtree: true });
    return () => { cancelAnimationFrame(raf); mo.disconnect(); stops.forEach((s) => s()); };
  }, [root, path]);
}
