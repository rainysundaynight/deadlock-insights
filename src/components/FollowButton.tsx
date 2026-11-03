import { Check, UserPlus } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { startSteamLogin, useAuth, useFollows, useInvalidateFollows } from "@/hooks/useAuth";

export function FollowButton({ accountId, name }: { accountId: number; name?: string | undefined }) {
  const { user } = useAuth();
  const follows = useFollows(user?.id);
  const invalidate = useInvalidateFollows();
  const row = follows.data?.find((f) => Number(f.account_id) === accountId);
  const cls = "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium";
  if (!user) return <button onClick={startSteamLogin} className={`${cls} border-border text-muted-foreground hover:text-foreground`}><UserPlus className="h-3.5 w-3.5" />Следить</button>;
  return row ? (
    <button onClick={async () => { await supabase.from("followed_players").delete().eq("id", row.id); invalidate(); }} className={`${cls} border-win/50 text-win`}><Check className="h-3.5 w-3.5" />Отслеживается</button>
  ) : (
    <button onClick={async () => { await supabase.from("followed_players").insert({ user_id: user.id, account_id: accountId, name: name ?? null }); invalidate(); }} className={`${cls} border-primary/50 text-primary`}><UserPlus className="h-3.5 w-3.5" />Следить</button>
  );
}
