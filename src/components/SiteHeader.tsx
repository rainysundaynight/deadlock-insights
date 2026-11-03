import { Link } from "@tanstack/react-router";
import { Menu, X } from "lucide-react";
import { useState } from "react";

const NAV = [
  { to: "/heroes", label: "Герои" },
  { to: "/items", label: "Предметы" },
  { to: "/leaderboard", label: "Лидерборд" },
  { to: "/builds", label: "Билды" },
  { to: "/meta", label: "Мета" },
  { to: "/live", label: "Live" },
  { to: "/ranks", label: "Ранги" },
  { to: "/patches", label: "Патчи" },
] as const;

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-6 px-4">
        <Link to="/" className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-sm border border-primary/60 font-display text-lg text-primary">D</span>
          <span className="font-display text-lg uppercase tracking-[0.2em]">
            Dead<span className="text-brass">lock</span> Stats
          </span>
        </Link>
        <nav className="ml-auto hidden items-center gap-1 lg:flex">
          {NAV.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              className="rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
              activeProps={{ className: "text-primary" }}
            >
              {n.label}
            </Link>
          ))}
        </nav>
        <button className="ml-auto lg:hidden" onClick={() => setOpen(!open)} aria-label="Меню">
          {open ? <X /> : <Menu />}
        </button>
      </div>
      {open && (
        <nav className="flex flex-col border-t border-border px-4 py-2 lg:hidden">
          {NAV.map((n) => (
            <Link key={n.to} to={n.to} onClick={() => setOpen(false)} className="py-2 text-muted-foreground" activeProps={{ className: "text-primary" }}>
              {n.label}
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
}
