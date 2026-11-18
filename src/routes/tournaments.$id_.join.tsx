import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";

import { Empty, Loading, PageHeader, inputClass } from "@/components/dl";
import { SteamButton } from "@/components/SteamButton";
import { startSteamLogin, useAuth } from "@/hooks/useAuth";
import { FORMAT_LABEL, errMsg, useTournament } from "@/lib/tournaments";
import { joinTournament } from "@/lib/tournaments.functions";

export const Route = createFileRoute("/tournaments/$id_/join")({
  validateSearch: (s: Record<string, unknown>) => ({ code: typeof s["code"] === "string" ? s["code"] : undefined, team: typeof s["team"] === "string" ? s["team"] : undefined }),
  head: () => ({
    meta: [
      { title: "Приглашение в турнир — Deadlock Stats" },
      { name: "description", content: "Вас пригласили в турнир Deadlock. Войдите через Steam и вступите." },
      { property: "og:title", content: "Приглашение в турнир Deadlock" },
      { property: "og:description", content: "Вступайте в турнир по ссылке." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: JoinPage,
});

function JoinPage() {
  const { id } = Route.useParams();
  const { code, team } = Route.useSearch();
  const { user, ready } = useAuth();
  const q = useTournament(id);
  const join = useServerFn(joinTournament);
  const nav = useNavigate();
  const [teamName, setTeamName] = useState("");
  const [busy, setBusy] = useState(false);
  if (!ready || q.isLoading) return <Loading />;
  const t = q.data?.t;
  if (!t) return <Empty>Турнир не найден.</Empty>;
  const submit = async () => {
    setBusy(true);
    try {
      await join({ data: { tournamentId: id, code: code ?? "", ...(team ? { teamCode: team } : {}), teamName } });
      toast.success("Вы в турнире!");
      nav({ to: "/tournaments/$id", params: { id } });
    } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  };
  const createTeam = t.mode === "6x6" && !team;
  return (
    <div className="mx-auto max-w-lg">
      <PageHeader eyebrow="Приглашение" title={t.name}>{t.mode} · {FORMAT_LABEL[t.format]}</PageHeader>
      <div className="panel space-y-4 p-6 text-center">
        {t.status !== "registration" ? <p>Регистрация уже закрыта.</p> : !user ? (
          <><p className="text-muted-foreground">Войдите через Steam, чтобы вступить.</p><div className="flex justify-center"><SteamButton onClick={startSteamLogin} /></div></>
        ) : (
          <>
            {createTeam && <><p className="text-sm text-muted-foreground">Вы создаёте команду и станете её капитаном. Потом поделитесь ссылкой команды с напарниками.</p><input className={inputClass} placeholder="Название команды" maxLength={40} value={teamName} onChange={(e) => setTeamName(e.target.value)} /></>}
            {team && <p className="text-sm text-muted-foreground">Вас пригласили в команду этого турнира.</p>}
            <button disabled={busy || (createTeam && !teamName.trim())} onClick={submit} className="w-full bg-primary py-3 font-semibold text-primary-foreground disabled:opacity-50">{createTeam ? "Создать команду" : "Вступить"}</button>
          </>
        )}
      </div>
    </div>
  );
}
