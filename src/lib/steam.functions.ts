import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const BASE = 76561197960265728n;

/** Steam friends of the signed-in user, as Deadlock account ids. */
export const getSteamFriends = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const key = process.env["STEAM_API_KEY"];
    if (!key) return { ok: false as const, reason: "no_key" as const, ids: [] as number[] };
    const { data: profile } = await context.supabase.from("profiles").select("steam_account_id").eq("id", context.userId).maybeSingle();
    if (!profile?.steam_account_id) return { ok: false as const, reason: "no_steam" as const, ids: [] };
    const steamid = (BigInt(profile.steam_account_id) + BASE).toString();
    const r = await fetch(`https://api.steampowered.com/ISteamUser/GetFriendList/v1/?key=${key}&steamid=${steamid}&relationship=friend`);
    if (r.status === 401 || r.status === 403) return { ok: false as const, reason: "private" as const, ids: [] };
    if (!r.ok) return { ok: false as const, reason: "error" as const, ids: [] };
    const j = (await r.json()) as { friendslist?: { friends: { steamid: string }[] } };
    const ids = (j.friendslist?.friends ?? []).map((f) => Number(BigInt(f.steamid) - BASE));
    return { ok: true as const, reason: null, ids };
  });
