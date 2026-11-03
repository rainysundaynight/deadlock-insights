import { Link } from "@tanstack/react-router";
import { ExternalLink } from "lucide-react";

import { HeroIcon, useHeroMap, useItemMap } from "@/components/dl";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
const SLOT_NAME: Record<string, string> = { weapon: "Оружие", vitality: "Живучесть", spirit: "Дух" };

/** Player card for a moment of the replay: stats at `sec` and the build owned at that moment. */
export function PlayerMatchModal({ player, name, sec, hp, onClose }: { player: ModalPlayer | null; name?: string | undefined; sec: number; hp: number; onClose: () => void }) {
  const heroes = useHeroMap();
  const items = useItemMap();
  if (!player) return null;
  const hero = heroes.get(player.hero_id);
  const snap = [...(player.stats ?? [])].reverse().find((s) => s.time_stamp_s <= sec);
  const owned = (player.items ?? []).filter((i) => items.has(i.item_id) && i.game_time_s <= sec && !(i.sold_time_s > 0 && i.sold_time_s <= sec));
  const bySlot = new Map<string, typeof owned>();
  for (const i of owned) { const s = items.get(i.item_id)?.item_slot_type ?? "other"; bySlot.set(s, [...(bySlot.get(s) ?? []), i]); }
  const spent = owned.reduce((a, i) => a + (items.get(i.item_id)?.cost ?? 0), 0);
  const final = { k: player.kills ?? 0, d: player.deaths ?? 0, a: player.assists ?? 0 };
  const teamCls = player.team === 0 ? "from-amber-team/25" : "from-sapphire-team/25";

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl overflow-hidden p-0">
        <div className={cn("bg-gradient-to-br to-transparent p-5", teamCls)}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-4">
              <HeroIcon heroId={player.hero_id} size={64} className={player.team === 0 ? "border-amber-team" : "border-sapphire-team"} />
              <div className="min-w-0">
                <div className="truncate font-display text-xl">{name ?? hero?.name}</div>
                <div className="text-sm font-normal text-muted-foreground">{hero?.name} · {player.team === 0 ? "Амбер" : "Сапфир"} · уровень {snap?.level ?? player.level ?? "—"}</div>
              </div>
              {player.account_id ? (
                <Link to="/players/$accountId" params={{ accountId: String(player.account_id) }} className="ml-auto flex items-center gap-1 rounded-full border border-border px-3 py-1 text-xs font-normal hover:bg-secondary">
                  Профиль <ExternalLink className="h-3 w-3" />
                </Link>
              ) : null}
            </DialogTitle>
          </DialogHeader>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-background/60">
            <div className={cn("h-full rounded-full transition-all", hp > 0 ? "bg-win" : "bg-loss")} style={{ width: `${Math.max(0, Math.min(100, hp))}%` }} />
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{hp > 0 ? `Здоровье ${Math.round(hp)}%` : "Мёртв"} · на {fmtDuration(sec)}</p>
        </div>

        <div className="space-y-5 p-5 pt-2">
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
            {[
              ["K/D/A", snap ? `${snap.kills ?? 0}/${snap.deaths ?? 0}/${snap.assists ?? 0}` : "—"],
              ["Души", snap ? fmtK(snap.net_worth ?? 0) : "—"],
              ["Урон", snap ? fmtK(snap.player_damage ?? 0) : "—"],
              ["Лечение", snap ? fmtK(snap.player_healing ?? 0) : "—"],
              ["Крипы", snap ? String(snap.creep_kills ?? 0) : "—"],
              ["Денаи", snap ? String(snap.denies ?? 0) : "—"],
            ].map(([l, v]) => (
              <div key={l} className="rounded-lg bg-secondary/60 p-2 text-center">
                <div className="tabular font-display text-base">{v}</div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{l}</div>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">Статистика с точностью до последнего снимка ({snap ? fmtDuration(snap.time_stamp_s) : "—"}). Итог матча: {final.k}/{final.d}/{final.a}, {fmtK(player.net_worth ?? 0)} душ.</p>

          <div>
            <div className="mb-2 flex items-baseline justify-between">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Билд на {fmtDuration(sec)}</p>
              <span className="tabular text-xs text-primary">{fmtK(spent)} душ в предметах</span>
            </div>
            {owned.length === 0 ? <p className="text-sm text-muted-foreground">Пока ничего не куплено.</p> : (
              <div className="space-y-3">
                {["weapon", "vitality", "spirit", "other"].filter((s) => bySlot.has(s)).map((s) => (
                  <div key={s}>
                    <p className="mb-1 text-[11px] text-muted-foreground">{SLOT_NAME[s] ?? "Прочее"}</p>
                    <div className="flex flex-wrap gap-2">
                      {bySlot.get(s)!.map((i, idx) => {
                        const it = items.get(i.item_id)!;
                        return (
                          <div key={`${i.item_id}-${idx}`} title={`${it.name} · куплен ${fmtDuration(i.game_time_s)}`} className={cn("flex items-center gap-2 rounded-lg border p-1 pr-2", SLOT_STYLE[s] ?? "border-border")}>
                            <img src={it.shop_image_webp ?? it.image_webp ?? it.image} alt="" className="h-8 w-8" />
                            <span className="max-w-28 truncate text-xs">{it.name}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
