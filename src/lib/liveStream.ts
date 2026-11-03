import { useEffect, useRef, useState } from "react";

import { API } from "@/lib/api";

export interface LivePlayer {
  entity_index: number; name: string; team: number; hero: number; level: number;
  nw: number; k: number; d: number; a: number; lh: number; dn: number; dmg: number; heal: number; obj: number; streak: number;
}
export type LiveStatus = "idle" | "connecting" | "streaming" | "ended" | "error";
export type LiveEventKind = "kill" | "death" | "level" | "streak" | "lead";
export interface LiveEvent { id: number; t: number; kind: LiveEventKind; team: number; hero: number; name: string; text: string }

const TICK_RATE = 60;

const QUERY = `SELECT tick, entity_index, "m_iszPlayerName" AS name, "m_iTeamNum" AS team,
"m_PlayerDataGlobal__m_nHeroID" AS hero, "m_PlayerDataGlobal__m_iLevel" AS level,
"m_PlayerDataGlobal__m_iGoldNetWorth" AS nw, "m_PlayerDataGlobal__m_iPlayerKills" AS k,
"m_PlayerDataGlobal__m_iDeaths" AS d, "m_PlayerDataGlobal__m_iPlayerAssists" AS a,
"m_PlayerDataGlobal__m_iLastHits" AS lh, "m_PlayerDataGlobal__m_iDenies" AS dn,
"m_PlayerDataGlobal__m_iHeroDamage" AS dmg, "m_PlayerDataGlobal__m_iHeroHealing" AS heal,
"m_PlayerDataGlobal__m_iObjectiveDamage" AS obj, "m_PlayerDataGlobal__m_iKillStreak" AS streak
FROM CCitadelPlayerController WHERE "m_iTeamNum" IN (2, 3)`;

/** Diffs two snapshots of the same player into feed events. */
export function diffEvents(prev: LivePlayer | undefined, cur: LivePlayer, t: number): Omit<LiveEvent, "id">[] {
  if (!prev) return [];
  const base = { t, team: cur.team, hero: cur.hero, name: cur.name };
  const out: Omit<LiveEvent, "id">[] = [];
  if (cur.k > prev.k) out.push({ ...base, kind: "kill", text: cur.k - prev.k > 1 ? `сделал ${cur.k - prev.k} убийства` : "совершил убийство" });
  if (cur.d > prev.d) out.push({ ...base, kind: "death", text: prev.streak >= 3 ? `погиб, прервана серия ${prev.streak}` : "погиб" });
  if (cur.streak >= 3 && cur.streak > prev.streak) out.push({ ...base, kind: "streak", text: `серия из ${cur.streak} убийств` });
  if (Math.floor(cur.level / 5) > Math.floor(prev.level / 5)) out.push({ ...base, kind: "level", text: `достиг ${cur.level} уровня` });
  return out;
}

/** Streams per-player scoreboard of a running match. Demo team 2 → Amber (0), 3 → Sapphire (1). */
export function useLiveScoreboard(matchId: number, enabled: boolean) {
  const [players, setPlayers] = useState<LivePlayer[]>([]);
  const [history, setHistory] = useState<{ t: number; diff: number; a: number; s: number }[]>([]);
  const [events, setEvents] = useState<LiveEvent[]>([]);
  const [gameTime, setGameTime] = useState(0);
  const [status, setStatus] = useState<LiveStatus>("idle");
  const [message, setMessage] = useState<string>("");
  const latest = useRef(new Map<number, LivePlayer>());
  const tick = useRef(0);
  const firstTick = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled) return;
    setStatus("connecting");
    const url = `${API}/v1/matches/demo/live/query?${new URLSearchParams({ query: QUERY, match_id: String(matchId) })}`;
    const es = new EventSource(url);
    let lastSample = -1;
    let seq = 0;
    let leader = -1;
    const prevSnap = new Map<number, LivePlayer>();
    es.onmessage = (e) => {
      const r = JSON.parse(e.data) as LivePlayer & { tick: number };
      if (!r.hero) return;
      latest.current.set(r.entity_index, { ...r, team: r.team - 2 });
      tick.current = r.tick;
      if (firstTick.current === null) firstTick.current = r.tick;
    };
    es.addEventListener("status", (e) => setMessage((e as MessageEvent).data));
    es.addEventListener("end", () => { setStatus("ended"); es.close(); });
    es.addEventListener("error", (e) => {
      const data = (e as MessageEvent).data;
      if (data) {
        try { setMessage(JSON.parse(data).error ?? data); } catch { setMessage(String(data)); }
        setStatus("error");
        es.close();
      } else if (es.readyState === EventSource.CLOSED) {
        setStatus((s) => (s === "ended" ? s : "error"));
      }
    });
    const iv = setInterval(() => {
      const list = [...latest.current.values()];
      if (!list.length) return;
      setStatus((s) => (s === "connecting" ? "streaming" : s));
      setPlayers(list);
      const t = Math.round(tick.current / TICK_RATE);
      setGameTime(t);
      const fresh: LiveEvent[] = [];
      for (const p of list) {
        for (const ev of diffEvents(prevSnap.get(p.entity_index), p, t)) fresh.push({ ...ev, id: seq++ });
        prevSnap.set(p.entity_index, p);
      }
      if (tick.current !== lastSample) {
        lastSample = tick.current;
        const sum = (tm: number) => list.filter((p) => p.team === tm).reduce((s, p) => s + p.nw, 0);
        const diff = sum(0) - sum(1);
        const lead = Math.abs(diff) < 1500 ? leader : diff > 0 ? 0 : 1;
        if (lead !== leader && leader !== -1 && lead !== -1) fresh.push({ id: seq++, t, kind: "lead", team: lead, hero: 0, name: lead === 0 ? "Амбер" : "Сапфир", text: "выходит вперёд по душам" });
        leader = lead;
        setHistory((h) => [...h.slice(-900), { t, diff, a: Math.max(0, diff), s: Math.min(0, diff) }]);
      }
      if (fresh.length) setEvents((ev) => [...fresh.reverse(), ...ev].slice(0, 200));
    }, 1000);
    return () => { clearInterval(iv); es.close(); };
  }, [matchId, enabled]);

  return { players, history, events, gameTime, status, message };
}
