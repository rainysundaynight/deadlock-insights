import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Bell, Check, LogOut, Plus, Target, Trash2, UserPlus, X } from "lucide-react";
import { useMemo, useState } from "react";

import { Empty, Loading, PageHeader, SectionTitle, selectClass, inputClass, useSteamProfiles } from "@/components/dl";
import { SteamButton } from "@/components/SteamButton";
import { supabase } from "@/integrations/supabase/client";
import { startSteamLogin, useAuth, useFollows, useInvalidateFollows, useMyProfile } from "@/hooks/useAuth";
import { api, type MatchHistoryEntry } from "@/lib/api";
import { fmtAgo } from "@/lib/format";
import { GOAL_METRICS, goalProgress, type GoalMetric } from "@/lib/goals";
import { getSteamFriends } from "@/lib/steam.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/me")({
  head: () => ({
    meta: [
      { title: "Мой кабинет — Deadlock Stats" },
      { name: "description", content: "Ваш профиль Deadlock, друзья из Steam, уведомления о их матчах и личные цели." },
      { property: "og:title", content: "Мой кабинет Deadlock Stats" },
      { property: "og:description", content: "Друзья, уведомления и личные цели в Deadlock." },
    ],
  }),
  component: MePage,
});

function MePage() {
  const { user, ready } = useAuth();
  const profile = useMyProfile(user?.id);
  const qc = useQueryClient();
  if (!ready || (user && profile.isLoading)) return <Loading />;
  if (!user)
    return (
      <div className="panel mx-auto mt-10 max-w-lg p-10 text-center">
        <h1 className="font-display text-2xl font-bold">Войдите через Steam</h1>
        <p className="mt-3 text-muted-foreground">Ваш профиль в один клик, друзья из Steam с уведомлениями об их матчах и личные цели с прогрессом.</p>
        <div className="mt-6 flex justify-center"><SteamButton onClick={startSteamLogin} /></div>
        <p className="mt-4 text-xs text-muted-foreground">Мы получаем от Steam только ваш Steam ID — пароль остаётся у Steam.</p>
      </div>
    );
  const acc = profile.data?.steam_account_id;
  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center gap-5">
        {profile.data?.avatar_url && <img src={profile.data.avatar_url} alt="" className="h-16 w-16 rounded-xl" />}
        <div className="flex-1">
          <PageHeader eyebrow="Кабинет" title={profile.data?.persona_name ?? "Мой кабинет"} />
        </div>
        {acc && <Link to="/players/$accountId" params={{ accountId: String(acc) }} className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground">Мой профиль</Link>}
        <button onClick={async () => { await qc.cancelQueries(); qc.clear(); await supabase.auth.signOut(); }} className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm text-muted-foreground hover:text-foreground"><LogOut className="h-4 w-4" />Выйти</button>
      </div>
      {acc && <Goals userId={user.id} accountId={acc} />}
      <Following userId={user.id} />
      <Friends userId={user.id} />
    </div>
  );
}

