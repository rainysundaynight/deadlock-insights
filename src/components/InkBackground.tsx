import { useEffect, useRef } from "react";

/** Halftone dot field that swells and pushes away from the cursor (inspired by React Bits "Dot Grid"). */
export function InkBackground() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const GAP = 22;
    const ink = getComputedStyle(document.documentElement).getPropertyValue("--primary").trim();
    const red = getComputedStyle(document.documentElement).getPropertyValue("--telemetry").trim();
    let w = 0, h = 0, raf = 0;
    const mouse = { x: -9999, y: -9999, tx: -9999, ty: -9999 };

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = window.innerWidth; h = window.innerHeight;
      canvas.width = w * dpr; canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    const move = (e: PointerEvent) => { mouse.tx = e.clientX; mouse.ty = e.clientY; };
    const leave = () => { mouse.tx = -9999; mouse.ty = -9999; };

    const draw = () => {
      mouse.x += (mouse.tx - mouse.x) * 0.12;
      mouse.y += (mouse.ty - mouse.y) * 0.12;
      ctx.clearRect(0, 0, w, h);
      const R = 140;
      for (let y = GAP / 2; y < h; y += GAP) {
        for (let x = GAP / 2; x < w; x += GAP) {
          const dx = x - mouse.x, dy = y - mouse.y;
          const d = Math.hypot(dx, dy);
          const k = d < R ? 1 - d / R : 0;
          const e = k * k;
          const px = x + (d ? (dx / d) * e * 10 : 0);
          const py = y + (d ? (dy / d) * e * 10 : 0);
          ctx.globalAlpha = 0.04 + e * 0.3;
          ctx.fillStyle = e > 0.35 ? red : ink;
          ctx.beginPath();
          ctx.arc(px, py, 0.9 + e * 3.2, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      if (!reduce) raf = requestAnimationFrame(draw);
    };

    resize();
    draw();
    window.addEventListener("resize", resize);
    window.addEventListener("pointermove", move);
    document.addEventListener("pointerleave", leave);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", move);
      document.removeEventListener("pointerleave", leave);
    };
  }, []);

  return <canvas ref={ref} aria-hidden className="pointer-events-none fixed inset-0 z-0" />;
}
