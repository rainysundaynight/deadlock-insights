import { createFileRoute } from "@tanstack/react-router";

const STEAM64_BASE = 76561197960265728n;

// Steam returns here. We verify the assertion directly with Steam (never trust the query alone),
// then create/find the app account for that Steam ID and hand the browser a one-time sign-in token.
export const Route = createFileRoute("/api/public/steam/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const origin = url.origin;
        const fail = (reason: string) => Response.redirect(`${origin}/auth/steam?error=${encodeURIComponent(reason)}`, 302);

        const q = url.searchParams;
        if (q.get("openid.mode") !== "id_res") return fail("cancelled");
        if (q.get("openid.return_to") !== `${origin}/api/public/steam/callback`) return fail("bad_return");

        const verify = new URLSearchParams();
        q.forEach((v, k) => { if (k.startsWith("openid.")) verify.set(k, v); });
        verify.set("openid.mode", "check_authentication");
        const res = await fetch("https://steamcommunity.com/openid/login", {
          method: "POST",
          headers: { "content-type": "application/x-www-form-urlencoded" },
          body: verify.toString(),
        });
        const text = await res.text();
        if (!/is_valid\s*:\s*true/.test(text)) return fail("invalid");

        const m = (q.get("openid.claimed_id") ?? "").match(/^https:\/\/steamcommunity\.com\/openid\/id\/(\d{17})$/);
        if (!m) return fail("invalid");
        const steam64 = m[1]!;
        const accountId = Number(BigInt(steam64) - STEAM64_BASE);
        const email = `steam_${steam64}@steam.deadlockstats.app`;

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const created = await supabaseAdmin.auth.admin.createUser({ email, email_confirm: true, user_metadata: { steam_id: steam64 } });
        if (created.error && !/already|registered|exists/i.test(created.error.message)) return fail("account");

        const link = await supabaseAdmin.auth.admin.generateLink({ type: "magiclink", email });
        if (link.error || !link.data.properties?.hashed_token) return fail("token");
        const userId = link.data.user.id;

        let persona: string | null = null, avatar: string | null = null;
        try {
          const r = await fetch(`https://api.deadlock-api.com/v1/players/steam?account_ids=${accountId}`);
          const [p] = (await r.json()) as { personaname?: string; avatarfull?: string }[];
          persona = p?.personaname ?? null; avatar = p?.avatarfull ?? null;
        } catch { /* profile details are optional */ }

        await supabaseAdmin.from("profiles").upsert({ id: userId, steam_account_id: accountId, persona_name: persona, avatar_url: avatar });

        return Response.redirect(`${origin}/auth/steam?token_hash=${encodeURIComponent(link.data.properties.hashed_token)}`, 302);
      },
    },
  },
});
