import { Link, createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Copy, Crown, Play, Trash2, Users } from "lucide-react";
import { useEffect } from "react";
import { toast } from "sonner";

import { Empty, Loading, PageHeader, SectionTitle } from "@/components/dl";
import { useAuth } from "@/hooks/useAuth";
import { standings, type BMatch } from "@/lib/bracket";
import { FORMAT_LABEL, STATUS_LABEL, errMsg, sideName, useTournament, type TData } from "@/lib/tournaments";
import { getInvites, removeParticipant, startTournament } from "@/lib/tournaments.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/tournaments/$id")({
  head: () => ({
    meta: [
      { title: "Турнир — Deadlock Stats" },
      { name: "description", content: "Сетка турнира Deadlock, участники, матчи и драфт в реальном времени." },
      { property: "og:title", content: "Турнир Deadlock" },
      { property: "og:description", content: "Сетка, участники и матчи турнира." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TournamentPage,
});

function TournamentPage() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const q = useTournament(id);
  const invitesFn = useServerFn(getInvites);
  const startFn = useServerFn(startTournament);
  const removeFn = useServerFn(removeParticipant);
  useEffect(() => { if (q.data?.t?.name) document.title = `${q.data.t.name} — Турнир Deadlock`; }, [q.data?.t?.name]);
  const invites = useQuery({ queryKey: ["invites", id, user?.id], enabled: !!user, queryFn: () => invitesFn({ data: { tournamentId: id } }) });
  if (q.isLoading) return <Loading />;
  const d = q.data;
  if (!d?.t) return <Empty>Турнир не найден.</Empty>;
  const t = d.t;
  const owner = user?.id === t.owner_id;
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const copy = (url: string) => { navigator.clipboard.writeText(url); toast.success("Ссылка скопирована"); };
  const run = async (fn: () => Promise<unknown>) => { try { await fn(); q.refetch(); } catch (e) { toast.error(errMsg(e)); } };
  const me = d.parts.find((p) => p.user_id === user?.id);

  return (
    <div className="space-y-8">
      <PageHeader eyebrow={`${t.mode} · ${FORMAT_LABEL[t.format]} · ${STATUS_LABEL[t.status]}`} title={t.name}>
        {t.rules || "Без особых правил."}
        {t.starts_at && <span className="mt-2 block not-italic font-mono text-xs text-primary">Старт: {new Date(t.starts_at).toLocaleString("ru-RU")}</span>}
      </PageHeader>

      {(t.random_heroes || t.blind_builds) && <div className="flex flex-wrap gap-2">{t.random_heroes && <span className="game-plate bg-primary px-3 py-1 text-xs text-primary-foreground">{t.same_random_hero ? "Одинаковый случайный герой" : "Случайные герои"}</span>}{t.blind_builds && <span className="game-plate bg-primary px-3 py-1 text-xs text-primary-foreground">Слепые билды 1 из 3</span>}</div>}

      {t.status === "registration" && (
        <section className="panel p-5">
          <SectionTitle right={owner && <button onClick={() => run(() => startFn({ data: { tournamentId: id } }))} className="inline-flex items-center gap-2 bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"><Play className="h-4 w-4" />Закрыть регистрацию и построить сетку</button>}>Регистрация</SectionTitle>
          {owner && invites.data?.tournament && <InviteRow label="Ссылка для участников" url={`${origin}/tournaments/${id}/join?code=${invites.data.tournament}`} onCopy={copy} />}
          {invites.data && Object.entries(invites.data.teams).map(([teamId, code]) => <InviteRow key={teamId} label={`Ссылка в команду «${d.teams.find((x) => x.id === teamId)?.name}»`} url={`${origin}/tournaments/${id}/join?team=${code}`} onCopy={copy} />)}
          {!owner && !me && <p className="text-sm text-muted-foreground">Чтобы вступить, попросите у организатора ссылку-приглашение.</p>}
        </section>
      )}

      <Participants d={d} owner={owner} userId={user?.id} canEdit={t.status === "registration"} onRemove={(pid) => run(() => removeFn({ data: { participantId: pid } }))} />

      {d.matches.length > 0 && <Bracket d={d} />}
    </div>
  );
}

function InviteRow({ label, url, onCopy }: { label: string; url: string; onCopy: (u: string) => void }) {
  return <div className="mb-3 flex flex-wrap items-center gap-2"><span className="w-full font-mono text-[10px] uppercase text-muted-foreground sm:w-56">{label}</span><code className="min-w-0 flex-1 truncate border border-border bg-secondary px-3 py-2 text-xs">{url}</code><button onClick={() => onCopy(url)} className="inline-flex items-center gap-1 border border-primary px-3 py-2 text-xs text-primary"><Copy className="h-3 w-3" />Копировать</button></div>;
}

function Participants({ d, owner, userId, canEdit, onRemove }: { d: TData; owner: boolean; userId?: string | undefined; canEdit: boolean; onRemove: (id: string) => void }) {
  const t = d.t!;
  const Row = ({ p }: { p: TData["parts"][number] }) => (
    <li className="flex items-center gap-3 py-1.5 text-sm">
      {p.avatar_url ? <img src={p.avatar_url} alt="" className="h-7 w-7" /> : <span className="h-7 w-7 bg-secondary" />}
      {p.steam_account_id ? <Link to="/players/$accountId" params={{ accountId: String(p.steam_account_id) }} className="flex-1 truncate hover:text-primary">{p.persona_name}</Link> : <span className="flex-1 truncate">{p.persona_name}</span>}
      {canEdit && (owner || p.user_id === userId) && <button aria-label="Удалить" onClick={() => onRemove(p.id)} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>}
    </li>
  );
  if (t.mode === "1x1") return (
    <section className="panel p-5"><SectionTitle right={<span className="font-mono text-xs text-muted-foreground">{d.parts.length}/{t.max_slots}</span>}>Участники</SectionTitle>
      {d.parts.length ? <ul className="grid gap-x-6 sm:grid-cols-2 lg:grid-cols-3">{d.parts.map((p) => <Row key={p.id} p={p} />)}</ul> : <Empty>Пока никого.</Empty>}</section>
  );
  return (
    <section><SectionTitle right={<span className="font-mono text-xs text-muted-foreground">{d.teams.length}/{t.max_slots} команд</span>}>Команды</SectionTitle>
      {d.teams.length ? <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{d.teams.map((tm) => {
        const members = d.parts.filter((p) => p.team_id === tm.id);
        return <div key={tm.id} className="panel p-4"><div className="mb-2 flex items-center justify-between"><h3 className="font-display text-lg font-bold">{tm.name}</h3><span className="inline-flex items-center gap-1 font-mono text-xs text-muted-foreground"><Users className="h-3 w-3" />{members.length}/6</span></div>
          <ul>{members.map((p) => <div key={p.id} className="flex items-center gap-1">{p.user_id === tm.captain_id && <Crown className="h-3 w-3 shrink-0 text-primary" aria-label="Капитан" />}<div className="flex-1"><Row p={p} /></div></div>)}</ul></div>;
      })}</div> : <Empty>Пока нет команд.</Empty>}</section>
  );
}

const BRACKET_TITLE: Record<string, string> = { W: "Верхняя сетка", L: "Нижняя сетка", GF: "Гранд-финал", RR: "Туры" };

function Bracket({ d }: { d: TData }) {
  const groups = ["W", "L", "GF", "RR"].map((b) => [b, d.matches.filter((m) => m.bracket === b)] as const).filter(([, l]) => l.length);
  return (
    <section className="space-y-8">
      {d.t!.format === "round_robin" && <Standings d={d} />}
      {groups.map(([b, list]) => {
        const rounds = [...new Set(list.map((m) => m.round))].sort((x, y) => x - y);
        return (
          <div key={b}>
            <SectionTitle>{BRACKET_TITLE[b]}</SectionTitle>
            <div className="flex gap-6 overflow-x-auto pb-3">
              {rounds.map((r) => (
                <div key={r} className="flex min-w-56 flex-col justify-around gap-3">
                  <p className="font-mono text-[10px] uppercase text-primary">{b === "GF" ? "Финал" : `Раунд ${r}`}</p>
                  {list.filter((m) => m.round === r).map((m) => <MatchCard key={m.id} d={d} m={m} />)}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </section>
  );
}

function MatchCard({ d, m }: { d: TData; m: TData["matches"][number] }) {
  const line = (side: string | null, bye: boolean) => (
    <div className={cn("flex items-center justify-between px-3 py-2 text-sm", m.winner && m.winner === side && "bg-primary/15 font-bold text-primary", m.winner && side && m.winner !== side && "text-muted-foreground line-through")}>
      <span className="truncate">{sideName(d, side, bye)}</span>{m.winner && m.winner === side && <Crown className="h-3 w-3" />}
    </div>
  );
  const live = m.status === "draft";
  const body = <div className={cn("border bg-card", live ? "border-primary" : "border-border")}>{line(m.side_a, m.a_bye)}<div className="h-px bg-border" />{line(m.side_b, m.b_bye)}{live && <p className="bg-primary px-3 py-0.5 font-mono text-[10px] uppercase text-primary-foreground">Драфт идёт</p>}</div>;
  if (!m.side_a || !m.side_b) return body;
  return <Link to="/tournaments/$id/matches/$matchId" params={{ id: m.tournament_id, matchId: m.id }} className="block transition-transform hover:-translate-y-0.5">{body}</Link>;
}

function Standings({ d }: { d: TData }) {
  const rows = standings(d.matches as unknown as BMatch[]);
  return (
    <div className="panel p-5"><SectionTitle>Таблица</SectionTitle>
      <table className="w-full text-sm"><thead className="font-mono text-[10px] uppercase text-muted-foreground"><tr><th className="text-left">#</th><th className="text-left">Участник</th><th>В</th><th>П</th></tr></thead>
        <tbody>{rows.map((r, i) => <tr key={r.id} className="border-t border-border"><td className="py-1.5">{i + 1}</td><td>{sideName(d, r.id)}</td><td className="text-center">{r.wins}</td><td className="text-center">{r.losses}</td></tr>)}</tbody></table>
    </div>
  );
}
