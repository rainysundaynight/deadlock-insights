import { useEffect, useRef, useState } from "react";

import { API } from "@/lib/api";

export interface LivePlayer {
  entity_index: number; name: string; team: number; hero: number; level: number;
  nw: number; k: number; d: number; a: number; lh: number; dn: number; dmg: number; heal: number; obj: number; streak: number;
}
export type LiveStatus = "idle" | "connecting" | "streaming" | "ended" | "error";

const QUERY = `SELECT tick, entity_index, "m_iszPlayerName" AS name, "m_iTeamNum" AS team,
"m_PlayerDataGlobal__m_nHeroID" AS hero, "m_PlayerDataGlobal__m_iLevel" AS level,
"m_PlayerDataGlobal__m_iGoldNetWorth" AS nw, "m_PlayerDataGlobal__m_iPlayerKills" AS k,
"m_PlayerDataGlobal__m_iDeaths" AS d, "m_PlayerDataGlobal__m_iPlayerAssists" AS a,
"m_PlayerDataGlobal__m_iLastHits" AS lh, "m_PlayerDataGlobal__m_iDenies" AS dn,
"m_PlayerDataGlobal__m_iHeroDamage" AS dmg, "m_PlayerDataGlobal__m_iHeroHealing" AS heal,
"m_PlayerDataGlobal__m_iObjectiveDamage" AS obj, "m_PlayerDataGlobal__m_iKillStreak" AS streak
FROM CCitadelPlayerController WHERE "m_iTeamNum" IN (2, 3)`;

/** Streams per-player scoreboard of a running match. Demo team 2 → Amber (0), 3 → Sapphire (1). */
export function useLiveScoreboard(matchId: number, enabled: boolean) {
  const [players, setPlayers] = useState<LivePlayer[]>([]);
  const [history, setHistory] = useState<{ t: number; diff: number }[]>([]);
  const [status, setStatus] = useState<LiveStatus>("idle");
  const [message, setMessage] = useState<string>("");
  const latest = useRef(new Map<number, LivePlayer>());
  const tick = useRef(0);

  useEffect(() => {
    if (!enabled) return;
    setStatus("connecting");
    const url = `${API}/v1/matches/demo/live/query?${new URLSearchParams({ query: QUERY, match_id: String(matchId) })}`;
    const es = new EventSource(url);
    let lastSample = -1;
    es.onmessage = (e) => {
      const r = JSON.parse(e.data) as LivePlayer & { tick: number };
      if (!r.hero) return;
      latest.current.set(r.entity_index, { ...r, team: r.team - 2 });
      tick.current = r.tick;
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
      if (tick.current !== lastSample) {
        lastSample = tick.current;
        const sum = (t: number) => list.filter((p) => p.team === t).reduce((s, p) => s + p.nw, 0);
        setHistory((h) => [...h.slice(-600), { t: h.length, diff: sum(0) - sum(1) }]);
      }
    }, 1000);
    return () => { clearInterval(iv); es.close(); };
  }, [matchId, enabled]);

  return { players, history, status, message };
}
