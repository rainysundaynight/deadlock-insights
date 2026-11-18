import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { generateBracket, reportWinner, champion, type BMatch, type Format } from "@/lib/bracket";
import { BLIND_BUILD_SIZE, BLIND_CARDS, DRAFT_ORDER, STEP_SECONDS, sample, timeoutAction, validateMove, type DraftAction, type Side } from "@/lib/draft";

const admin = async () => (await import("@/integrations/supabase/client.server")).supabaseAdmin;
const fail = (msg: string): never => { throw new Error(msg); };

async function heroPool(): Promise<number[]> {
  const r = await fetch("https://api.deadlock-api.com/v1/assets/heroes?only_active=true");
  const list = (await r.json()) as { id: number; player_selectable: boolean; disabled: boolean }[];
  return list.filter((h) => h.player_selectable && !h.disabled).map((h) => h.id);
}
async function itemPool(): Promise<number[]> {
  const r = await fetch("https://api.deadlock-api.com/v1/assets/items/by-type/upgrade");
  const list = (await r.json()) as { id: number; shopable?: boolean; disabled?: boolean }[];
  return list.filter((i) => i.shopable && !i.disabled).map((i) => i.id);
}

async function getTournament(id: string) {
  const db = await admin();
  const { data } = await db.from("tournaments").select("*").eq("id", id).maybeSingle();
  return data ?? fail("Турнир не найден");
}

export const createTournament = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { name: string; mode: "6x6" | "1x1"; format: Format; max_slots: number; starts_at: string | null; rules: string; random_heroes: boolean; same_random_hero: boolean; blind_builds: boolean }) => {
    if (!d.name.trim() || d.name.length > 80) fail("Название 1–80 символов");
    if (!["6x6", "1x1"].includes(d.mode) || !["single", "double", "round_robin"].includes(d.format)) fail("Неверный режим");
    if (d.max_slots < 2 || d.max_slots > 64) fail("Участников 2–64");
    return { ...d, rules: d.rules.slice(0, 2000) };
  })
  .handler(async ({ data, context }) => {
    const db = await admin();
    const is1 = data.mode === "1x1";
    const { data: row, error } = await db.from("tournaments").insert({
      owner_id: context.userId, name: data.name.trim(), mode: data.mode, format: data.format, max_slots: data.max_slots,
      starts_at: data.starts_at, rules: data.rules, random_heroes: is1 && data.random_heroes, same_random_hero: is1 && data.same_random_hero, blind_builds: is1 && data.blind_builds,
    }).select("id").single();
    if (error) fail(error.message);
    return { id: row!.id };
  });

/** Invite codes for the organizer (tournament) and team captains (their team). */
export const getInvites = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { tournamentId: string }) => d)
  .handler(async ({ data, context }) => {
    const db = await admin();
    const t = await getTournament(data.tournamentId);
    const { data: teams } = await db.from("tournament_teams").select("id, invite_code, captain_id").eq("tournament_id", t.id);
    const mine = (teams ?? []).filter((x) => x.captain_id === context.userId);
    return { tournament: t.owner_id === context.userId ? t.invite_code : null, teams: Object.fromEntries(mine.map((x) => [x.id, x.invite_code])) };
  });

