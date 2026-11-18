CREATE TABLE public.tournaments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  name text NOT NULL,
  mode text NOT NULL DEFAULT '6x6',
  format text NOT NULL DEFAULT 'single',
  max_slots int NOT NULL DEFAULT 8,
  starts_at timestamptz,
  rules text,
  status text NOT NULL DEFAULT 'registration',
  random_heroes boolean NOT NULL DEFAULT false,
  same_random_hero boolean NOT NULL DEFAULT false,
  blind_builds boolean NOT NULL DEFAULT false,
  invite_code text NOT NULL DEFAULT encode(gen_random_bytes(6),'hex') UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.tournament_teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id uuid NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  name text NOT NULL,
  captain_id uuid NOT NULL,
  invite_code text NOT NULL DEFAULT encode(gen_random_bytes(6),'hex') UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.tournament_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id uuid NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  team_id uuid REFERENCES public.tournament_teams(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  persona_name text,
  avatar_url text,
  steam_account_id bigint,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tournament_id, user_id)
);
CREATE TABLE public.tournament_matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id uuid NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  key text NOT NULL,
  bracket text NOT NULL DEFAULT 'W',
  round int NOT NULL,
  idx int NOT NULL,
  side_a uuid, side_b uuid,
  a_bye boolean NOT NULL DEFAULT false,
  b_bye boolean NOT NULL DEFAULT false,
  winner uuid,
  status text NOT NULL DEFAULT 'pending',
  win_to text, win_slot int, lose_to text, lose_slot int,
  connect_url text,
  draft_step int NOT NULL DEFAULT 0,
  step_deadline timestamptz,
  hero_a int, hero_b int,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tournament_id, key)
);
CREATE TABLE public.draft_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid NOT NULL REFERENCES public.tournament_matches(id) ON DELETE CASCADE,
  step int NOT NULL,
  side text NOT NULL,
  kind text NOT NULL,
  hero_id int,
  auto boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (match_id, step)
);
CREATE TABLE public.blind_picks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid NOT NULL REFERENCES public.tournament_matches(id) ON DELETE CASCADE,
  participant_id uuid NOT NULL,
  card_index int NOT NULL,
  item_ids int[] NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (match_id, participant_id)
);

GRANT SELECT ON public.tournaments, public.tournament_teams, public.tournament_participants, public.tournament_matches, public.draft_actions TO anon, authenticated;
GRANT ALL ON public.tournaments, public.tournament_teams, public.tournament_participants, public.tournament_matches, public.draft_actions, public.blind_picks TO service_role;

ALTER TABLE public.tournaments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournament_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournament_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournament_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.draft_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blind_picks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public read" ON public.tournaments FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "public read" ON public.tournament_teams FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "public read" ON public.tournament_participants FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "public read" ON public.tournament_matches FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "public read" ON public.draft_actions FOR SELECT TO anon, authenticated USING (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.tournament_matches;
ALTER PUBLICATION supabase_realtime ADD TABLE public.draft_actions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.tournament_participants;