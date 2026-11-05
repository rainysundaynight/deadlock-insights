import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { Loading } from "@/components/dl";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth/steam")({
  validateSearch: (s: Record<string, unknown>) => ({
    token_hash: typeof s["token_hash"] === "string" ? s["token_hash"] : undefined,
    error: typeof s["error"] === "string" ? s["error"] : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Вход через Steam — Deadlock Stats" },
      { name: "description", content: "Завершение входа через Steam." },
      { property: "og:title", content: "Вход через Steam" },
      { property: "og:description", content: "Завершение входа через Steam." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SteamReturn,
});

function SteamReturn() {
  const { token_hash, error } = Route.useSearch();
  const navigate = useNavigate();
  const [msg, setMsg] = useState<string | null>(error ? "Вход отменён или не прошёл проверку." : null);

  useEffect(() => {
    if (!token_hash) return;
    // Opened as a popup from the preview: hand the token back to the main window.
    if (window.opener && window.opener !== window) {
      window.opener.postMessage({ type: "steam-login", token_hash }, window.location.origin);
      window.close();
      return;
    }
    supabase.auth.verifyOtp({ token_hash, type: "magiclink" }).then(({ error: e }) => {
      if (e) setMsg("Не удалось завершить вход. Попробуйте ещё раз.");
      else navigate({ to: "/me", replace: true });
    });
  }, [token_hash, navigate]);

  if (msg) return <div className="panel mx-auto max-w-md p-8 text-center"><p className="font-semibold">{msg}</p></div>;
  return <Loading label="Завершаем вход через Steam…" />;
}
