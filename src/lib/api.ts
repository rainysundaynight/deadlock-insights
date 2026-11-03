import { queryOptions } from "@tanstack/react-query";

export const API = "https://api.deadlock-api.com";

export async function api<T>(path: string, params?: Record<string, string | number | boolean | undefined | null>): Promise<T> {
  const url = new URL(path, API);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v));
    }
  }
  const res = await fetch(url.toString());
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Ошибка API ${res.status}${text ? `: ${text.slice(0, 160)}` : ""}`);
  }
  return res.json() as Promise<T>;
}

// ---------- Types ----------
export interface Hero {
  id: number;
  name: string;
  class_name: string;
  hero_type?: string;
  player_selectable: boolean;
  disabled: boolean;
  in_development: boolean;
  complexity?: number;
  description?: { lore?: string; role?: string; playstyle?: string };
  images: { icon_image_small?: string; icon_image_small_webp?: string; icon_hero_card?: string; icon_hero_card_webp?: string; background_image_webp?: string; [k: string]: string | undefined };
  colors?: { style_hex?: string };
  tags?: string[];
  items?: Record<string, string>;
}
export interface Item {
  id: number;
  name: string;
  class_name: string;
  type: string;
  image?: string;
  image_webp?: string;
  shop_image?: string;
  shop_image_webp?: string;
  item_slot_type?: string;
  item_tier?: number;
  cost?: number;
  shopable?: boolean;
  is_active_item?: boolean;
  description?: { desc?: string; active?: string; passive?: string };
  hero?: number;
  heroes?: number[];
}
export interface Rank {
  tier: number;
  name: string;
  color: string;
  images: { large?: string; large_webp?: string; [k: string]: string | undefined };
}
export interface SteamProfile {
  account_id: number;
  personaname: string;
  profileurl: string;
  avatar?: string;
  avatarmedium?: string;
  avatarfull?: string;
  countrycode?: string | null;
  matches_played_last_30d?: number;
  last_team_avg_badge?: number | null;
}
export interface MatchHistoryEntry {
  match_id: number;
  hero_id: number;
  hero_level: number;
  start_time: number;
  player_team: number;
  player_kills: number;
  player_deaths: number;
  player_assists: number;
  denies: number;
  net_worth: number;
  last_hits: number;
  match_duration_s: number;
  match_result: number;
  game_mode: number;
  match_mode: number;
  ranked_display_badge?: number | null;
  ranked_delta?: number | null;
}
export interface PlayerHeroStat {
  hero_id: number;
  matches_played: number;
  wins: number;
  kills: number;
  deaths: number;
  assists: number;
  time_played: number;
  last_played: number;
  networth_per_min?: number;
  damage_per_min?: number;
  accuracy?: number;
  ending_level?: number;
}
export interface HeroAnalytics {
  hero_id: number;
  wins: number;
  losses: number;
  matches: number;
  total_kills: number;
  total_deaths: number;
  total_assists: number;
  total_net_worth: number;
  total_player_damage: number;
  total_last_hits: number;
  total_denies?: number;
  total_player_damage_taken?: number;
  total_shots_hit?: number;
  total_shots_missed?: number;
}

// ---------- Query options ----------
const day = 1000 * 60 * 60 * 24;

export const heroesQuery = queryOptions({
  queryKey: ["heroes"],
  queryFn: async () => {
    const list = await api<Hero[]>("/v1/assets/heroes", { only_active: true, language: "russian" });
    return list.filter((h) => h.player_selectable && !h.disabled).sort((a, b) => a.name.localeCompare(b.name));
  },
  staleTime: day,
});

export const itemsQuery = queryOptions({
  queryKey: ["items"],
  queryFn: () => api<Item[]>("/v1/assets/items/by-type/upgrade", { language: "russian" }),
  staleTime: day,
});

export const ranksQuery = queryOptions({
  queryKey: ["ranks"],
  queryFn: () => api<Rank[]>("/v1/assets/ranks", { language: "russian" }),
  staleTime: day,
});
