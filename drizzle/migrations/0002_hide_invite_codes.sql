REVOKE SELECT ON public.tournaments, public.tournament_teams FROM anon, authenticated;
GRANT SELECT (id, owner_id, name, mode, format, max_slots, starts_at, rules, status, random_heroes, same_random_hero, blind_builds, created_at) ON public.tournaments TO anon, authenticated;
GRANT SELECT (id, tournament_id, name, captain_id, created_at) ON public.tournament_teams TO anon, authenticated;