function Goals({ userId, accountId }: { userId: string; accountId: number }) {
  const qc = useQueryClient();
  const goals = useQuery({ queryKey: ["goals", userId], queryFn: async () => (await supabase.from("goals").select("*").order("created_at")).data ?? [] });
  const history = useQuery({ queryKey: ["history", accountId], queryFn: () => api<MatchHistoryEntry[]>(`/v1/players/${accountId}/match-history`) });
  const [metric, setMetric] = useState<GoalMetric>("deaths");
  const [op, setOp] = useState<string>("lte");
  const [target, setTarget] = useState("5");
  const add = async () => {
    await supabase.from("goals").insert({ user_id: userId, metric, op, target: Number(target) });
    qc.invalidateQueries({ queryKey: ["goals"] });
  };
  return (
    <section className="panel p-5">
      <SectionTitle><span className="inline-flex items-center gap-2"><Target className="h-4 w-4 text-primary" />Личные цели · последние 10 матчей</span></SectionTitle>
      <div className="mb-5 flex flex-wrap gap-2">
        <select value={metric} onChange={(e) => { const m = e.target.value as GoalMetric; setMetric(m); setOp(GOAL_METRICS[m].defOp); setTarget(String(GOAL_METRICS[m].def)); }} className={selectClass}>
          {Object.entries(GOAL_METRICS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <select value={op} onChange={(e) => setOp(e.target.value)} className={selectClass}><option value="lte">не больше</option><option value="gte">не меньше</option></select>
        <input type="number" value={target} onChange={(e) => setTarget(e.target.value)} className={cn(inputClass, "w-28")} />
        <button onClick={add} className="inline-flex items-center gap-1 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground"><Plus className="h-4 w-4" />Добавить</button>
      </div>
      {!goals.data?.length ? <p className="text-sm text-muted-foreground">Целей пока нет. Например: «Смертей за матч — не больше 5».</p> : (
        <div className="grid gap-3 md:grid-cols-2">
          {goals.data.map((g) => {
            const meta = GOAL_METRICS[g.metric as GoalMetric];
            if (!meta) return null;
            const p = goalProgress(history.data ?? [], g.metric as GoalMetric, g.op, Number(g.target));
            const pct = p.total ? p.met / p.total : 0;
            return (
              <div key={g.id} className="rounded-lg bg-secondary/60 p-4">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium">{meta.label} {g.op === "lte" ? "≤" : "≥"} {Number(g.target)}</p>
                  <button aria-label="Удалить цель" onClick={async () => { await supabase.from("goals").delete().eq("id", g.id); qc.invalidateQueries({ queryKey: ["goals"] }); }} className="text-muted-foreground hover:text-loss"><Trash2 className="h-4 w-4" /></button>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">Выполнено в <span className={cn("font-semibold", pct >= 0.7 ? "text-win" : pct >= 0.4 ? "text-primary" : "text-loss")}>{p.met} из {p.total}</span> · в среднем {p.avg.toFixed(1)}</p>
                <div className="mt-3 flex gap-1">{p.perMatch.map((ok, i) => <span key={i} className={cn("grid h-6 flex-1 place-items-center rounded", ok ? "bg-win/20 text-win" : "bg-loss/15 text-loss")}>{ok ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}</span>)}</div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function Following({ userId }: { userId: string }) {
  const follows = useFollows(userId);
  const invalidate = useInvalidateFollows();
  const [perm, setPerm] = useState(typeof Notification !== "undefined" ? Notification.permission : "default");
  return (
    <section className="panel p-5">
      <SectionTitle right={perm !== "granted" && typeof Notification !== "undefined" ? (
        <button onClick={async () => setPerm(await Notification.requestPermission())} className="inline-flex items-center gap-2 rounded-full border border-primary/50 px-4 py-1.5 text-sm text-primary"><Bell className="h-4 w-4" />Включить уведомления браузера</button>
      ) : <span className="text-xs text-win">Уведомления включены</span>}>Отслеживаемые игроки</SectionTitle>
      <p className="-mt-2 mb-4 text-sm text-muted-foreground">Пока сайт открыт, мы сообщим, когда кто-то из них начнёт или закончит матч.</p>
      {!follows.data?.length ? <p className="text-sm text-muted-foreground">Пока никого. Добавьте друзей ниже или кнопкой «Следить» в профиле игрока.</p> : (
        <div className="flex flex-wrap gap-2">
          {follows.data.map((f) => (
            <span key={f.id} className="inline-flex items-center gap-2 rounded-full bg-secondary py-1 pl-3 pr-1 text-sm">
              <Link to="/players/$accountId" params={{ accountId: String(f.account_id) }} className="hover:text-primary">{f.name ?? `#${f.account_id}`}</Link>
              <button aria-label="Не следить" onClick={async () => { await supabase.from("followed_players").delete().eq("id", f.id); invalidate(); }} className="rounded-full p-1 text-muted-foreground hover:text-loss"><X className="h-3.5 w-3.5" /></button>
            </span>
          ))}
        </div>
      )}
    </section>
  );
}

function Friends({ userId }: { userId: string }) {
  const fetchFriends = useServerFn(getSteamFriends);
  const friends = useQuery({ queryKey: ["steam-friends", userId], queryFn: () => fetchFriends() });
  const ids = friends.data?.ids ?? [];
  const profiles = useSteamProfiles(ids);
  const follows = useFollows(userId);
  const invalidate = useInvalidateFollows();
  const followed = useMemo(() => new Set((follows.data ?? []).map((f) => Number(f.account_id))), [follows.data]);
  const list = useMemo(() => ids.map((id) => profiles.data?.get(id)).filter((p): p is NonNullable<typeof p> => !!p).sort((a, b) => (b.matches_played_last_30d ?? 0) - (a.matches_played_last_30d ?? 0)), [ids, profiles.data]);
  const follow = async (id: number, name: string) => { await supabase.from("followed_players").insert({ user_id: userId, account_id: id, name }); invalidate(); };

  return (
    <section className="panel p-5">
      <SectionTitle right={list.length > 0 ? <button onClick={async () => { for (const p of list.filter((p) => !followed.has(p.account_id) && (p.matches_played_last_30d ?? 0) > 0)) await follow(p.account_id, p.personaname); }} className="text-sm text-muted-foreground hover:text-primary">Следить за всеми, кто играл в Deadlock</button> : undefined}>Друзья из Steam</SectionTitle>
      {friends.isLoading ? <Loading /> : !friends.data?.ok ? (
        <Empty>{friends.data?.reason === "private" ? "Список друзей в Steam скрыт. Откройте его в настройках приватности Steam и обновите страницу." : friends.data?.reason === "no_key" ? "Загрузка друзей из Steam ещё не настроена на сайте." : "Не удалось загрузить друзей из Steam."}</Empty>
      ) : !list.length ? <Empty>Друзья не найдены.</Empty> : (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((p) => (
            <div key={p.account_id} className="flex items-center gap-3 rounded-lg bg-secondary/60 p-2">
              <img src={p.avatarmedium ?? p.avatar} alt="" className="h-9 w-9 rounded" />
              <div className="min-w-0 flex-1">
                <Link to="/players/$accountId" params={{ accountId: String(p.account_id) }} className="block truncate text-sm font-medium hover:text-primary">{p.personaname}</Link>
                <p className="text-xs text-muted-foreground">{p.matches_played_last_30d ? `${p.matches_played_last_30d} матчей / 30 дн` : "не играл в Deadlock"}</p>
              </div>
              {followed.has(p.account_id) ? <Check className="h-4 w-4 text-win" /> : (
                <button aria-label="Следить" onClick={() => follow(p.account_id, p.personaname)} className="rounded-full p-1.5 text-muted-foreground hover:bg-primary/15 hover:text-primary"><UserPlus className="h-4 w-4" /></button>
              )}
            </div>
          ))}
        </div>
      )}
      <p className="mt-3 text-xs text-muted-foreground">Обновлено {fmtAgo(Math.floor(friends.dataUpdatedAt / 1000))}</p>
    </section>
  );
}

