import { createFileRoute } from "@tanstack/react-router";

// Starts Steam OpenID 2.0 sign-in: redirects the browser to Steam.
export const Route = createFileRoute("/api/public/steam/login")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const origin = new URL(request.url).origin;
        const params = new URLSearchParams({
          "openid.ns": "http://specs.openid.net/auth/2.0",
          "openid.mode": "checkid_setup",
          "openid.return_to": `${origin}/api/public/steam/callback`,
          "openid.realm": origin,
          "openid.identity": "http://specs.openid.net/auth/2.0/identifier_select",
          "openid.claimed_id": "http://specs.openid.net/auth/2.0/identifier_select",
        });
        return Response.redirect(`https://steamcommunity.com/openid/login?${params}`, 302);
      },
    },
  },
});
