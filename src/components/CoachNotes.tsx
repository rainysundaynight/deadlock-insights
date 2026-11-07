import { CheckCircle2, AlertTriangle } from "lucide-react";
import { useMemo, useState } from "react";

import { HeroIcon, SectionTitle, useHeroMap } from "@/components/dl";
import { coachNotes, type CoachPlayer } from "@/lib/coach";
import { cn } from "@/lib/utils";

type Names = Map<number, { personaname: string }> | undefined;

/** «Разбор тренера»: personal observations for one chosen player. */
export function CoachNotes({ players, names, durationS, winner }: { players: CoachPlayer[]; names?: Names; durationS: number; winner: number }) {
  const heroes = useHeroMap();
  const [sel, setSel] = useState(players[0]?.account_id);
  const p = players.find((x) => x.account_id === sel) ?? players[0];
  const notes = useMemo(() => (p ? coachNotes(p, players, durationS, winner) : []), [p, players, durationS, winner]);
  if (!p) return null;
  return (
    <section className="panel mb-8 p-5">
      <SectionTitle>Разбор тренера</SectionTitle>
      <div className="mb-5 flex flex-wrap gap-1.5">
        {players.map((x) => (
          <button key={x.account_id} onClick={() => setSel(x.account_id)} title={names?.get(x.account_id)?.personaname} className={cn("border p-0.5 transition-colors", x.account_id === p.account_id ? "border-primary" : "border-transparent opacity-60 hover:opacity-100")}>
            <HeroIcon heroId={x.hero_id} size={32} />
          </button>
        ))}
      </div>
      <p className="mb-4 font-display text-lg">{names?.get(p.account_id)?.personaname ?? heroes.get(p.hero_id)?.name} <span className="text-sm text-muted-foreground">· {heroes.get(p.hero_id)?.name}</span></p>
      {notes.length === 0 ? <p className="text-sm text-muted-foreground">Ровная игра — ничего заметно выше или ниже лобби.</p> : (
        <div className="grid gap-3 md:grid-cols-2">
          {notes.map((n) => (
            <div key={n.id} className={cn("border-l-2 bg-card/60 p-3", n.tone === "good" ? "border-win" : "border-loss")}>
              <p className={cn("mb-1 flex items-center gap-2 text-sm font-semibold", n.tone === "good" ? "text-win" : "text-loss")}>
                {n.tone === "good" ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}{n.title}
              </p>
              <p className="text-sm text-foreground/80">{n.text}</p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
