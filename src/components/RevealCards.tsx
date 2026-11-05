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
      const fresh = [...el.querySelectorAll<HTMLElement>(".panel, .reveal-item")].filter((p) => !seen.has(p));
      fresh.forEach((p, i) => {
        seen.add(p);
        stops.push(
          inView(p, () => {
            const a = animate(p, { opacity: [0.35, 1], y: [12, 0] }, { duration: 0.5, delay: (i % 6) * 0.035, ease: [0.22, 1, 0.36, 1] });
            return () => a.stop();
          }, { amount: 0.05 }),
        );
      });
    };
    scan();
    const mo = new MutationObserver(scan);
    mo.observe(el, { childList: true, subtree: true });
    return () => { mo.disconnect(); stops.forEach((s) => s()); };
  }, [root, path]);
}
