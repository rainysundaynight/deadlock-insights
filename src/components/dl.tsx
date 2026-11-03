import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { AlertTriangle, Loader2 } from "lucide-react";
import { useMemo, type ReactNode } from "react";

import { heroesQuery, itemsQuery, ranksQuery, type Hero, type Item } from "@/lib/api";
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
      {eyebrow && <p className="mb-2 text-xs font-semibold uppercase tracking-[0.3em] text-primary">{eyebrow}</p>}
      <h1 className="font-display text-4xl font-semibold uppercase md:text-5xl">{title}</h1>
      {children && <div className="mt-3 max-w-2xl text-muted-foreground">{children}</div>}
      <div className="deco-line mt-6" />
    </div>
  );
}

export function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-4 flex items-end justify-between gap-4">
      <h2 className="font-display text-xl font-medium uppercase tracking-wider text-primary">{children}</h2>
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

export function RankBadge({ badge, size = 40, showName = true }: { badge: number | null | undefined; size?: number; showName?: boolean }) {
  const { data: ranks } = useQuery(ranksQuery);
  const b = splitBadge(badge);
  if (!b) return <span className="text-sm text-muted-foreground">Без ранга</span>;
  const rank = ranks?.find((r) => r.tier === b.tier);
  const src = rank?.images[`small_subrank${b.subrank}_webp`] ?? rank?.images[`small_subrank${b.subrank}`] ?? rank?.images.large;
  return (
    <span className="inline-flex items-center gap-2">
      {src && <img src={src} alt={rank?.name} style={{ width: size, height: size }} className="object-contain" />}
      {showName && (
        <span className="font-display uppercase tracking-wide" style={{ color: rank?.color }}>
          {rank?.name ?? `Tier ${b.tier}`} {b.subrank}
        </span>
      )}
    </span>
  );
}

export function Stat({ label, value, sub, tone }: { label: string; value: ReactNode; sub?: ReactNode; tone?: "win" | "loss" | "brass" }) {
  return (
    <div className="panel p-4">
      <p className="text-xs uppercase tracking-widest text-muted-foreground">{label}</p>
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
        active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-secondary hover:border-primary/60",
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
