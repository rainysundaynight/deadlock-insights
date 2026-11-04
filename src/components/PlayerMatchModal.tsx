import { Link } from "@tanstack/react-router";
import { ExternalLink, X } from "lucide-react";
import { useState } from "react";

import { HeroIcon, useHeroMap, useItemMap } from "@/components/dl";
import { fmtDuration, fmtK } from "@/lib/format";
import { cn } from "@/lib/utils";

export interface ModalPlayer {
  account_id?: number; player_slot: number; team: number; hero_id: number;
  kills?: number; deaths?: number; assists?: number; net_worth?: number; level?: number; last_hits?: number; denies?: number;
  items?: { game_time_s: number; item_id: number; sold_time_s: number }[];
  stats?: ({ time_stamp_s: number } & Partial<Record<"net_worth" | "kills" | "deaths" | "assists" | "level" | "player_damage" | "player_healing" | "creep_kills" | "denies", number>>)[];
}

const SLOT_STYLE: Record<string, string> = {
  weapon: "border-amber-team/60 bg-amber-team/10",
  vitality: "border-win/60 bg-win/10",
  spirit: "border-chart-5/60 bg-chart-5/10",
};

/** Compact floating player card over the replay map — doesn't block playback. */
export function PlayerMatchModal({ player, name, sec, hp, onClose }: { player: ModalPlayer | null; name?: string | undefined; sec: number; hp: number; onClose: () => void }) {
  const heroes = useHeroMap();
  const items = useItemMap();
  const [tab, setTab] = useState<"build" | "history">("build");
  if (!player) return null;
  const hero = heroes.get(player.hero_id);
  const snap = [...(player.stats ?? [])].reverse().find((s) => s.time_stamp_s <= sec);
  const all = (player.items ?? []).filter((i) => items.has(i.item_id)).sort((a, b) => a.game_time_s - b.game_time_s);
  const owned = all.filter((i) => i.game_time_s <= sec && !(i.sold_time_s > 0 && i.sold_time_s <= sec));
  const spent = owned.reduce((a, i) => a + (items.get(i.item_id)?.cost ?? 0), 0);
  const border = player.team === 0 ? "border-amber-team/60" : "border-sapphire-team/60";

  return (
    <div className={cn("absolute right-2 top-[84px] z-10 w-72 rounded-xl border bg-card/95 p-3 shadow-xl backdrop-blur", border)}>
      <div className="flex items-center gap-2">
        <HeroIcon heroId={player.hero_id} size={36} className={player.team === 0 ? "border-amber-team" : "border-sapphire-team"} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold">{name ?? hero?.name}</div>
          <div className="text-[11px] text-muted-foreground">{hero?.name} · ур. {snap?.level ?? "—"}</div>
        </div>
        {player.account_id ? (
          <Link to="/players/$accountId" params={{ accountId: String(player.account_id) }} title="Профиль" className="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"><ExternalLink className="h-3.5 w-3.5" /></Link>
        ) : null}
        <button onClick={onClose} className="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground" aria-label="Закрыть"><X className="h-3.5 w-3.5" /></button>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
        <div className={cn("h-full transition-all", hp > 0 ? "bg-win" : "bg-loss")} style={{ width: `${Math.max(0, Math.min(100, hp))}%` }} />
      </div>
      <div className="mt-2 grid grid-cols-4 gap-1 text-center">
        {[
          ["KDA", snap ? `${snap.kills ?? 0}/${snap.deaths ?? 0}/${snap.assists ?? 0}` : "—"],
          ["Души", snap ? fmtK(snap.net_worth ?? 0) : "—"],
          ["Урон", snap ? fmtK(snap.player_damage ?? 0) : "—"],
          ["Крипы", snap ? String(snap.creep_kills ?? 0) : "—"],
        ].map(([l, v]) => (
          <div key={l} className="rounded-md bg-secondary/60 py-1">
            <div className="tabular text-xs font-semibold">{v}</div>
            <div className="text-[9px] uppercase text-muted-foreground">{l}</div>
          </div>
        ))}
      </div>
      <div className="mt-2 flex gap-1 text-[11px]">
        {([["build", `Билд · ${fmtK(spent)}`], ["history", "История покупок"]] as const).map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} className={cn("rounded-full border px-2 py-0.5", tab === k ? "border-primary/60 bg-primary/15 text-primary" : "border-border text-muted-foreground")}>{l}</button>
        ))}
      </div>
      {tab === "build" ? (
        owned.length === 0 ? <p className="mt-2 text-xs text-muted-foreground">Пока ничего не куплено.</p> : (
          <div className="mt-2 grid grid-cols-6 gap-1">
            {owned.map((i, idx) => { const it = items.get(i.item_id)!; return (
              <img key={`${i.item_id}-${idx}`} src={it.shop_image_webp ?? it.image_webp ?? it.image} alt={it.name} title={`${it.name} · ${fmtDuration(i.game_time_s)}`} className={cn("h-10 w-10 rounded-md border p-0.5", SLOT_STYLE[it.item_slot_type ?? ""] ?? "border-border")} />
            ); })}
          </div>
        )
      ) : (
        <div className="mt-2 max-h-48 space-y-0.5 overflow-y-auto pr-1">
          {all.map((i, idx) => { const it = items.get(i.item_id)!; return (
            <div key={`h-${i.item_id}-${idx}`} className={cn("flex items-center gap-2 text-xs", i.game_time_s > sec && "opacity-35")}>
              <span className="tabular w-9 text-muted-foreground">{fmtDuration(i.game_time_s)}</span>
              <img src={it.shop_image_webp ?? it.image_webp ?? it.image} alt="" className={cn("h-6 w-6 rounded border", SLOT_STYLE[it.item_slot_type ?? ""] ?? "border-border")} />
              <span className="min-w-0 flex-1 truncate">{it.name}</span>
              {i.sold_time_s > 0 && <span className="text-[10px] text-loss">−{fmtDuration(i.sold_time_s)}</span>}
            </div>
          ); })}
        </div>
      )}
    </div>
  );
}
