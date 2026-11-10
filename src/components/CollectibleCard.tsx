import { motion, useMotionValue, useReducedMotion, useSpring, useTransform, type MotionStyle, type MotionValue } from "framer-motion";
import type { ReactNode, PointerEvent } from "react";
import { cn } from "@/lib/utils";

/** Pointer-driven presentation only; never changes the exported image. */
export function CollectibleCard({ children, className }: { children: ReactNode; className?: string }) {
  const reduced = useReducedMotion();
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const active = useMotionValue(0);
  const spring = { stiffness: 190, damping: 26 };
  const rotateX = useSpring(useTransform(y, [-1, 1], [5, -5]), spring);
  const rotateY = useSpring(useTransform(x, [-1, 1], [-5, 5]), spring);
  const foilX = useTransform(x, [-1, 1], ["15%", "85%"]);
  const foilY = useTransform(y, [-1, 1], ["15%", "85%"]);
  const opacity = useSpring(active, spring);
  const foilStyle: MotionStyle & { "--foil-x": MotionValue<string>; "--foil-y": MotionValue<string> } = {
    opacity: reduced ? 0 : opacity, "--foil-x": foilX, "--foil-y": foilY,
  };
  const reset = () => { x.set(0); y.set(0); active.set(0); };
  const move = (e: PointerEvent<HTMLDivElement>) => {
    if (reduced || e.pointerType !== "mouse" || !window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    const bounds = e.currentTarget.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;
    x.set(Math.max(-1, Math.min(1, (e.clientX - bounds.left) / bounds.width * 2 - 1)));
    y.set(Math.max(-1, Math.min(1, (e.clientY - bounds.top) / bounds.height * 2 - 1)));
    active.set(1);
  };
  return <div className={cn("collectible-card", className)} onPointerMove={move} onPointerLeave={reset} onPointerCancel={reset} onBlur={reset}>
    <motion.div className="collectible-surface" style={{ rotateX: reduced ? 0 : rotateX, rotateY: reduced ? 0 : rotateY }}>
      {children}
      <motion.span aria-hidden className="collectible-foil" style={foilStyle} />
    </motion.div>
  </div>;
}