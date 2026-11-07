import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { useState } from "react";

import { HeroIcon, SectionTitle, useHeroMap } from "@/components/dl";
import { critRate, damageTargets, defense, killTypes, type Part, type Snap } from "@/lib/damage";
import { fmtK } from "@/lib/format";
import { cn } from "@/lib/utils";

interface P { account_id: number; team: number; hero_id: number; stats: Snap[] }
type Names = Map<number, { personaname: string }> | undefined;

const TONES = ["bg-primary", "bg-telemetry", "bg-win", "bg-loss"];

function Stack({ parts }: { parts: Part[] }) {
  return (
    <div className="flex h-2 overflow-hidden bg-muted/60">
      {parts.map((p, i) => p.pct > 0 && <span key={p.key} className={TONES[i % TONES.length]} style={{ width: `${p.pct}%` }} title={`${p.label}: ${p.pct.toFixed(1)}%`} />)}
    </div>
  );
}

function Group({ title, parts, raw = fmtK }: { title: string; parts: Part[]; raw?: (n: number) => string }) {
  return (
    <div className="min-w-0">
      <p className="game-status-plate mb-2 text-[10px] text-muted-foreground">{title}</p>
      <Stack parts={parts} />
      <ul className="mt-2 space-y-1">
        {parts.map((p, i) => (
          <li key={p.key} className="grid grid-cols-[10px_minmax(0,1fr)_auto_44px] items-center gap-2 text-xs">
            <span className={cn("h-2 w-2", TONES[i % TONES.length])} />
            <span className="truncate text-muted-foreground">{p.label}</span>
            <span className="tabular font-semibold">{raw(p.value)}</span>
            <span className="tabular text-right font-mono text-[10px] text-muted-foreground">{p.pct.toFixed(1)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Expandable per-player breakdown of damage by target, kill type and defense. */
export function DamageTypes({ players, names }: { players: P[]; names?: Names }) {
  const heroes = useHeroMap();
  const [open, setOpen] = useState<number | null>(null);
  const rows = [...players].sort((a, b) => a.team - b.team || Number(b.stats.at(-1)?.["player_damage"] ?? 0) - Number(a.stats.at(-1)?.["player_damage"] ?? 0));
  return (
    <section className="panel p-5">
      <SectionTitle right={<span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">нажмите на игрока</span>}>Типы урона</SectionTitle>
      <div className="divide-y divide-border/50">
        {rows.map((p) => {
          const s = p.stats.at(-1);
          const targets = damageTargets(s);
          const total = targets.reduce((a, b) => a + b.value, 0);
          const isOpen = open === p.account_id;
          return (
            <div key={p.account_id}>
              <button onClick={() => setOpen(isOpen ? null : p.account_id)} aria-expanded={isOpen} className="grid w-full grid-cols-[28px_minmax(0,1fr)_minmax(0,1.4fr)_auto_16px] items-center gap-3 py-2.5 text-left hover:bg-primary/5">
                <HeroIcon heroId={p.hero_id} size={26} />
                <span className={cn("truncate text-sm", p.team === 0 ? "text-amber-team" : "text-sapphire-team")}>{names?.get(p.account_id)?.personaname ?? heroes.get(p.hero_id)?.name}</span>
                <Stack parts={targets} />
                <span className="tabular text-sm font-semibold">{fmtK(total)}</span>
                <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", isOpen && "rotate-180")} />
              </button>
              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
                    <div className="grid gap-5 pb-4 pt-1 sm:grid-cols-2 lg:grid-cols-3">
                      <Group title="Куда нанесён урон" parts={targets} />
                      <Group title="Чем добиты враги" parts={killTypes(s)} raw={(n) => String(n)} />
                      <Group title="Входящий урон" parts={defense(s)} />
                    </div>
                    <p className="pb-4 font-mono text-[10px] uppercase text-muted-foreground">
                      Криты по героям: {critRate(s).toFixed(1)}% · Хедшот-убийств: {Number(s?.["headshot_kills"] ?? 0)} · Урон себе: {fmtK(Number(s?.["self_damage"] ?? 0))}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-xs text-muted-foreground">Разделения урона на оружие и духовную силу в данных матча нет — показываем цели урона, способ добивания и защиту.</p>
    </section>
  );
}
