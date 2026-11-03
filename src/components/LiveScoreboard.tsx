import { Radio } from "lucide-react";
import { Area, AreaChart, ReferenceLine, ResponsiveContainer, YAxis } from "recharts";
import { useState } from "react";

import { HeroIcon, Loading, useHeroMap } from "@/components/dl";
import { fmtK } from "@/lib/format";
import { useLiveScoreboard } from "@/lib/liveStream";
import { cn } from "@/lib/utils";

const TEAMS = ["Амбер", "Сапфир"];

export function LiveScoreboard({ matchId }: { matchId: number }) {
  const [on, setOn] = useState(false);
  const { players, history, status, message } = useLiveScoreboard(matchId, on);
  const heroes = useHeroMap();

  if (!on)
    return (
      <div className="panel flex flex-col items-center gap-3 p-8 text-center">
        <Radio className="h-8 w-8 text-primary" />
        <p className="font-display text-lg font-semibold">Живая статистика игроков</p>
        <p className="max-w-md text-sm text-muted-foreground">Души, убийства, урон и лечение каждого игрока в реальном времени. Подключение может занять до минуты; сервис разрешает несколько таких подключений в час.</p>
        <button onClick={() => setOn(true)} className="mt-2 rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90">Подключиться к трансляции</button>
      </div>
    );
  if (status === "error" && !players.length)
    return <div className="panel p-6 text-sm"><p className="font-semibold">Не удалось подключиться к трансляции</p><p className="mt-1 text-muted-foreground">{message.includes("429") || message.includes("limit") ? "Достигнут лимит подключений — попробуйте позже." : message || "Попробуйте позже."}</p></div>;
  if (!players.length) return <Loading label={message ? `Подключаемся к трансляции… ${message.slice(0, 80)}` : "Подключаемся к трансляции…"} />;

  const team = (t: number) => players.filter((p) => p.team === t).sort((a, b) => b.nw - a.nw);
  const total = (t: number) => team(t).reduce((s, p) => s + p.nw, 0);
  const kills = (t: number) => team(t).reduce((s, p) => s + p.k, 0);
  const diff = total(0) - total(1);

  return (
    <div className="space-y-4">
      <div className="panel grid items-center gap-4 p-5 md:grid-cols-[1fr_auto_1fr]">
        <div className="text-amber-team"><p className="text-xs uppercase tracking-wider">{TEAMS[0]}</p><p className="tabular font-display text-3xl font-bold">{fmtK(total(0))}</p></div>
        <div className="text-center">
          <p className="tabular font-display text-4xl font-extrabold"><span className="text-amber-team">{kills(0)}</span> <span className="text-muted-foreground">:</span> <span className="text-sapphire-team">{kills(1)}</span></p>
          <p className="mt-1 inline-flex items-center gap-1.5 text-xs text-muted-foreground"><span className={cn("h-1.5 w-1.5 rounded-full", status === "ended" ? "bg-muted-foreground" : "animate-pulse bg-loss")} />{status === "ended" ? "Трансляция завершена" : "В эфире"}</p>
        </div>
        <div className="text-right text-sapphire-team"><p className="text-xs uppercase tracking-wider">{TEAMS[1]}</p><p className="tabular font-display text-3xl font-bold">{fmtK(total(1))}</p></div>
      </div>
      {history.length > 2 && (
        <div className="panel p-4">
          <p className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">Перевес по душам: <span className={diff >= 0 ? "text-amber-team" : "text-sapphire-team"}>{diff >= 0 ? "Амбер" : "Сапфир"} +{fmtK(Math.abs(diff))}</span></p>
          <div className="h-32">
            <ResponsiveContainer>
              <AreaChart data={history}>
                <YAxis hide domain={["auto", "auto"]} />
                <ReferenceLine y={0} stroke="var(--border)" />
                <Area dataKey="diff" stroke="var(--primary)" fill="var(--primary)" fillOpacity={0.15} isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
      {[0, 1].map((t) => (
        <section key={t} className="panel overflow-x-auto">
          <h3 className={cn("border-b border-border px-4 py-3 font-display text-sm font-semibold uppercase tracking-wider", t === 0 ? "text-amber-team" : "text-sapphire-team")}>{TEAMS[t]}</h3>
          <table className="w-full text-sm">
            <thead className="text-left text-[11px] uppercase tracking-wider text-muted-foreground">
              <tr className="border-b border-border"><th className="p-3">Игрок</th><th className="p-3">Ур.</th><th className="p-3">K/D/A</th><th className="p-3">Души</th><th className="p-3">Крипы</th><th className="p-3">Урон</th><th className="p-3">Лечение</th><th className="p-3">По постройкам</th></tr>
            </thead>
            <tbody>
              {team(t).map((p) => (
                <tr key={p.entity_index} className="border-b border-border/50 last:border-0">
                  <td className="p-3"><div className="flex items-center gap-3"><HeroIcon heroId={p.hero} size={34} /><div className="min-w-0"><p className="max-w-40 truncate font-medium">{p.name}</p><p className="text-xs text-muted-foreground">{heroes.get(p.hero)?.name}{p.streak >= 3 && <span className="ml-1 text-loss">· серия {p.streak}</span>}</p></div></div></td>
                  <td className="tabular p-3">{p.level}</td>
                  <td className="tabular p-3">{p.k}/<span className="text-loss">{p.d}</span>/{p.a}</td>
                  <td className="tabular p-3 text-primary">{fmtK(p.nw)}</td>
                  <td className="tabular p-3">{p.lh}<span className="text-muted-foreground">/{p.dn}</span></td>
                  <td className="tabular p-3">{fmtK(p.dmg)}</td>
                  <td className="tabular p-3">{fmtK(p.heal)}</td>
                  <td className="tabular p-3">{fmtK(p.obj)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ))}
    </div>
  );
}
