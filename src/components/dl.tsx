import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { AlertTriangle, Loader2 } from "lucide-react";
import { useMemo, type ReactNode } from "react";

import { api, heroesQuery, itemsQuery, ranksQuery, type Hero, type Item, type SteamProfile } from "@/lib/api";
import { splitBadge } from "@/lib/format";
import { cn } from "@/lib/utils";

export function useHeroMap() {
  const { data } = useQuery(heroesQuery);
  return useMemo(() => new Map<number, Hero>((data ?? []).map((h) => [h.id, h])), [data]);
}

export function useItemMap() {
  const { data } = useQuery(itemsQuery);
  return useMemo(() => new Map<number, Item>((data ?? []).map((i) => [i.id, i])), [data]);
}

export function PageHeader({ eyebrow, title, children }: { eyebrow?: string; title: ReactNode; children?: ReactNode }) {
  return (
    <div className="mb-8">
      {eyebrow && <p className="mb-3 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-primary">{eyebrow}</p>}
      <h1 className="font-display text-3xl font-bold md:text-4xl">{title}</h1>
      {children && <div className="mt-3 max-w-2xl text-muted-foreground">{children}</div>}
    </div>
  );
}

export function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-4 flex items-end justify-between gap-4">
      <h2 className="font-display text-lg font-semibold">{children}</h2>
      {right}
    </div>
  );
}

export function HeroIcon({ heroId, size = 40, className, withName }: { heroId: number; size?: number; className?: string; withName?: boolean }) {
  const heroes = useHeroMap();
  const hero = heroes.get(heroId);
  const src = hero?.images.icon_image_small_webp ?? hero?.images.icon_image_small;
  const img = (
    <span
      className={cn("inline-flex shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-muted", className)}
      style={{ width: size, height: size }}
      title={hero?.name}
    >
      {src ? <img src={src} alt={hero?.name ?? ""} className="h-full w-full object-cover" loading="lazy" /> : null}
    </span>
  );
  if (!withName) return img;
  return (
    <span className="inline-flex items-center gap-2">
      {img}
      <span className="font-medium">{hero?.name ?? `#${heroId}`}</span>
    </span>
  );
}

export function HeroLink({ heroId, size = 36 }: { heroId: number; size?: number }) {
  return (
    <Link to="/heroes/$heroId" params={{ heroId: String(heroId) }} className="hover:text-primary">
      <HeroIcon heroId={heroId} size={size} withName />
    </Link>
  );
}

const ROMAN = ["", "I", "II", "III", "IV", "V", "VI"];
export function RankBadge({ badge, size = 40, showName = true, potential = false }: { badge: number | null | undefined; size?: number; showName?: boolean; potential?: boolean }) {
  const { data: ranks } = useQuery(ranksQuery);
  const b = splitBadge(badge);
  if (!b) return <span className="text-sm text-muted-foreground">Без ранга</span>;
  const rank = ranks?.find((r) => r.tier === b.tier);
  const src = rank?.images[`small_subrank${b.subrank}_webp`] ?? rank?.images[`small_subrank${b.subrank}`] ?? rank?.images.large;
  const roman = ROMAN[b.subrank] ?? "";
  const title = `${potential ? "Потенциальный ранг: ~" : ""}${rank?.name ?? `Tier ${b.tier}`} ${roman}`;
  return (
    <span className={cn("inline-flex items-center gap-2", potential && "opacity-50")} title={title}>
      <span className="relative inline-block shrink-0" style={{ width: size, height: size }}>
        {src && <img src={src} alt={rank?.name} style={{ width: size, height: size }} className={cn("object-contain", potential && "grayscale-[40%]")} />}
        {roman && (
          <span
            className="absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-sm border bg-background/90 px-1 font-display font-extrabold leading-none tracking-wider shadow"
            style={{ fontSize: Math.max(8, Math.round(size * 0.26)), color: rank?.color, borderColor: rank?.color ? `${rank.color}80` : undefined, paddingTop: 1, paddingBottom: 1 }}
          >
            {roman}
          </span>
        )}
        {potential && <span className="absolute -right-1 -top-1 font-display text-[10px] font-bold text-muted-foreground">~</span>}
      </span>
      {showName && (
        <span className="font-display uppercase tracking-wide" style={{ color: rank?.color }}>
          {potential && "~"}{rank?.name ?? `Tier ${b.tier}`} {roman}
        </span>
      )}
    </span>
  );
}