export const joinTournament = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { tournamentId: string; code: string; teamCode?: string; teamName?: string }) => d)
  .handler(async ({ data, context }) => {
    const db = await admin();
    const t = await getTournament(data.tournamentId);
    if (t.status !== "registration") fail("Регистрация закрыта");
    const { data: profile } = await db.from("profiles").select("persona_name, avatar_url, steam_account_id").eq("id", context.userId).maybeSingle();
    const me = { tournament_id: t.id, user_id: context.userId, persona_name: profile?.persona_name ?? "Игрок", avatar_url: profile?.avatar_url ?? null, steam_account_id: profile?.steam_account_id ?? null };
    const { data: existing } = await db.from("tournament_participants").select("id").eq("tournament_id", t.id).eq("user_id", context.userId).maybeSingle();
    if (existing) fail("Вы уже участвуете");
    if (t.mode === "1x1") {
      if (data.code !== t.invite_code) fail("Неверная ссылка-приглашение");
      const { count } = await db.from("tournament_participants").select("id", { count: "exact", head: true }).eq("tournament_id", t.id);
      if ((count ?? 0) >= t.max_slots) fail("Мест нет");
      await db.from("tournament_participants").insert(me);
      return { ok: true };
    }
    if (data.teamCode) {
      const { data: team } = await db.from("tournament_teams").select("id").eq("tournament_id", t.id).eq("invite_code", data.teamCode).maybeSingle();
      if (!team) fail("Неверная ссылка команды");
      const { count } = await db.from("tournament_participants").select("id", { count: "exact", head: true }).eq("team_id", team!.id);
      if ((count ?? 0) >= 6) fail("В команде уже 6 игроков");
      await db.from("tournament_participants").insert({ ...me, team_id: team!.id });
      return { ok: true };
    }
    if (data.code !== t.invite_code) fail("Неверная ссылка-приглашение");
    const name = (data.teamName ?? "").trim();
    if (!name || name.length > 40) fail("Название команды 1–40 символов");
    const { count } = await db.from("tournament_teams").select("id", { count: "exact", head: true }).eq("tournament_id", t.id);
    if ((count ?? 0) >= t.max_slots) fail("Мест для команд нет");
    const { data: team } = await db.from("tournament_teams").insert({ tournament_id: t.id, name, captain_id: context.userId }).select("id").single();
    await db.from("tournament_participants").insert({ ...me, team_id: team!.id });
    return { ok: true };
  });

export const removeParticipant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { participantId: string }) => d)
  .handler(async ({ data, context }) => {
    const db = await admin();
    const { data: p } = await db.from("tournament_participants").select("id, tournament_id, team_id, user_id").eq("id", data.participantId).maybeSingle();
    if (!p) fail("Участник не найден");
    const t = await getTournament(p!.tournament_id);
    if (t.owner_id !== context.userId && p!.user_id !== context.userId) fail("Нет прав");
    if (t.status !== "registration") fail("Турнир уже идёт");
    if (p!.team_id) {
      const { data: team } = await db.from("tournament_teams").select("captain_id").eq("id", p!.team_id).single();
      if (team?.captain_id === p!.user_id) { await db.from("tournament_teams").delete().eq("id", p!.team_id); return { ok: true }; }
    }
    await db.from("tournament_participants").delete().eq("id", p!.id);
    return { ok: true };
  });

export const startTournament = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { tournamentId: string }) => d)
  .handler(async ({ data, context }) => {
    const db = await admin();
    const t = await getTournament(data.tournamentId);
    if (t.owner_id !== context.userId) fail("Только организатор");
    if (t.status !== "registration") fail("Турнир уже запущен");
    const entrants = t.mode === "1x1"
      ? ((await db.from("tournament_participants").select("id").eq("tournament_id", t.id).order("created_at")).data ?? []).map((x) => x.id)
      : ((await db.from("tournament_teams").select("id").eq("tournament_id", t.id).order("created_at")).data ?? []).map((x) => x.id);
    if (entrants.length < 2) fail("Нужно минимум 2 участника");
    const matches = generateBracket(t.format as Format, entrants);
    const { error } = await db.from("tournament_matches").insert(matches.map((m) => ({ ...m, tournament_id: t.id })));
    if (error) fail(error.message);
    await db.from("tournaments").update({ status: "running" }).eq("id", t.id);
    return { ok: true };
  });

async function loadMatch(id: string) {
  const db = await admin();
  const { data } = await db.from("tournament_matches").select("*").eq("id", id).maybeSingle();
  return data ?? fail("Матч не найден");
}

