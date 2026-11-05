import { motion } from "framer-motion";
import { CheckCircle2, Info, XCircle } from "lucide-react";
import type { ReactNode } from "react";

import { gradeFromScore, type Grade } from "@/lib/grade";
import { cn } from "@/lib/utils";

const GRADE_BG: Record<Grade, string> = {
  "S+": "from-primary/40 to-primary/5 border-primary text-primary",
  S: "from-primary/30 to-primary/5 border-primary/80 text-primary",
  A: "from-win/30 to-win/5 border-win/70 text-win",
  B: "from-muted to-transparent border-border text-foreground",
  C: "from-loss/20 to-loss/5 border-loss/50 text-loss",
  D: "from-loss/35 to-loss/5 border-loss text-loss",
};

/** Large letter grade in an Art Deco seal with score scale. */
export function GradeSeal({ score, caption, size = "lg" }: { score: number; caption?: ReactNode; size?: "lg" | "md" }) {
  const g = gradeFromScore(score);
  return (
    <div className="flex flex-col items-center gap-2">
      <motion.div
        initial={{ scale: 0.6, rotate: -8, opacity: 0 }} animate={{ scale: 1, rotate: 0, opacity: 1 }} transition={{ type: "spring", stiffness: 220, damping: 16 }}
        className={cn("relative grid place-items-center border-2 bg-gradient-to-b", GRADE_BG[g], size === "lg" ? "h-32 w-32" : "h-20 w-20")}
        style={{ clipPath: "polygon(50% 0, 100% 25%, 100% 75%, 50% 100%, 0 75%, 0 25%)" }}
      >
        <span className={cn("font-display font-black leading-none", size === "lg" ? "text-6xl" : "text-4xl")}>{g}</span>
      </motion.div>
      <div className="w-full max-w-40">
        <div className="relative h-1.5 bg-muted">
          <motion.div className="absolute inset-y-0 left-0 bg-primary" initial={{ width: 0 }} animate={{ width: `${score}%` }} transition={{ duration: 0.8 }} />
        </div>
        <div className="mt-1 flex justify-between font-mono text-[9px] text-muted-foreground"><span>D</span><span>C</span><span>B</span><span>A</span><span>S</span><span>S+</span></div>
      </div>
      {caption && <p className="text-center font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{caption}</p>}
    </div>
  );
}

/** Metric vs. average: 100 = average, bar diverges left (worse) / right (better). */
export function MetricBar({ label, v, sub }: { label: string; v: number; sub?: string }) {
  const d = Math.max(-100, Math.min(100, v - 100));
  const good = d >= 0;
  return (
    <div className="grid grid-cols-[92px_1fr_52px] items-center gap-3 py-1.5">
      <span className="truncate text-xs font-medium">{label}{sub && <span className="block font-mono text-[10px] text-muted-foreground">{sub}</span>}</span>
      <div className="relative h-2 bg-muted/60">
        <span className="absolute inset-y-[-3px] left-1/2 w-px bg-foreground/40" />
        <motion.span
          className={cn("absolute inset-y-0", good ? "left-1/2 bg-win" : "right-1/2 bg-loss")}
          initial={{ width: 0 }} whileInView={{ width: `${Math.abs(d) / 2}%` }} viewport={{ once: true }} transition={{ duration: 0.7, ease: "easeOut" }}
        />
      </div>
      <span className={cn("tabular text-right font-mono text-xs font-semibold", good ? "text-win" : "text-loss")}>{good ? "+" : ""}{Math.round(d)}%</span>
    </div>
  );
}

export type ReportTip = { tone: "good" | "bad" | "info"; title: string; text: string };

const TONE = {
  good: { I: CheckCircle2, c: "text-win", b: "border-l-win", h: "Сильные стороны" },
  bad: { I: XCircle, c: "text-loss", b: "border-l-loss", h: "Что улучшить" },
  info: { I: Info, c: "text-primary", b: "border-l-primary", h: "Заметки" },
} as const;

/** Tips grouped into columns by tone, each as a numbered dispatch. */
export function TipColumns({ tips, empty = "Недостаточно данных." }: { tips: ReportTip[]; empty?: string }) {
  const groups = (["bad", "good", "info"] as const).map((k) => ({ k, items: tips.filter((t) => t.tone === k) })).filter((g) => g.items.length);
  if (!groups.length) return <p className="text-sm text-muted-foreground">{empty}</p>;
  return (
    <div className={cn("grid gap-4", groups.length > 1 && "md:grid-cols-2", groups.length > 2 && "xl:grid-cols-3")}>
      {groups.map(({ k, items }) => {
        const t = TONE[k];
        return (
          <div key={k}>
            <p className={cn("mb-2 flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.2em]", t.c)}><t.I className="h-3.5 w-3.5" />{t.h} · {items.length}</p>
            <ol className="space-y-2">
              {items.map((x, i) => (
                <motion.li key={x.title + i} initial={{ opacity: 0, x: -8 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.05 }}
                  className={cn("border border-border/60 border-l-2 bg-card/60 p-3", t.b)}>
                  <p className="text-sm font-semibold"><span className="mr-2 font-mono text-[10px] text-muted-foreground">{String(i + 1).padStart(2, "0")}</span>{x.title}</p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{x.text}</p>
                </motion.li>
              ))}
            </ol>
          </div>
        );
      })}
    </div>
  );
}
