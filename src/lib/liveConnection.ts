import { API } from "@/lib/api";

export interface LiveListener {
  onMessage: (data: string) => void;
  onStatus?: (msg: string) => void;
  onEnd?: () => void;
  onError?: (msg: string) => void;
}

interface Conn {
  es: EventSource;
  listeners: Set<LiveListener>;
  closeTimer: ReturnType<typeof setTimeout> | undefined;
}

const pool = new Map<string, Conn>();
/** Keep the connection warm this long after the last consumer unmounts, so reopening a tab is free. */
const IDLE_CLOSE_MS = 120_000;

/**
 * Subscribes to a match broadcast. All consumers of the same match+query share one EventSource,
 * and a remount within IDLE_CLOSE_MS reuses the still-open connection instead of spending
 * another one of the hourly broadcast connections.
 */
export function subscribeLive(matchId: number, query: string, listener: LiveListener): () => void {
  const key = `${matchId}|${query}`;
  let conn = pool.get(key);
  if (conn && conn.es.readyState === EventSource.CLOSED) {
    pool.delete(key);
    conn = undefined;
  }
  if (!conn) {
    const url = `${API}/v1/matches/demo/live/query?${new URLSearchParams({ query, match_id: String(matchId) })}`;
    const es = new EventSource(url);
    const c: Conn = { es, listeners: new Set() };
    es.onmessage = (e) => c.listeners.forEach((l) => l.onMessage(e.data));
    es.addEventListener("status", (e) => c.listeners.forEach((l) => l.onStatus?.((e as MessageEvent).data)));
    es.addEventListener("end", () => c.listeners.forEach((l) => l.onEnd?.()));
    es.addEventListener("error", (e) => {
      const data = (e as MessageEvent).data;
      if (data) {
        c.listeners.forEach((l) => l.onError?.(String(data)));
        es.close();
        pool.delete(key);
      } else if (es.readyState === EventSource.CLOSED) {
        c.listeners.forEach((l) => l.onError?.(""));
      }
    });
    pool.set(key, c);
    conn = c;
  }
  if (conn.closeTimer) {
    clearTimeout(conn.closeTimer);
    conn.closeTimer = undefined;
  }
  conn.listeners.add(listener);
  return () => {
    conn.listeners.delete(listener);
    if (!conn.listeners.size && conn.es.readyState !== EventSource.CLOSED) {
      conn.closeTimer = setTimeout(() => {
        conn.es.close();
        pool.delete(key);
      }, IDLE_CLOSE_MS);
    }
  };
}
