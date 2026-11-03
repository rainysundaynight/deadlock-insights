import { Link } from "@tanstack/react-router";
import {
  Activity, BarChart3, Crown, GitCompare, Hammer, Home, LayoutGrid, Menu, Package, ScrollText, Swords, Trophy, Users, X,
} from "lucide-react";
import { useState, type ReactNode } from "react";

import { PlayerSearch } from "@/components/PlayerSearch";
import { cn } from "@/lib/utils";

const GROUPS = [
  {
    title: "Главное",
    items: [
      { to: "/", label: "Главная", icon: Home },
      { to: "/live", label: "Live матчи", icon: Activity, live: true },
      { to: "/compare", label: "Сравнение", icon: GitCompare },
    ],
  },
  {
    title: "Мета",
    items: [
      { to: "/tierlist", label: "Тир-лист", icon: Crown },
      { to: "/heroes", label: "Герои", icon: Swords },
      { to: "/meta", label: "Контрпики", icon: LayoutGrid },
      { to: "/items", label: "Предметы", icon: Package },
      { to: "/builds", label: "Билды", icon: Hammer },
    ],
  },
  {
    title: "Сообщество",
    items: [
      { to: "/leaderboard", label: "Лидерборд", icon: Trophy },
      { to: "/ranks", label: "Ранги", icon: BarChart3 },
      { to: "/patches", label: "Патчи", icon: ScrollText },
    ],
  },
] as const;

function Nav({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav className="space-y-6">
      {GROUPS.map((g) => (
        <div key={g.title}>
          <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.25em] text-muted-foreground/70">{g.title}</p>
          <div className="space-y-0.5">
            {g.items.map((n) => (
              <Link
                key={n.to}
                to={n.to}
                onClick={onNavigate}
                activeOptions={{ exact: n.to === "/" }}
                className="group flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground"
                activeProps={{ className: "!bg-primary/10 !text-primary" }}
              >
                <n.icon className="h-4 w-4" />
                <span className="flex-1">{n.label}</span>
                {"live" in n && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-loss" />}
              </Link>
            ))}
          </div>
        </div>
      ))}
    </nav>
  );
}

function Logo() {
  return (
    <Link to="/" className="flex items-center gap-2.5">
      <span className="grid h-9 w-9 place-items-center rounded-lg bg-primary font-display text-base font-bold text-primary-foreground shadow-[var(--shadow-brass)]">D</span>
      <span className="font-display text-sm font-bold uppercase leading-tight tracking-wider">
        Deadlock<br />
        <span className="text-brass">Stats</span>
      </span>
    </Link>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="min-h-screen lg:pl-60">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col border-r border-sidebar-border bg-sidebar px-3 py-5 lg:flex">
        <div className="px-2"><Logo /></div>
        <div className="mt-8 flex-1 overflow-y-auto"><Nav /></div>
        <p className="px-3 text-[10px] leading-relaxed text-muted-foreground/70">Данные deadlock-api.com · Фан-проект, не связан с Valve</p>
      </aside>

      <header className="sticky top-0 z-30 border-b border-border bg-background/75 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 lg:px-8">
          <button className="lg:hidden" onClick={() => setOpen(true)} aria-label="Меню"><Menu /></button>
          <div className="lg:hidden"><Logo /></div>
          <div className="ml-auto w-full max-w-md"><PlayerSearch compact /></div>
        </div>
      </header>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-background/80 backdrop-blur" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-64 border-r border-border bg-sidebar p-4">
            <div className="mb-6 flex items-center justify-between"><Logo /><button onClick={() => setOpen(false)} aria-label="Закрыть"><X /></button></div>
            <Nav onNavigate={() => setOpen(false)} />
          </aside>
        </div>
      )}

      <main className={cn("mx-auto min-h-[80vh] max-w-7xl px-4 py-8 lg:px-8")}>{children}</main>
    </div>
  );
}
