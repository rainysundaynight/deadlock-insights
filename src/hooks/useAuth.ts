import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { User } from "@supabase/supabase-js";
import { useEffect, useState } from "react";

import { supabase } from "@/integrations/supabase/client";

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((_e, s) => { setUser(s?.user ?? null); setReady(true); });
    supabase.auth.getSession().then(({ data: d }) => { setUser(d.session?.user ?? null); setReady(true); });
    return () => data.subscription.unsubscribe();
  }, []);
  return { user, ready };
}

export function useMyProfile(userId?: string) {
  return useQuery({
    queryKey: ["my-profile", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("*").eq("id", userId!).maybeSingle();
      return data;
    },
  });
}

export function useFollows(userId?: string) {
  return useQuery({
    queryKey: ["follows", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase.from("followed_players").select("*").order("created_at");
      if (error) throw error;
      return data;
    },
  });
}

export function useInvalidateFollows() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ["follows"] });
}

/** Starts Steam sign-in. In an iframe (editor preview) uses a popup, otherwise a full redirect. */
export function startSteamLogin() {
  const url = "/api/public/steam/login";
  if (window.self === window.top) { window.location.href = url; return; }
  const popup = window.open(url, "steam-login", "width=800,height=700");
  const onMsg = async (e: MessageEvent) => {
    if (e.origin !== window.location.origin || e.data?.type !== "steam-login") return;
    window.removeEventListener("message", onMsg);
    await supabase.auth.verifyOtp({ token_hash: e.data.token_hash, type: "magiclink" });
    popup?.close();
  };
  window.addEventListener("message", onMsg);
}
