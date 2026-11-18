/** Pure tournament bracket generation and advancement. */
export type Format = "single" | "double" | "round_robin";
export interface BMatch {
  key: string;
  bracket: "W" | "L" | "GF" | "RR";
  round: number;
  idx: number;
  side_a: string | null;
  side_b: string | null;
  a_bye: boolean;
  b_bye: boolean;
  winner: string | null;
  status: "pending" | "ready" | "draft" | "finished";
  win_to: string | null;
  win_slot: number | null;
  lose_to: string | null;
  lose_slot: number | null;
}

const mk = (bracket: BMatch["bracket"], round: number, idx: number): BMatch => ({
  key: `${bracket}${round}-${idx}`, bracket, round, idx, side_a: null, side_b: null, a_bye: false, b_bye: false,
  winner: null, status: "pending", win_to: null, win_slot: null, lose_to: null, lose_slot: null,
});

/** Standard seed order for a bracket of size n (1 vs n, 2 vs n-1 …). */
export function seedOrder(n: number): number[] {
  let order = [0];
  while (order.length < n) {
    const m = order.length * 2;
    order = order.flatMap((s) => [s, m - 1 - s]);
  }
  return order;
}

export function nextPow2(n: number) { let p = 1; while (p < n) p *= 2; return p; }

function winnersBracket(entrants: string[], bracket: "W" = "W") {
  const size = Math.max(2, nextPow2(entrants.length));
  const k = Math.log2(size);
  const rounds: BMatch[][] = [];
  for (let r = 1; r <= k; r++) rounds.push(Array.from({ length: size / 2 ** r }, (_, i) => mk(bracket, r, i)));
  const order = seedOrder(size);
  rounds[0].forEach((m, i) => {
    const a = entrants[order[2 * i]] ?? null, b = entrants[order[2 * i + 1]] ?? null;
    m.side_a = a; m.side_b = b; m.a_bye = a === null; m.b_bye = b === null;
  });
  for (let r = 0; r < k - 1; r++) rounds[r].forEach((m, i) => { m.win_to = rounds[r + 1][Math.floor(i / 2)].key; m.win_slot = i % 2; });
  return { rounds, k, size };
}

export function generateBracket(format: Format, entrants: string[]): BMatch[] {
  if (format === "round_robin") return roundRobin(entrants);
  if (format === "double" && entrants.length >= 4) return doubleElim(entrants);
  const { rounds } = winnersBracket(entrants);
  return resolveByes(rounds.flat());
}

function doubleElim(entrants: string[]): BMatch[] {
  const { rounds: wb, k, size } = winnersBracket(entrants);
  const lbRounds: BMatch[][] = [];
  for (let j = 1; j <= 2 * (k - 1); j++) lbRounds.push(Array.from({ length: size / 2 ** (Math.floor((j + 1) / 2) + 1) }, (_, i) => mk("L", j, i)));
  const gf = mk("GF", 1, 0);
  wb[0].forEach((m, i) => { m.lose_to = lbRounds[0][Math.floor(i / 2)].key; m.lose_slot = i % 2; });
  for (let r = 2; r <= k; r++) wb[r - 1].forEach((m, i) => { m.lose_to = lbRounds[2 * (r - 1) - 1][i].key; m.lose_slot = 1; });
  wb[k - 1][0].win_to = gf.key; wb[k - 1][0].win_slot = 0;
  lbRounds.forEach((round, j0) => {
    const j = j0 + 1;
    round.forEach((m, i) => {
      if (j === lbRounds.length) { m.win_to = gf.key; m.win_slot = 1; }
      else if (j % 2 === 1) { m.win_to = lbRounds[j0 + 1][i].key; m.win_slot = 0; }
      else { m.win_to = lbRounds[j0 + 1][Math.floor(i / 2)].key; m.win_slot = i % 2; }
    });
  });
  return resolveByes([...wb.flat(), ...lbRounds.flat(), gf]);
}

