import { Share2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { useHeroMap } from "@/components/dl";
import type { Hero, MatchHistoryEntry } from "@/lib/api";
import { fmtK } from "@/lib/format";

const load = (src: string) => new Promise<HTMLImageElement | null>((res) => {
  const i = new Image(); i.crossOrigin = "anonymous"; i.onload = () => res(i); i.onerror = () => res(null); i.src = src;
});

/** «Газетная визитка» — 1200×630 PNG of the player's dossier for sharing. */
export function PlayerShareCard({ accountId, name, history, hero }: { accountId: number; name: string; history: MatchHistoryEntry[]; hero: Hero | undefined }) {
  const heroes = useHeroMap();
  const [busy, setBusy] = useState(false);

  const make = async () => {
    if (!history.length) { toast.info("Нет матчей для визитки"); return; }
    setBusy(true);
    try {
      const c = document.createElement("canvas"); c.width = 1200; c.height = 630;
      const g = c.getContext("2d")!;
      const css = getComputedStyle(document.documentElement);
      const v = (n: string) => css.getPropertyValue(n).trim() || "#888";
      const serif = "Georgia, 'Times New Roman', serif";
      g.fillStyle = v("--background"); g.fillRect(0, 0, 1200, 630);
      // ruled frame
      g.strokeStyle = v("--primary"); g.lineWidth = 2; g.strokeRect(24, 24, 1152, 582); g.lineWidth = 1; g.strokeRect(34, 34, 1132, 562);

      const art = hero ? await load(hero.images.hero_card_gloat_webp ?? hero.images.icon_hero_card_webp ?? hero.images.icon_hero_card ?? "") : null;
      if (art) {
        const h = 560, w = (art.width / art.height) * h;
        const ax = 1165 - w + 40, ay = 70;
        g.save(); g.beginPath(); g.rect(35, 35, 1130, 560); g.clip();
        // цветная подложка под героем, как в профиле
        const glow = g.createRadialGradient(ax + w / 2, ay + h * 0.42, 40, ax + w / 2, ay + h * 0.42, w * 0.85);
        const hc = hero?.colors?.style_hex ?? v("--primary");
        glow.addColorStop(0, hc + "66"); glow.addColorStop(0.55, hc + "22"); glow.addColorStop(1, "transparent");
        g.fillStyle = glow; g.fillRect(ax - 160, 35, w + 200, 560);
        g.globalAlpha = 0.95; g.drawImage(art, ax, ay, w, h);
        g.globalAlpha = 1;
        // мягкие переходы по краям, чтобы не было видно среза карточки
        const fadeL = g.createLinearGradient(ax, 0, ax + 220, 0);
        fadeL.addColorStop(0, v("--background")); fadeL.addColorStop(1, "transparent");
        g.fillStyle = fadeL; g.fillRect(ax, 35, 230, 560);
        const fadeB = g.createLinearGradient(0, 430, 0, 595);
        fadeB.addColorStop(0, "transparent"); fadeB.addColorStop(1, v("--background"));
        g.fillStyle = fadeB; g.fillRect(ax - 160, 430, w + 200, 165);
        const fadeR = g.createLinearGradient(1135, 0, 1165, 0);
        fadeR.addColorStop(0, "transparent"); fadeR.addColorStop(1, v("--background"));
        g.fillStyle = fadeR; g.fillRect(1135, 35, 30, 560);
        g.restore();
      }

      g.fillStyle = v("--primary"); g.font = `600 20px ${serif}`;
      g.fillText("THE DEADLOCKED GAZETTE · ДОСЬЕ № " + accountId, 70, 92);
      g.fillRect(70, 108, 520, 2);
      g.fillStyle = v("--foreground"); g.font = `bold 68px ${serif}`;
      let nm = name; while (g.measureText(nm).width > 640 && nm.length > 3) nm = nm.slice(0, -2);
      g.fillText(nm === name ? nm : nm + "…", 70, 190);
      if (hero) { g.fillStyle = v("--muted-foreground"); g.font = `italic 28px ${serif}`; g.fillText(`Визитная карточка: ${hero.name}`, 70, 236); }

      const n = history.length;
      const wins = history.filter((m) => m.match_result === m.player_team).length;
      const k = history.reduce((s, m) => s + m.player_kills, 0), d = history.reduce((s, m) => s + m.player_deaths, 0), a = history.reduce((s, m) => s + m.player_assists, 0);
      const souls = history.reduce((s, m) => s + m.net_worth, 0) / n;
      const stats: [string, string][] = [["МАТЧЕЙ", String(n)], ["ПОБЕД", `${((wins / n) * 100).toFixed(1)}%`], ["KDA", ((k + a) / Math.max(1, d)).toFixed(2)], ["ДУШ / МАТЧ", fmtK(souls)]];
      stats.forEach(([l, val], i) => {
        const x = 70 + (i % 2) * 260, y = 300 + Math.floor(i / 2) * 120;
        g.fillStyle = v("--primary"); g.fillRect(x, y, 4, 90);
        g.fillStyle = v("--muted-foreground"); g.font = `600 16px ${serif}`; g.fillText(l, x + 18, y + 26);
        g.fillStyle = v("--foreground"); g.font = `bold 48px ${serif}`; g.fillText(val, x + 18, y + 78);
      });

      const counts = new Map<number, number>();
      history.forEach((m) => counts.set(m.hero_id, (counts.get(m.hero_id) ?? 0) + 1));
      const top = [...counts].sort((x, y) => y[1] - x[1]).slice(0, 3);
      g.fillStyle = v("--muted-foreground"); g.font = `600 16px ${serif}`; g.fillText("ЛЮБИМЫЕ ГЕРОИ", 620, 300);
      for (const [i, [hid, cnt]] of top.entries()) {
        const h = heroes.get(hid); if (!h) continue;
        const ic = await load(h.images.icon_image_small_webp ?? h.images.icon_image_small ?? "");
        const y = 320 + i * 70;
        if (ic) g.drawImage(ic, 620, y, 56, 56);
        g.fillStyle = v("--foreground"); g.font = `bold 24px ${serif}`; g.fillText(h.name, 690, y + 26);
        g.fillStyle = v("--muted-foreground"); g.font = `18px ${serif}`; g.fillText(`${cnt} матчей`, 690, y + 50);
      }
      g.fillStyle = v("--muted-foreground"); g.font = `16px ${serif}`; g.fillText(`${location.host}/players/${accountId}`, 70, 575);

      const blob = await new Promise<Blob | null>((r) => c.toBlob(r, "image/png"));
      if (!blob) throw new Error("no blob");
      const file = new File([blob], `dossier-${accountId}.png`, { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: `${name} — досье Deadlock` }).catch(() => {});
      } else {
        const url = URL.createObjectURL(blob);
        const el = document.createElement("a"); el.download = file.name; el.href = url; el.click();
        setTimeout(() => URL.revokeObjectURL(url), 2000);
        toast.success("Визитка сохранена");
      }
    } catch {
      toast.error("Не удалось создать визитку");
    } finally { setBusy(false); }
  };

  return (
    <button onClick={make} disabled={busy} className="inline-flex items-center gap-1.5 hover:text-primary disabled:opacity-50">
      <Share2 className="h-3.5 w-3.5" />{busy ? "Готовим…" : "Визитка"}
    </button>
  );
}
