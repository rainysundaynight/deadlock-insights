import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { AlertTriangle, Check, ChevronDown, Loader2, ArrowUpRight, Hash, TrendingUp, Crosshair, Clock3 } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { api, heroesQuery, itemsQuery, ranksQuery, type Hero, type Item, type SteamProfile } from "@/lib/api";
import { splitBadge } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { motion, useReducedMotion } from "framer-motion";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

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
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="gazette-page-heading mb-8 grid gap-4 border-b border-primary/40 pb-6 md:grid-cols-[1fr_auto]">
      <div>{eyebrow && <p className="mb-3 flex items-center gap-3 font-mono text-[10px] font-medium uppercase text-primary"><span className="h-px w-8 bg-primary" />{eyebrow}<span className="text-primary/60">◆</span></p>}
      <h1 className="font-display text-4xl font-black leading-[1.05] md:text-5xl">{title}</h1></div>
      {children && <div className="mt-3 max-w-2xl italic text-muted-foreground">{children}</div>}
    </motion.div>
  );
}

export function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
      <h2 className="flex items-center gap-3 font-display text-xl font-bold"><span aria-hidden className="h-5 w-1 bg-primary" />{children}</h2>
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
    <span className={cn("game-rank inline-flex items-center gap-2", potential && "opacity-70")} title={title}>
      <span className="relative inline-block shrink-0" style={{ width: size, height: size }}>
        {src && <img src={src} alt={rank?.name} style={{ width: size, height: size }} className={cn("object-contain", potential && "grayscale-[40%]")} />}
        {roman && (
          <span
            className="game-rank-division absolute -bottom-1 left-1/2 -translate-x-1/2 border bg-background/90 px-1 font-mono font-extrabold leading-none text-primary"
            style={{ fontSize: Math.max(8, Math.round(size * 0.26)), paddingTop: 1, paddingBottom: 1 }}
          >
            {roman}
          </span>
        )}
        {potential && <span className="absolute -right-1 -top-1 font-display text-[10px] font-bold text-muted-foreground">~</span>}
      </span>
      {showName && (
        <span className="game-rank-name font-mono uppercase text-foreground">
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

export function Stat({ label, value, sub, tone, variant = "ledger" }: { label: string; value: ReactNode; sub?: ReactNode; tone?: "win" | "loss" | "brass"; variant?: "ledger" | "game" }) {
  const Icon = /винрейт|побед/i.test(label) ? TrendingUp : /kda|убийств/i.test(label) ? Crosshair : /время|последний|длительность/i.test(label) ? Clock3 : Hash;
  return (
    <div className={cn("stat-ledger group relative min-h-32 overflow-hidden border-b border-border bg-card/40 px-4 py-5", variant === "game" && "profile-game-stat", variant === "game" && (tone === "win" ? "profile-game-win" : tone === "loss" ? "profile-game-loss" : ""))}>
      <div className="flex items-start justify-between gap-2"><p className={cn("font-mono text-[10px] font-medium uppercase text-muted-foreground", variant === "game" && "game-status-plate text-primary")}>{label}</p><Icon className="h-4 w-4 shrink-0 text-primary/70 transition-transform group-hover:-translate-y-1" /></div>
      <p
        className={cn(
          "tabular mt-4 text-2xl font-semibold sm:text-3xl",
          tone === "win" && "text-win",
          tone === "loss" && "text-loss",
          tone === "brass" && "text-primary",
        )}
      >
        {value}
      </p>
      {sub && <p className="mt-2 text-xs text-muted-foreground">{sub}</p>}
      <ArrowUpRight aria-hidden className="absolute bottom-4 right-3 h-4 w-4 text-border" />
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
  const reduce = useReducedMotion();
  return (
    <Button
      type="button"
      variant="ghost"
      aria-pressed={!!active}
      onClick={onClick}
      className={cn(
        "gazette-chip relative min-h-10 overflow-hidden rounded-none border-0 border-b-2 px-3 py-2 text-xs transition-colors",
        active ? "border-primary text-primary" : "border-transparent bg-transparent text-muted-foreground hover:bg-primary/5 hover:text-foreground",
      )}
    >
      {active && <motion.span initial={reduce ? false : { opacity: 0, scaleX: 0.8 }} animate={{ opacity: 1, scaleX: 1 }} className="absolute inset-0 bg-primary/15" />}
      <span className="relative inline-flex items-center gap-1">{children}</span>
    </Button>
  );
}

export function HeroSelect({ value, onChange, allowAll = true }: { value: number | null; onChange: (v: number | null) => void; allowAll?: boolean }) {
  const { data } = useQuery(heroesQuery);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const hero = data?.find((h) => h.id === value);
  return (
    <Popover open={open} onOpenChange={setOpen}><PopoverTrigger asChild><Button variant="outline" className="h-10 justify-between bg-secondary">{hero && <HeroIcon heroId={hero.id} size={26} />}<span>{hero?.name ?? "Все герои"}</span><ChevronDown /></Button></PopoverTrigger><PopoverContent align="start" className="w-80 max-w-[90vw] border-primary/40 bg-popover p-3"><input aria-label="Поиск героя" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Имя в досье…" className={inputClass} />{allowAll && <Button variant="ghost" className="mt-2 w-full" onClick={() => { onChange(null); setOpen(false); }}>Все герои</Button>}<div className="mt-3 grid max-h-72 grid-cols-4 gap-1 overflow-y-auto">{data?.filter((h) => h.name.toLowerCase().includes(search.toLowerCase())).map((h) => <Button key={h.id} variant="ghost" className={cn("h-auto flex-col gap-1 p-2", h.id === value && "bg-primary/15 text-primary")} onClick={() => { onChange(h.id); setOpen(false); }}><HeroIcon heroId={h.id} size={40} /><span className="w-full truncate text-[10px]">{h.name}</span></Button>)}</div></PopoverContent></Popover>
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

/** Single-rank selector with rank icons; "all ranks" by default. */
export function RankFilter({ value, onChange }: { value: number | null; onChange: (v: number | null) => void }) {
  const { data: ranks } = useQuery(ranksQuery);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);
  const icon = (tier: number) => ranks?.find((r) => r.tier === tier)?.images.large_webp ?? ranks?.find((r) => r.tier === tier)?.images.large;
  const name = (tier: number) => ranks?.find((r) => r.tier === tier)?.name ?? `Tier ${tier}`;
  const cur = value == null ? null : ranks?.find((r) => r.tier === value);
  return (
    <span ref={ref} className="relative flex items-center gap-2 text-xs text-muted-foreground">
      Ранг
      <Button variant="outline" aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex h-10 items-center gap-2 rounded-md border border-input bg-secondary px-3 text-sm text-foreground hover:border-primary/50 focus:outline-none focus:ring-2 focus:ring-ring"
      >
        {cur ? <img src={cur.images.large_webp ?? cur.images.large} alt="" className="h-6 w-6 object-contain" /> : <span className="flex h-6 w-6 items-center justify-center text-muted-foreground">✦</span>}
        <span>{cur?.name ?? "Все ранги"}</span>
        <ChevronDown className={cn("h-3.5 w-3.5 text-muted-foreground transition-transform", open && "rotate-180")} />
      </Button>
      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 max-h-80 w-56 overflow-y-auto rounded-md border border-border bg-card p-1 shadow-xl">
          <Button variant="ghost"
            onClick={() => { onChange(null); setOpen(false); }}
            className={cn("flex w-full items-center gap-2.5 rounded px-2 py-1.5 text-sm hover:bg-secondary", value == null && "bg-primary/10 text-primary")}
          >
            <span className="flex h-7 w-7 items-center justify-center text-muted-foreground">✦</span>
            Все ранги
            {value == null && <Check className="ml-auto h-3.5 w-3.5" />}
          </Button>
          {Array.from({ length: 12 }, (_, t) => (
            <Button variant="ghost"
              key={t}
              onClick={() => { onChange(t); setOpen(false); }}
              className={cn("flex w-full items-center gap-2.5 rounded px-2 py-1.5 text-sm hover:bg-secondary", value === t && "bg-primary/10 text-primary")}
            >
              {icon(t) ? <img src={icon(t)} alt="" className="h-7 w-7 object-contain" /> : <span className="h-7 w-7" />}
              {name(t)}
              {value === t && <Check className="ml-auto h-3.5 w-3.5" />}
            </Button>
          ))}
        </div>
      )}
    </span>
  );
}

/** Player's real rank, or a semi-transparent potential rank estimated from their history. */
export function PlayerRank({ accountId, size = 26 }: { accountId: number; size?: number }) {
  const real = useQuery({
    queryKey: ["rank", String(accountId)],
    queryFn: () => api<{ badge: number | null }>(`/v1/players/${accountId}/rank`),
    staleTime: 600_000, retry: false,
  });
  const has = !!real.data?.badge && real.data.badge > 10;
  const pot = useQuery({
    queryKey: ["pot-rank", accountId],
    queryFn: () => import("@/lib/potentialRank").then((m) => m.fetchPotentialBadge(accountId)),
    enabled: real.isFetched && !has, staleTime: 86_400_000, retry: false,
  });
  const b = has ? real.data?.badge : pot.data;
  if (!b) return null;
  return <span title={has ? undefined : "Потенциальный ранг по последним матчам игрока"}><RankBadge badge={b} size={size} showName={false} potential={!has} /></span>;
}
