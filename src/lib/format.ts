export const fmtInt = (n: number | null | undefined) =>
  n == null || Number.isNaN(n) ? "—" : Math.round(n).toLocaleString("ru-RU");

export const fmtK = (n: number | null | undefined) => {
  if (n == null || Number.isNaN(n)) return "—";
  const a = Math.abs(n);
  if (a >= 1e9) return (n / 1e9).toFixed(1) + "B";
  if (a >= 1e6) return (n / 1e6).toFixed(1) + "M";
  if (a >= 1e3) return (n / 1e3).toFixed(1) + "k";
  return Math.round(n).toString();
};

export const fmtPct = (v: number | null | undefined, digits = 1) =>
  v == null || Number.isNaN(v) ? "—" : (v * 100).toFixed(digits) + "%";

export const winrate = (wins: number, matches: number) => (matches > 0 ? wins / matches : 0);

export const fmtDuration = (s: number | null | undefined) => {
  if (s == null) return "—";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
};

export const fmtHours = (s: number) => `${(s / 3600).toFixed(1)} ч`;

export const fmtAgo = (unix: number | null | undefined) => {
  if (!unix) return "—";
  const diff = Date.now() / 1000 - unix;
  if (diff < 60) return "только что";
  if (diff < 3600) return `${Math.floor(diff / 60)} мин назад`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} ч назад`;
  if (diff < 86400 * 30) return `${Math.floor(diff / 86400)} дн назад`;
  return new Date(unix * 1000).toLocaleDateString("ru-RU");
};

export const fmtDate = (unix: number) =>
  new Date(unix * 1000).toLocaleString("ru-RU", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

export const kda = (k: number, d: number, a: number) => ((k + a) / Math.max(1, d)).toFixed(2);

/** badge = tier * 10 + subrank */
export const splitBadge = (badge: number | null | undefined) =>
  badge == null || badge <= 0 ? null : { tier: Math.floor(badge / 10), subrank: badge % 10 };

export const REGIONS = [
  { id: "Europe", label: "Европа" },
  { id: "NAmerica", label: "Сев. Америка" },
  { id: "SAmerica", label: "Юж. Америка" },
  { id: "Asia", label: "Азия" },
  { id: "Oceania", label: "Океания" },
] as const;

export const SLOT_LABELS: Record<string, string> = {
  weapon: "Оружие",
  vitality: "Живучесть",
  spirit: "Духовность",
};

export const GAME_MODES: Record<number, string> = {
  1: "Обычный",
  4: "Уличная драка",
};
export const MATCH_MODES: Record<number, string> = {
  1: "Обычный",
  2: "Приватный",
  4: "Рейтинговый",
  6: "Тренировка",
};

export const stripHtml = (s: string) =>
  s
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\{[^}]*\}/g, "")
    .trim();
