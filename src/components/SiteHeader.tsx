import { Link, useLocation } from "@tanstack/react-router";
import {
  Activity, BarChart3, Calculator, Crown, GitCompare, Hammer, Home, LayoutGrid, Menu, Package, ScrollText, Swords, TrendingUp, Trophy, Tv, Users, X,
} from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useRef, useState, type ReactNode } from "react";

import { InkBackground } from "@/components/InkBackground";
import { MyStack } from "@/components/MyStack";
import { useRevealCards } from "@/components/RevealCards";

import { FriendNotifier } from "@/components/FriendNotifier";
import { PlayerSearch } from "@/components/PlayerSearch";
import { Omnisearch } from "@/components/Omnisearch";
import { SteamButton } from "@/components/SteamButton";
import { startSteamLogin, useAuth, useMyProfile } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

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
    <nav className="space-y-5">
      <MyStack onNavigate={onNavigate} />
      {GROUPS.map((g) => (
        <div key={g.title}>
          <p className="mb-2 border-b border-border px-3 pb-2 font-masthead text-[10px] font-semibold uppercase text-primary">{g.title}</p>
          <div className="space-y-0.5">
            {g.items.map((n) => (
              <Link
                key={n.to}
                to={n.to}
                onClick={onNavigate}
                activeOptions={{ exact: n.to === "/" }}
                className="group flex min-w-0 items-center gap-3 border-l-2 border-transparent px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
                activeProps={{ className: "!border-primary !text-primary bg-primary/10 font-semibold" }}
              >
                <n.icon className="h-4 w-4 shrink-0" />
                <span className="min-w-0 flex-1">{n.label}</span>
                {"live" in n && <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-telemetry" />}
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
        <span className="font-masthead block text-[20px] text-primary">Deadlocked</span>
        <span className="block border-t border-border pt-1 text-[9px] font-medium uppercase text-muted-foreground">The Gazette · Est. 1930</span>
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
  const reduce = useReducedMotion();
  useRevealCards(mainRef);
  return (
    <div className="relative min-h-screen [container-type:inline-size] lg:pl-60">
      <InkBackground />
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col border-r border-border bg-sidebar px-3 py-6 lg:flex">
        <div className="shrink-0 px-2"><Logo /></div>
        <div className="sidebar-scroll mt-8 min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain"><Nav /></div>
        <p className="shrink-0 px-3 pt-4 text-[10px] leading-relaxed text-muted-foreground/70">Данные deadlock-api.com · Фан-проект, не связан с Valve</p>
      </aside>

      <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 lg:px-8">
          <Button variant="ghost" size="icon" className="shrink-0 lg:hidden" onClick={() => setOpen(true)} aria-label="Меню"><Menu /></Button>
          <div className="lg:hidden"><Logo /></div>
          <Dateline />
          <div className="ml-auto hidden w-full max-w-sm sm:block"><PlayerSearch compact /></div>
          <Omnisearch />
          <Account />
        </div>
      </header>

      <AnimatePresence>{open && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-background/80 backdrop-blur" onClick={() => setOpen(false)} />
          <motion.aside initial={{ x: -256 }} animate={{ x: 0 }} exit={{ x: -256 }} className="absolute inset-y-0 left-0 flex w-64 flex-col overflow-hidden border-r border-border bg-sidebar p-4">
            <div className="mb-6 flex shrink-0 items-center justify-between"><Logo /><Button variant="ghost" size="icon" onClick={() => setOpen(false)} aria-label="Закрыть"><X /></Button></div>
            <div className="sidebar-scroll min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain"><Nav onNavigate={() => setOpen(false)} /></div>
          </motion.aside>
        </motion.div>
      )}</AnimatePresence>

      <main ref={mainRef} className={cn("relative z-10 mx-auto min-h-[80vh] max-w-7xl px-4 py-8 lg:px-8")}>
        <motion.div key={path} initial={reduce ? false : { opacity: 0, y: 10, filter: "blur(4px)" }} animate={{ opacity: 1, y: 0, filter: "blur(0px)" }} transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}>
          {children}
        </motion.div>
      </main>
      <footer className="relative z-10 border-t border-border bg-sidebar px-4 py-8 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-6 text-xs text-muted-foreground sm:grid-cols-3">
          <div><p className="mb-3 font-masthead text-sm text-primary">The Deadlocked Gazette</p><p>Независимое издание о Deadlock.<br />Фан-проект. Не связан с Valve.</p></div>
          <div className="sm:border-l sm:border-border sm:pl-6"><p className="mb-3 font-masthead text-primary">Архив редакции</p><div className="flex flex-col gap-2"><Link to="/patches" className="hover:text-primary">Хроника патчей</Link><Link to="/heroes" className="hover:text-primary">Досье героев</Link><Link to="/streams" className="hover:text-primary">Прямые эфиры</Link></div></div>
          <div className="sm:border-l sm:border-border sm:pl-6"><p className="mb-3 font-masthead text-primary">Источники</p><a href="https://deadlock-api.com" target="_blank" rel="noreferrer" className="hover:text-primary">Deadlock API ↗</a><p className="mt-2">Deadlock и изображения героев принадлежат Valve. Иллюстрация города создана для этого издания.</p></div>
        </div>
      </footer>
    </div>
  );
}
