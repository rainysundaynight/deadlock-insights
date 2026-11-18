/** 6x6 pick/ban order: 6 bans and 12 picks, alternating captains. */
export type Side = "a" | "b";
export interface DraftStep { side: Side; kind: "ban" | "pick" }
const s = (side: Side, kind: DraftStep["kind"]): DraftStep => ({ side, kind });
export const DRAFT_ORDER: DraftStep[] = [
  s("a", "ban"), s("b", "ban"), s("a", "ban"), s("b", "ban"),
  s("a", "pick"), s("b", "pick"), s("b", "pick"), s("a", "pick"), s("a", "pick"), s("b", "pick"),
  s("b", "ban"), s("a", "ban"),
  s("b", "pick"), s("a", "pick"), s("a", "pick"), s("b", "pick"), s("b", "pick"), s("a", "pick"),
];
export const STEP_SECONDS = 30;
export const BLIND_CARDS = 3;
export const BLIND_BUILD_SIZE = 6;

export interface DraftAction { step: number; side: Side; kind: "ban" | "pick"; hero_id: number | null }

export function usedHeroes(actions: DraftAction[]) {
  return new Set(actions.map((a) => a.hero_id).filter((h): h is number => h !== null));
}

/** Validate a manual draft move; returns an error message or null. */
export function validateMove(step: number, side: Side, heroId: number, actions: DraftAction[], pool: number[]): string | null {
  const cur = DRAFT_ORDER[step];
  if (!cur) return "Драфт завершён";
  if (cur.side !== side) return "Сейчас ход соперника";
  if (!pool.includes(heroId)) return "Герой недоступен";
  if (usedHeroes(actions).has(heroId)) return "Герой уже выбран или забанен";
  return null;
}

/** What happens when time runs out: bans are skipped, picks get a random free hero. */
export function timeoutAction(step: number, actions: DraftAction[], pool: number[], rand = Math.random): DraftAction {
  const cur = DRAFT_ORDER[step];
  if (cur.kind === "ban") return { step, side: cur.side, kind: "ban", hero_id: null };
  const used = usedHeroes(actions);
  const free = pool.filter((h) => !used.has(h));
  return { step, side: cur.side, kind: "pick", hero_id: free[Math.floor(rand() * free.length)] ?? null };
}

export function picksFor(actions: DraftAction[], side: Side) {
  return actions.filter((a) => a.side === side && a.kind === "pick").sort((x, y) => x.step - y.step).map((a) => a.hero_id);
}

/** Random distinct sample. */
export function sample<T>(list: T[], n: number, rand = Math.random): T[] {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a.slice(0, n);
}