/** Side ("a"/"b") the caller controls in a match: captain for 6x6, the player for 1x1. */
async function mySide(m: { side_a: string | null; side_b: string | null }, mode: string, userId: string): Promise<Side | null> {
  const db = await admin();
  for (const [side, id] of [["a", m.side_a], ["b", m.side_b]] as const) {
    if (!id) continue;
    if (mode === "6x6") {
      const { data } = await db.from("tournament_teams").select("captain_id").eq("id", id).maybeSingle();
      if (data?.captain_id === userId) return side;
    } else {
      const { data } = await db.from("tournament_participants").select("user_id").eq("id", id).maybeSingle();
      if (data?.user_id === userId) return side;
    }
  }
  return null;
}

export const startMatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { matchId: string }) => d)
  .handler(async ({ data, context }) => {
    const db = await admin();
    const m = await loadMatch(data.matchId);
    const t = await getTournament(m.tournament_id);
    if (t.owner_id !== context.userId) fail("Только организатор");
    if (m.status !== "ready" || m.draft_step > 0 || m.step_deadline) fail("Матч уже начат");
    if (t.mode === "6x6") {
      await db.from("tournament_matches").update({ status: "draft", draft_step: 0, step_deadline: new Date(Date.now() + STEP_SECONDS * 1000).toISOString() }).eq("id", m.id);
    } else if (t.random_heroes) {
      const pool = await heroPool();
      const [a, b] = sample(pool, 2);
      await db.from("tournament_matches").update({ hero_a: a, hero_b: t.same_random_hero ? a : b, step_deadline: new Date().toISOString() }).eq("id", m.id);
    } else {
      await db.from("tournament_matches").update({ step_deadline: new Date().toISOString() }).eq("id", m.id);
    }
    return { ok: true };
  });

async function applyTimeouts(matchId: string) {
  const db = await admin();
  let m = await loadMatch(matchId);
  if (m.status !== "draft") return m;
  const pool = await heroPool();
  const { data: acts } = await db.from("draft_actions").select("step, side, kind, hero_id").eq("match_id", matchId);
  const actions = (acts ?? []) as DraftAction[];
  let step = m.draft_step, deadline = m.step_deadline ? new Date(m.step_deadline).getTime() : Date.now();
  while (step < DRAFT_ORDER.length && Date.now() > deadline) {
    const a = timeoutAction(step, actions, pool);
    const { error } = await db.from("draft_actions").insert({ match_id: matchId, ...a, auto: true });
    if (error) return loadMatch(matchId); // another caller already resolved this step
    actions.push(a); step++; deadline += STEP_SECONDS * 1000;
  }
  if (step !== m.draft_step) {
    await finishStep(matchId, step, actions, deadline);
    m = await loadMatch(matchId);
  }
  return m;
}

async function finishStep(matchId: string, step: number, actions: DraftAction[], deadline?: number) {
  const db = await admin();
  if (step >= DRAFT_ORDER.length) {
    await db.from("tournament_matches").update({ status: "ready", draft_step: step, step_deadline: null }).eq("id", matchId);
    void actions;
  } else {
    const next = Math.max(deadline ?? 0, Date.now() + STEP_SECONDS * 1000);
    await db.from("tournament_matches").update({ draft_step: step, step_deadline: new Date(deadline && deadline > Date.now() ? deadline : next).toISOString() }).eq("id", matchId);
  }
}

export const draftTick = createServerFn({ method: "POST" })
  .inputValidator((d: { matchId: string }) => d)
  .handler(async ({ data }) => { await applyTimeouts(data.matchId); return { ok: true }; });

export const draftMove = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { matchId: string; heroId: number }) => d)
  .handler(async ({ data, context }) => {
    const db = await admin();
    const m = await applyTimeouts(data.matchId);
    if (m.status !== "draft") fail("Драфт не идёт");
    const t = await getTournament(m.tournament_id);
    const side = await mySide(m, t.mode, context.userId);
    if (!side) fail("Ходят только капитаны");
    const { data: acts } = await db.from("draft_actions").select("step, side, kind, hero_id").eq("match_id", m.id);
    const actions = (acts ?? []) as DraftAction[];
    const err = validateMove(m.draft_step, side!, data.heroId, actions, await heroPool());
    if (err) fail(err);
    const { error } = await db.from("draft_actions").insert({ match_id: m.id, step: m.draft_step, side: side!, kind: DRAFT_ORDER[m.draft_step].kind, hero_id: data.heroId });
    if (error) fail("Ход уже сделан");
    await finishStep(m.id, m.draft_step + 1, actions);
    return { ok: true };
  });

