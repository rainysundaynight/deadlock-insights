import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";

import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { itemsQuery, type Item } from "@/lib/api";
import { fmtInt, SLOT_LABELS, stripHtml } from "@/lib/format";
import { cn } from "@/lib/utils";

const SECTION: Record<string, string> = { innate: "Базовые", passive: "Пассивно", active: "Активно" };
const slotText: Record<string, string> = { weapon: "text-amber-team", vitality: "text-win", spirit: "text-chart-5" };

function fmtProp(item: Item, key: string) {
  const p = item.properties?.[key];
  if (!p || p.value == null || p.value === "0" || p.value === 0 || !p.label) return null;
  const n = Number(p.value);
  const sign = (p.prefix ?? "").includes("sign") && n > 0 ? "+" : "";
  return { value: `${sign}${p.value}${(p.postfix ?? "").replace("%", "%")}`, label: p.label };
}

export function ItemHintBody({ item }: { item: Item }) {
  const all = useQuery(itemsQuery).data ?? [];
  const parents = all.filter((i) => i.component_items?.includes(item.class_name));
  const parts = all.filter((i) => item.component_items?.includes(i.class_name));
  return (
    <div className="space-y-3 text-sm">
      <div className="border-b border-primary/30 pb-2">
        <p className="font-display text-lg leading-tight">{item.name}</p>
        <p className="mt-0.5 flex flex-wrap gap-x-3 font-mono text-[11px] uppercase tracking-wider">
          <span className="text-primary">{fmtInt(item.cost)} душ</span>
          <span className={slotText[item.item_slot_type ?? ""]}>{SLOT_LABELS[item.item_slot_type ?? ""]} · Тир {item.item_tier}</span>
        </p>
      </div>
      {(item.tooltip_sections ?? []).map((s, i) => (
        <div key={i} className="space-y-1.5">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{SECTION[s.section_type] ?? s.section_type}</p>
          {s.section_attributes.map((a, j) => {
            const imp = (a.important_properties ?? []).map((k) => fmtProp(item, k)).filter(Boolean);
            const props = [...(a.elevated_properties ?? []), ...(a.properties ?? [])].map((k) => fmtProp(item, k)).filter(Boolean);
            return (
              <div key={j} className="space-y-1.5">
                {a.loc_string && <p className="leading-snug text-foreground/85">{stripHtml(a.loc_string).replace(/\s+/g, " ").trim()}</p>}
                {imp.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {imp.map((p, k) => <span key={k} className="border border-primary/40 bg-primary/10 px-2 py-1"><b className="tabular text-primary">{p!.value}</b> <span className="text-xs">{p!.label}</span></span>)}
                  </div>
                )}
                {props.map((p, k) => <p key={k} className="flex justify-between gap-3 text-xs"><span className="text-muted-foreground">{p!.label}</span><b className="tabular">{p!.value}</b></p>)}
              </div>
            );
          })}
        </div>
      ))}
      {(parts.length > 0 || parents.length > 0) && (
        <div className="space-y-1 border-t border-border pt-2 text-xs">
          {parts.length > 0 && <p><span className="text-muted-foreground">Собирается из: </span>{parts.map((p) => p.name).join(", ")}</p>}
          {parents.length > 0 && <p><span className="text-muted-foreground">Входит в: </span>{parents.map((p) => p.name).join(", ")}</p>}
        </div>
      )}
    </div>
  );
}

export function ItemHint({ item, children, className }: { item: Item; children: ReactNode; className?: string }) {
  return (
    <HoverCard openDelay={200} closeDelay={60}>
      <HoverCardTrigger asChild><span className={cn("inline-block", className)}>{children}</span></HoverCardTrigger>
      <HoverCardContent side="right" align="start" collisionPadding={12} className="gazette-frame w-80 max-w-[calc(100vw-24px)] rounded-none border-primary/40 bg-card p-4">
        <ItemHintBody item={item} />
      </HoverCardContent>
    </HoverCard>
  );
}
