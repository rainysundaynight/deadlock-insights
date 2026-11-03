import { Copy, Download, Gamepad2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { useHeroMap } from "@/components/dl";
import { fmtDuration, fmtK, kda } from "@/lib/format";

interface P { account_id: number; team: number; hero_id: number; kills: number; deaths: number; assists: number; net_worth: number; stats: { player_damage?: number }[] }

/** Picks MVP by a simple score: KDA-weighted plus souls and damage. */
export function mvpOf<T extends P>(players: T[], winner: number): T | undefined {
  const score = (p: P) => (p.kills * 2 + p.assists) / Math.max(1, p.deaths) + p.net_worth / 10000 + (p.stats.at(-1)?.player_damage ?? 0) / 20000 + (p.team === winner ? 1 : 0);
  return [...players].sort((a, b) => score(b) - score(a))[0];
}

export function MatchActions({ matchId, players, winner, duration, names }: { matchId: number; players: P[]; winner: number; duration: number; names?: Map<number, { personaname: string }> | undefined }) {
  const heroes = useHeroMap();
  const [sel, setSel] = useState<number | "mvp">("mvp");
  const p = sel === "mvp" ? mvpOf(players, winner) : players.find((x) => x.account_id === sel);

  const draw = () => {
    if (!p) return;
    const c = document.createElement("canvas"); c.width = 1200; c.height = 630;
    const g = c.getContext("2d")!;
    const css = getComputedStyle(document.documentElement);
    const v = (n: string) => css.getPropertyValue(n).trim() || "#888";
    g.fillStyle = v("--background"); g.fillRect(0, 0, 1200, 630);
    g.fillStyle = v("--primary"); g.fillRect(0, 0, 1200, 8);
    const won = p.team === winner;
    g.fillStyle = v("--muted-foreground"); g.font = "28px sans-serif"; g.fillText(`DEADLOCK · МАТЧ #${matchId} · ${fmtDuration(duration)}`, 60, 80);
    g.fillStyle = won ? v("--win") : v("--loss"); g.font = "bold 72px sans-serif"; g.fillText(won ? "ПОБЕДА" : "ПОРАЖЕНИЕ", 60, 180);
    g.fillStyle = v("--foreground"); g.font = "bold 56px sans-serif"; g.fillText(names?.get(p.account_id)?.personaname ?? "Игрок", 60, 270);
    g.fillStyle = v("--primary"); g.font = "36px sans-serif"; g.fillText(`${heroes.get(p.hero_id)?.name ?? ""}${sel === "mvp" ? "  ·  MVP" : ""}`, 60, 320);
    const items: [string, string][] = [["K/D/A", `${p.kills}/${p.deaths}/${p.assists}`], ["KDA", kda(p.kills, p.deaths, p.assists)], ["Души", fmtK(p.net_worth)], ["Урон", fmtK(p.stats.at(-1)?.player_damage)]];
    items.forEach(([l, val], i) => {
      const x = 60 + i * 280;
      g.fillStyle = v("--card"); g.fillRect(x, 390, 250, 160);
      g.fillStyle = v("--muted-foreground"); g.font = "24px sans-serif"; g.fillText(l, x + 24, 435);
      g.fillStyle = v("--foreground"); g.font = "bold 52px sans-serif"; g.fillText(val, x + 24, 510);
    });
    g.fillStyle = v("--muted-foreground"); g.font = "22px sans-serif"; g.fillText(location.host, 60, 600);
    const a = document.createElement("a"); a.download = `deadlock-${matchId}.png`; a.href = c.toDataURL("image/png"); a.click();
  };

  const copy = async (text: string, msg: string) => { await navigator.clipboard.writeText(text).catch(() => {}); toast.success(msg); };

  return (
    <div className="panel flex flex-wrap items-center gap-2 p-3">
      <select value={sel} onChange={(e) => setSel(e.target.value === "mvp" ? "mvp" : +e.target.value)} className="rounded-full border border-border bg-secondary px-3 py-2 text-sm">
        <option value="mvp">MVP матча</option>
        {players.map((x) => <option key={x.account_id} value={x.account_id}>{names?.get(x.account_id)?.personaname ?? heroes.get(x.hero_id)?.name}</option>)}
      </select>
      <button onClick={draw} className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"><Download className="h-4 w-4" />Карточка PNG</button>
      <button onClick={() => copy(location.href, "Ссылка скопирована")} className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm"><Copy className="h-4 w-4" />Ссылка</button>
      <SpectateButton matchId={matchId} />
    </div>
  );
}

export function SpectateButton({ matchId }: { matchId: number }) {
  return (
    <button
      onClick={async () => {
        await navigator.clipboard.writeText(String(matchId)).catch(() => {});
        toast.success("ID матча скопирован", { description: "Запускаем Deadlock — откройте «Смотреть» и вставьте ID матча." });
        window.location.href = "steam://rungameid/1422450";
      }}
      className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm hover:border-primary/60"
    >
      <Gamepad2 className="h-4 w-4" />Смотреть в игре
    </button>
  );
}