/** Circle-method round robin: every entrant meets every other once. */
export function roundRobin(entrants: string[]): BMatch[] {
  const list: (string | null)[] = [...entrants];
  if (list.length % 2) list.push(null);
  const n = list.length, out: BMatch[] = [];
  for (let r = 0; r < n - 1; r++) {
    let idx = 0;
    for (let i = 0; i < n / 2; i++) {
      const a = list[i], b = list[n - 1 - i];
      if (a && b) { const m = mk("RR", r + 1, idx++); m.side_a = a; m.side_b = b; m.status = "ready"; out.push(m); }
    }
    list.splice(1, 0, list.pop()!);
  }
  return out;
}

function place(map: Map<string, BMatch>, key: string | null, slot: number | null, value: string | null) {
  if (!key || slot === null) return;
  const t = map.get(key)!;
  if (slot === 0) { t.side_a = value; t.a_bye = value === null; } else { t.side_b = value; t.b_bye = value === null; }
}

/** Count of feeder matches that still need to fill each slot. */
function feeders(all: BMatch[], key: string, slot: number) {
  return all.filter((m) => (m.win_to === key && m.win_slot === slot) || (m.lose_to === key && m.lose_slot === slot));
}

/** Auto-advance byes and mark matches ready. Idempotent. */
export function resolveByes(all: BMatch[]): BMatch[] {
  const map = new Map(all.map((m) => [m.key, m]));
  let changed = true;
  while (changed) {
    changed = false;
    for (const m of all) {
      if (m.status !== "pending") continue;
      const slotDone = (s: 0 | 1) => {
        const fs = feeders(all, m.key, s);
        const filled = s === 0 ? m.side_a !== null : m.side_b !== null;
        return filled || (fs.length === 0 ? true : fs.every((f) => f.status === "finished"));
      };
      if (!slotDone(0) || !slotDone(1)) continue;
      const a = m.side_a, b = m.side_b;
      if (a && b) { m.status = "ready"; changed = true; continue; }
      // one or both sides empty forever → bye
      m.status = "finished"; m.winner = a ?? b ?? null; changed = true;
      place(map, m.win_to, m.win_slot, m.winner);
      place(map, m.lose_to, m.lose_slot, null);
    }
  }
  return all;
}

/** Record a winner and propagate through the bracket. Returns the mutated list. */
export function reportWinner(all: BMatch[], key: string, winner: string): BMatch[] {
  const m = all.find((x) => x.key === key);
  if (!m || m.status === "finished" || !m.side_a || !m.side_b) throw new Error("Матч нельзя завершить");
  if (winner !== m.side_a && winner !== m.side_b) throw new Error("Победитель не из этого матча");
  const loser = winner === m.side_a ? m.side_b : m.side_a;
  m.winner = winner; m.status = "finished";
  const map = new Map(all.map((x) => [x.key, x]));
  place(map, m.win_to, m.win_slot, winner);
  if (m.lose_to) place(map, m.lose_to, m.lose_slot, loser);
  return resolveByes(all);
}

export function standings(all: BMatch[]) {
  const s = new Map<string, { wins: number; losses: number }>();
  for (const m of all) for (const x of [m.side_a, m.side_b]) if (x && !s.has(x)) s.set(x, { wins: 0, losses: 0 });
  for (const m of all) if (m.status === "finished" && m.winner && m.side_a && m.side_b) {
    s.get(m.winner)!.wins++; s.get(m.winner === m.side_a ? m.side_b : m.side_a)!.losses++;
  }
  return [...s.entries()].map(([id, v]) => ({ id, ...v })).sort((a, b) => b.wins - a.wins || a.losses - b.losses);
}

export function champion(all: BMatch[], format: Format): string | null {
  if (format === "round_robin") return all.length && all.every((m) => m.status === "finished") ? standings(all)[0]?.id ?? null : null;
  const final = all.find((m) => m.bracket === "GF") ?? all.filter((m) => m.bracket === "W").sort((a, b) => b.round - a.round)[0];
  return final?.status === "finished" ? final.winner : null;
}