export const chooseHero = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { matchId: string; heroId: number }) => d)
  .handler(async ({ data, context }) => {
    const db = await admin();
    const m = await loadMatch(data.matchId);
    const t = await getTournament(m.tournament_id);
    if (t.mode !== "1x1" || t.random_heroes) fail("Герой выбирается иначе");
    if (m.status !== "ready" || !m.step_deadline) fail("Матч ещё не начат");
    const side = await mySide(m, t.mode, context.userId);
    if (!side) fail("Вы не участник матча");
    if (!(await heroPool()).includes(data.heroId)) fail("Герой недоступен");
    await db.from("tournament_matches").update(side === "a" ? { hero_a: data.heroId } : { hero_b: data.heroId }).eq("id", m.id);
    return { ok: true };
  });

export const blindPick = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { matchId: string; card: number }) => {
    if (!Number.isInteger(d.card) || d.card < 0 || d.card >= BLIND_CARDS) fail("Неверная карта");
    return d;
  })
  .handler(async ({ data, context }) => {
    const db = await admin();
    const m = await loadMatch(data.matchId);
    const t = await getTournament(m.tournament_id);
    if (!t.blind_builds) fail("В турнире нет слепых билдов");
    if (m.status !== "ready" || !m.step_deadline) fail("Матч ещё не начат");
    const side = await mySide(m, t.mode, context.userId);
    if (!side) fail("Вы не участник матча");
    const pid = side === "a" ? m.side_a! : m.side_b!;
    // The build is generated only at pick time, so no card can be peeked in advance.
    const items = sample(await itemPool(), BLIND_BUILD_SIZE);
    const { error } = await db.from("blind_picks").insert({ match_id: m.id, participant_id: pid, card_index: data.card, item_ids: items });
    if (error) fail("Карта уже выбрана");
    return { ok: true };
  });

/** Own pick always; the opponent's only once both have picked. */
export const getBlindPicks = createServerFn({ method: "POST" })
  .inputValidator((d: { matchId: string; userId: string | null }) => d)
  .handler(async ({ data }) => {
    const db = await admin();
    const m = await loadMatch(data.matchId);
    const { data: rows } = await db.from("blind_picks").select("participant_id, card_index, item_ids").eq("match_id", m.id);
    const list = rows ?? [];
    const both = list.length >= 2;
    let myPid: string | null = null;
    if (data.userId) {
      const { data: p } = await db.from("tournament_participants").select("id").eq("tournament_id", m.tournament_id).eq("user_id", data.userId).maybeSingle();
      myPid = p?.id ?? null;
    }
    return {
      both,
      picks: list.map((r) => ({ participant_id: r.participant_id, card_index: r.card_index, item_ids: both || r.participant_id === myPid ? r.item_ids : null })),
    };
  });

export const reportResult = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { matchId: string; winner: string }) => d)
  .handler(async ({ data, context }) => {
    const db = await admin();
    const m = await loadMatch(data.matchId);
    const t = await getTournament(m.tournament_id);
    if (t.owner_id !== context.userId) fail("Только организатор");
    const { data: rows } = await db.from("tournament_matches").select("*").eq("tournament_id", t.id);
    const all = (rows ?? []) as unknown as (BMatch & { id: string })[];
    const before = new Map(all.map((x) => [x.key, JSON.stringify(x)]));
    reportWinner(all, m.key, data.winner);
    for (const x of all) {
      if (before.get(x.key) === JSON.stringify(x)) continue;
      await db.from("tournament_matches").update({ side_a: x.side_a, side_b: x.side_b, a_bye: x.a_bye, b_bye: x.b_bye, winner: x.winner, status: x.status }).eq("id", x.id);
    }
    if (champion(all, t.format as Format)) await db.from("tournaments").update({ status: "finished" }).eq("id", t.id);
    return { ok: true };
  });