/** Estimate a badge for an unranked player from ranked players in the same lobby. */
export function lobbyBadge(badges: (number | null | undefined)[]): number | null {
  const v = badges.filter((x): x is number => !!x && x > 10);
  if (!v.length) return null;
  const avgTier = v.reduce((s, x) => s + Math.floor(x / 10) * 6 + (x % 10), 0) / v.length;
  const r = Math.round(avgTier);
  const tier = Math.floor((r - 1) / 6), sub = ((r - 1) % 6) + 1;
  return tier * 10 + sub;
}

export function Stat({ label, value, sub, tone }: { label: string; value: ReactNode; sub?: ReactNode; tone?: "win" | "loss" | "brass" }) {
  return (
    <div className="panel p-4">
      <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
      <p
        className={cn(
          "tabular mt-1 text-2xl font-semibold",
          tone === "win" && "text-win",
          tone === "loss" && "text-loss",
          tone === "brass" && "text-primary",
        )}
      >
        {value}
      </p>
      {sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

export function WinrateBar({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-muted">
        <div className={cn("h-full", value >= 0.5 ? "bg-win" : "bg-loss")} style={{ width: `${Math.min(100, value * 100)}%` }} />
      </div>
      <span className={cn("tabular text-sm", value >= 0.5 ? "text-win" : "text-loss")}>{(value * 100).toFixed(1)}%</span>
    </div>
  );
}

export function Loading({ label = "Загрузка данных…" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-16 text-muted-foreground">
      <Loader2 className="h-5 w-5 animate-spin text-primary" />
      {label}
    </div>
  );
}

export function ErrorBox({ error }: { error: unknown }) {
  return (
    <div className="panel flex items-start gap-3 border-destructive/50 p-4 text-sm">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
      <div>
        <p className="font-semibold">Не удалось загрузить данные</p>
        <p className="text-muted-foreground">{error instanceof Error ? error.message : String(error)}</p>
      </div>
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="panel p-8 text-center text-muted-foreground">{children}</div>;
}

export function Chip({ active, onClick, children }: { active?: boolean; onClick?: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1 text-sm transition-colors",
        active ? "border-primary/60 bg-primary/15 text-primary" : "border-border bg-secondary text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

export function HeroSelect({ value, onChange, allowAll = true }: { value: number | null; onChange: (v: number | null) => void; allowAll?: boolean }) {
  const { data } = useQuery(heroesQuery);
  return (
    <select
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
      className="h-10 rounded-md border border-input bg-secondary px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
    >
      {allowAll && <option value="">Все герои</option>}
      {data?.map((h) => (
        <option key={h.id} value={h.id}>
          {h.name}
        </option>
      ))}
    </select>
  );
}

export const selectClass =
  "h-10 rounded-md border border-input bg-secondary px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring";
export const inputClass =
  "h-10 w-full rounded-md border border-input bg-secondary px-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring";

export function useSteamProfiles(ids: number[]) {
  const key = [...ids].sort().join(",");
  return useQuery({
    queryKey: ["steam", key],
    queryFn: async () => {
      const out = new Map<number, SteamProfile>();
      for (let i = 0; i < ids.length; i += 100) {
        const chunk = ids.slice(i, i + 100);
        const res = await api<SteamProfile[]>("/v1/players/steam", { account_ids: chunk.join(",") }).catch(() => []);
        res.forEach((p) => out.set(p.account_id, p));
      }
      return out;
    },
    enabled: ids.length > 0,
    staleTime: 1000 * 60 * 30,
  });
}


/** API params for one rank tier (0 = Obscurus … 11 = Eternus); null = all ranks. */
export const rankParams = (tier: number | null) =>
  tier == null ? {} : { min_average_badge: tier * 10 + 1, max_average_badge: tier * 10 + 6 };

/** Single-rank selector; "all ranks" by default. */
export function RankFilter({ value, onChange }: { value: number | null; onChange: (v: number | null) => void }) {
  const { data: ranks } = useQuery(ranksQuery);
  return (
    <span className="flex items-center gap-2 text-xs text-muted-foreground">
      Ранг
      <select className={selectClass} value={value ?? "all"} onChange={(e) => onChange(e.target.value === "all" ? null : +e.target.value)}>
        <option value="all">Все ранги</option>
        {Array.from({ length: 12 }, (_, t) => (
          <option key={t} value={t}>{ranks?.find((r) => r.tier === t)?.name ?? `Tier ${t}`}</option>
        ))}
      </select>
    </span>
  );
}
