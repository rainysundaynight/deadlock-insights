import { animate, motion, useReducedMotion } from "framer-motion";
import { useEffect, useRef, type ReactNode } from "react";
import { Button, type ButtonProps } from "@/components/ui/button";

export function MagneticButton(props: ButtonProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const reduce = useReducedMotion();
  return <motion.span ref={ref} className="inline-flex" onPointerMove={(e) => {
    if (reduce || e.pointerType !== "mouse" || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    animate(ref.current, { x: (e.clientX - r.left - r.width / 2) * 0.12, y: (e.clientY - r.top - r.height / 2) * 0.12 }, { duration: 0.2 });
  }} onPointerLeave={() => { if (ref.current) animate(ref.current, { x: 0, y: 0 }); }}><Button {...props} /></motion.span>;
}

export function RollingNumber({ value, decimals = 0, suffix = "" }: { value: number; decimals?: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const reduce = useReducedMotion();
  useEffect(() => {
    if (reduce) return;
    const controls = animate(0, value, { duration: 0.65, ease: "easeOut", onUpdate: (v) => {
      if (ref.current) ref.current.textContent = `${v.toFixed(decimals)}${suffix}`;
    } });
    return () => controls.stop();
  }, [value, decimals, suffix, reduce]);
  return <span ref={ref}>{value.toFixed(decimals)}{suffix}</span>;
}

export function LayoutItem({ children, className }: { children: ReactNode; className?: string }) {
  const reduce = useReducedMotion();
  return <motion.div layout={!reduce} className={className} initial={reduce ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>{children}</motion.div>;
}