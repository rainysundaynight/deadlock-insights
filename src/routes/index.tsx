import { useQuery } from "@tanstack/react-query";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { Activity, Hammer, Package, ScrollText, Swords, Trophy, Users } from "lucide-react";
import { useMemo, useState } from "react";

import { PlayerSearch } from "@/components/PlayerSearch";
import { HeroIcon, SectionTitle, WinrateBar, inputClass, useHeroMap } from "@/components/dl";
import { api, type HeroAnalytics } from "@/lib/api";
import { fmtInt, winrate } from "@/lib/format";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Deadlock Stats — поиск игроков и статистика" },
      { name: "description", content: "Найдите профиль игрока Deadlock, изучите матчи, героев, предметы и лидерборды." },
      { property: "og:title", content: "Deadlock Stats — поиск игроков и статистика" },
      { property: "og:description", content: "Профили, матчи, герои, предметы и лидерборды Deadlock в одном месте." },
    ],
  }),
  component: Index,
});

const SECTIONS = [
  { to: "/heroes", label: "Герои", desc: "Винрейты, пики, контрпики", icon: Swords },
  { to: "/items", label: "Предметы", desc: "Каталог и эффективность", icon: Package },
  { to: "/leaderboard", label: "Лидерборд", desc: "Топ игроков по регионам", icon: Trophy },
  { to: "/builds", label: "Билды", desc: "Популярные сборки", icon: Hammer },
  { to: "/live", label: "Live матчи", desc: "Идущие прямо сейчас", icon: Activity },
  { to: "/ranks", label: "Ранги", desc: "Распределение игроков", icon: Users },
  { to: "/patches", label: "Патчи", desc: "Последние изменения", icon: ScrollText },
] as const;

function Index() {
  const heroes = useHeroMap();
  const navigate = useNavigate();
  const [matchId, setMatchId] = useState("");
  const { data: stats } = useQuery({
    queryKey: ["hero-stats-week"],
    queryFn: () =>
      api<HeroAnalytics[]>("/v1/analytics/hero-stats", {
        min_unix_timestamp: Math.floor(Date.now() / 1000) - 7 * 86400,
        min_average_badge: 80,
      }),
  });
  const top = useMemo(
    () =>
      (stats ?? [])
        .filter((s) => heroes.has(s.hero_id) && s.matches > 500)
        .sort((a, b) => winrate(b.wins, b.matches) - winrate(a.wins, a.matches))
        .slice(0, 6),
    [stats, heroes],
  );
  const bg = heroes.get(top[0]?.hero_id ?? 0)?.images.background_image_webp;

  return (
    <div className="space-y-16">
      <section className="relative -mx-4 -mt-10 overflow-hidden px-4 pb-16 pt-20">
        {bg && <img src={bg} alt="" className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-15" />}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-background" />
        <div className="relative mx-auto max-w-3xl text-center">
          <p className="mb-4 text-xs font-semibold uppercase tracking-[0.4em] text-primary">Статистика Deadlock</p>
          <h1 className="font-display text-5xl font-bold uppercase leading-none md:text-7xl">
            Знай своих <span className="text-brass">врагов</span>
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-muted-foreground">
            Профили игроков, разбор матчей, мета героев и предметов — по данным миллионов игр.
          </p>
          <div className="mt-8">
            <PlayerSearch autoFocus />
          </div>
          <form
            className="mx-auto mt-3 flex max-w-sm gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (/^\d+$/.test(matchId.trim())) navigate({ to: "/matches/$matchId", params: { matchId: matchId.trim() } });
            }}
          >
            <input value={matchId} onChange={(e) => setMatchId(e.target.value)} placeholder="или ID матча" className={inputClass} />
            <button className="rounded-md border border-primary/60 px-4 text-sm text-primary hover:bg-primary hover:text-primary-foreground">Открыть</button>
          </form>
        </div>
      </section>

      <section>
        <SectionTitle right={<Link to="/heroes" className="text-sm text-muted-foreground hover:text-primary">Все герои →</Link>}>
          Сильнейшие герои недели · Oracle+
        </SectionTitle>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {top.map((s, i) => (
            <Link key={s.hero_id} to="/heroes/$heroId" params={{ heroId: String(s.hero_id) }} className="panel panel-hover flex items-center gap-4 p-4">
              <span className="font-display text-2xl text-muted-foreground">{i + 1}</span>
              <HeroIcon heroId={s.hero_id} size={52} />
              <div className="flex-1">
                <p className="font-display text-lg uppercase">{heroes.get(s.hero_id)?.name}</p>
                <p className="text-xs text-muted-foreground">{fmtInt(s.matches)} матчей</p>
              </div>
              <WinrateBar value={winrate(s.wins, s.matches)} />
            </Link>
          ))}
        </div>
      </section>

      <section>
        <SectionTitle>Разделы</SectionTitle>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {SECTIONS.map((s) => (
            <Link key={s.to} to={s.to} className="panel panel-hover group p-5">
              <s.icon className="h-6 w-6 text-primary" />
              <p className="mt-3 font-display text-lg uppercase">{s.label}</p>
              <p className="text-sm text-muted-foreground">{s.desc}</p>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
