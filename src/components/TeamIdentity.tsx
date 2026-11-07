import { Crown, Orbit } from "lucide-react";
import { cn } from "@/lib/utils";

/** Gazette insignia, deliberately distinct from official game logos. */
export function TeamIdentity({ team, compact = false }: { team: number; compact?: boolean }) {
  const Icon = team === 0 ? Crown : Orbit;
  return (
    <span className={cn("team-identity", team === 0 ? "team-king" : "team-mother", compact && "team-identity-compact")}>
      <span className="team-insignia" aria-hidden><Icon /></span>
      <span className="team-wordmark">{team === 0 ? "Hidden King" : "Archmother"}</span>
    </span>
  );
}