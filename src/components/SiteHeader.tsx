import { Link, useLocation } from "@tanstack/react-router";
import {
  Activity, BarChart3, Calculator, Crown, GitCompare, Hammer, Home, LayoutGrid, Menu, Package, ScrollText, Swords, TrendingUp, Trophy, Tv, Users, X,
} from "lucide-react";
import { motion } from "framer-motion";
import { useRef, useState, type ReactNode } from "react";

import { InkBackground } from "@/components/InkBackground";
import { useRevealCards } from "@/components/RevealCards";

import { FriendNotifier } from "@/components/FriendNotifier";
import { PlayerSearch } from "@/components/PlayerSearch";
import { SteamButton } from "@/components/SteamButton";
import { startSteamLogin, useAuth, useMyProfile } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

const GROUPS = [
  {
    title: "Главное",
    items: [
      { to: "/", label: "Главная", icon: Home },
      { to: "/live", label: "Live матчи", icon: Activity, live: true },
      { to: "/compare", label: "Сравнение", icon: GitCompare },
      { to: "/me", label: "Мой кабинет", icon: Users },
    ],
  },
  {
    title: "Мета",
    items: [
      { to: "/tierlist", label: "Тир-лист", icon: Crown },
      { to: "/heroes", label: "Герои", icon: Swords },
      { to: "/meta", label: "Контрпики", icon: LayoutGrid },
      { to: "/duos", label: "Дуо-линии", icon: Users },
      { to: "/trends", label: "Тренды", icon: TrendingUp },
      { to: "/items", label: "Предметы", icon: Package },
      { to: "/builds", label: "Билды", icon: Hammer },
      { to: "/calculator", label: "Калькулятор", icon: Calculator },
    ],
  },
  {
    title: "Сообщество",
    items: [
      { to: "/streams", label: "Стримы", icon: Tv },
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
          <p className="mb-2 border-b border-foreground/60 px-3 pb-1 font-display text-[11px] font-bold uppercase tracking-[0.25em]">{g.title}</p>
          <div className="space-y-0.5">
            {g.items.map((n) => (
              <Link
                key={n.to}
                to={n.to}
                onClick={onNavigate}
                activeOptions={{ exact: n.to === "/" }}
                className="group flex items-center gap-3 border-l-2 border-transparent px-3 py-1.5 text-sm text-muted-foreground transition-all hover:translate-x-0.5 hover:text-foreground"
                activeProps={{ className: "!border-primary !text-foreground font-bold italic" }}
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
      <span className="leading-none">
        <span className="font-masthead block text-[28px]">The Deadlock</span>
        <span className="block border-t border-foreground pt-0.5 text-[9px] font-bold uppercase tracking-[0.35em] text-primary">Stats · Gazette</span>
      </span>
    </Link>
  );
}

function Account() {
  const { user, ready } = useAuth();
  const profile = useMyProfile(user?.id);
  if (!ready) return <span className="h-10 w-10 shrink-0" />;
  if (!user) return <SteamButton compact onClick={startSteamLogin} />;
  return (
    <>
      <FriendNotifier userId={user.id} />
      <Link to="/me" className="flex shrink-0 items-center gap-2 rounded-full border border-border bg-secondary py-1 pl-1 pr-3 text-sm hover:border-primary/50">
        {profile.data?.avatar_url ? <img src={profile.data.avatar_url} alt="" className="h-8 w-8 rounded-full" /> : <span className="h-8 w-8 rounded-full bg-muted" />}
        <span className="hidden max-w-28 truncate sm:inline">{profile.data?.persona_name ?? "Кабинет"}</span>
      </Link>
    </>
  );
}

function Dateline() {
  const d = new Date().toLocaleDateString("ru-RU", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  return <p className="hidden shrink-0 text-[11px] uppercase tracking-[0.2em] text-muted-foreground md:block" suppressHydrationWarning>{d}</p>;
}

export function AppShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const mainRef = useRef<HTMLElement>(null);
  const path = useLocation({ select: (l) => l.pathname });
  useRevealCards(mainRef);
  return (
    <div className="relative min-h-screen lg:pl-60">
      <InkBackground />
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col border-r-4 border-double border-foreground/70 bg-sidebar px-3 py-5 lg:flex">
        <div className="px-2"><Logo /></div>
        <div className="mt-8 flex-1 overflow-y-auto"><Nav /></div>
        <p className="px-3 text-[10px] leading-relaxed text-muted-foreground/70">Данные deadlock-api.com · Фан-проект, не связан с Valve</p>
      </aside>

      <header className="sticky top-0 z-30 border-b-4 border-double border-foreground/70 bg-background/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 lg:px-8">
          <button className="lg:hidden" onClick={() => setOpen(true)} aria-label="Меню"><Menu /></button>
          <div className="lg:hidden"><Logo /></div>
          <Dateline />
          <div className="ml-auto w-full max-w-md"><PlayerSearch compact /></div>
          <Account />
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

      <main ref={mainRef} className={cn("relative z-10 mx-auto min-h-[80vh] max-w-7xl px-4 py-8 lg:px-8")}>
        <motion.div key={path} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}>
          {children}
        </motion.div>
      </main>
    </div>
  );
}
