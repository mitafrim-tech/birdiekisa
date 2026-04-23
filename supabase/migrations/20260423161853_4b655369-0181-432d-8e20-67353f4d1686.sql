
-- =======================================================
-- PROFILES
-- =======================================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nickname TEXT,
  avatar_url TEXT,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Generic updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trg_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto create profile row on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (NEW.id, NEW.email)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =======================================================
-- TEAMS
-- =======================================================
CREATE TABLE public.teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  logo_url TEXT,
  admin_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  season_start DATE,
  season_end DATE,
  join_code TEXT NOT NULL UNIQUE DEFAULT lower(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER trg_teams_updated_at
BEFORE UPDATE ON public.teams
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =======================================================
-- TEAM MEMBERS
-- =======================================================
CREATE TABLE public.team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (team_id, user_id)
);

ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_team_members_user ON public.team_members(user_id);
CREATE INDEX idx_team_members_team ON public.team_members(team_id);

-- Security definer helpers to avoid recursive RLS
CREATE OR REPLACE FUNCTION public.is_team_member(_team_id UUID, _user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.team_members
    WHERE team_id = _team_id AND user_id = _user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.is_team_admin(_team_id UUID, _user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.teams
    WHERE id = _team_id AND admin_id = _user_id
  );
$$;

-- Auto add admin as a member when team is created
CREATE OR REPLACE FUNCTION public.handle_new_team()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.team_members (team_id, user_id)
  VALUES (NEW.id, NEW.admin_id)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_team_created
AFTER INSERT ON public.teams
FOR EACH ROW EXECUTE FUNCTION public.handle_new_team();

-- =======================================================
-- ROUNDS
-- =======================================================
CREATE TABLE public.rounds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_name TEXT NOT NULL,
  played_on DATE NOT NULL,
  holes_played INTEGER NOT NULL CHECK (holes_played > 0 AND holes_played <= 72),
  birdies INTEGER NOT NULL DEFAULT 0 CHECK (birdies >= 0),
  eagles INTEGER NOT NULL DEFAULT 0 CHECK (eagles >= 0),
  albatrosses INTEGER NOT NULL DEFAULT 0 CHECK (albatrosses >= 0),
  hole_in_ones INTEGER NOT NULL DEFAULT 0 CHECK (hole_in_ones >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.rounds ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER trg_rounds_updated_at
BEFORE UPDATE ON public.rounds
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_rounds_team_user ON public.rounds(team_id, user_id);
CREATE INDEX idx_rounds_team_date ON public.rounds(team_id, played_on);

-- =======================================================
-- NOTABLE SHOTS (eagle/albatross/hole-in-one details)
-- =======================================================
CREATE TYPE public.shot_type AS ENUM ('eagle', 'albatross', 'hole_in_one');

CREATE TABLE public.notable_shots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id UUID NOT NULL REFERENCES public.rounds(id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  shot_type public.shot_type NOT NULL,
  course_name TEXT NOT NULL,
  hole_number INTEGER CHECK (hole_number IS NULL OR (hole_number > 0 AND hole_number <= 72)),
  event_name TEXT,
  played_on DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.notable_shots ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_notable_shots_team ON public.notable_shots(team_id);
CREATE INDEX idx_notable_shots_user ON public.notable_shots(user_id);

-- =======================================================
-- CHAMPIONS (Hall of Fame)
-- =======================================================
CREATE TABLE public.champions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  season_start DATE NOT NULL,
  season_end DATE NOT NULL,
  birdie_count INTEGER NOT NULL DEFAULT 0,
  season_label TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.champions ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_champions_team ON public.champions(team_id);

-- =======================================================
-- RLS POLICIES
-- =======================================================

-- profiles: anyone signed in can read all profiles (so leaderboard can show nicknames),
-- but only the owner can update their own profile
CREATE POLICY "Profiles are viewable by authenticated users"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

-- teams
CREATE POLICY "Members can view their teams"
  ON public.teams FOR SELECT
  TO authenticated
  USING (public.is_team_member(id, auth.uid()));

-- Allow viewing a team by join_code lookup (via a separate read path is needed,
-- so we expose minimal info via a SECURITY DEFINER function below)

CREATE POLICY "Authenticated users can create teams"
  ON public.teams FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = admin_id);

CREATE POLICY "Admin can update their team"
  ON public.teams FOR UPDATE
  TO authenticated
  USING (auth.uid() = admin_id);

CREATE POLICY "Admin can delete their team"
  ON public.teams FOR DELETE
  TO authenticated
  USING (auth.uid() = admin_id);

-- team_members
CREATE POLICY "Members can view their teams membership"
  ON public.team_members FOR SELECT
  TO authenticated
  USING (public.is_team_member(team_id, auth.uid()));

CREATE POLICY "Users can join teams as themselves"
  ON public.team_members FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can leave their own membership"
  ON public.team_members FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- rounds
CREATE POLICY "Team members can view team rounds"
  ON public.rounds FOR SELECT
  TO authenticated
  USING (public.is_team_member(team_id, auth.uid()));

CREATE POLICY "Members can log their own rounds"
  ON public.rounds FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND public.is_team_member(team_id, auth.uid())
  );

CREATE POLICY "Owners can update their rounds"
  ON public.rounds FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Owners can delete their rounds"
  ON public.rounds FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- notable_shots
CREATE POLICY "Team members can view notable shots"
  ON public.notable_shots FOR SELECT
  TO authenticated
  USING (public.is_team_member(team_id, auth.uid()));

CREATE POLICY "Members can log their own shots"
  ON public.notable_shots FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND public.is_team_member(team_id, auth.uid())
  );

CREATE POLICY "Owners can delete their notable shots"
  ON public.notable_shots FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- champions
CREATE POLICY "Team members can view champions"
  ON public.champions FOR SELECT
  TO authenticated
  USING (public.is_team_member(team_id, auth.uid()));

CREATE POLICY "Admin can insert champions"
  ON public.champions FOR INSERT
  TO authenticated
  WITH CHECK (public.is_team_admin(team_id, auth.uid()));

-- =======================================================
-- JOIN BY CODE: SECURITY DEFINER helpers
-- =======================================================

-- Lookup minimal team info by join code (so non-members can preview)
CREATE OR REPLACE FUNCTION public.get_team_by_join_code(_code TEXT)
RETURNS TABLE (id UUID, name TEXT, logo_url TEXT)
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, name, logo_url FROM public.teams WHERE join_code = _code LIMIT 1;
$$;

-- Join a team by code as the current user
CREATE OR REPLACE FUNCTION public.join_team_by_code(_code TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_team_id UUID;
  v_user UUID := auth.uid();
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT id INTO v_team_id FROM public.teams WHERE join_code = _code LIMIT 1;
  IF v_team_id IS NULL THEN
    RAISE EXCEPTION 'Invalid join code';
  END IF;

  INSERT INTO public.team_members (team_id, user_id)
  VALUES (v_team_id, v_user)
  ON CONFLICT (team_id, user_id) DO NOTHING;

  RETURN v_team_id;
END;
$$;

-- =======================================================
-- STORAGE BUCKETS
-- =======================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('team-logos', 'team-logos', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Public read for both
CREATE POLICY "Public read team logos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'team-logos');

CREATE POLICY "Public read avatars"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

-- Authenticated users can upload to their own folder (path starts with their uid)
CREATE POLICY "Users upload own team logos"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'team-logos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users update own team logos"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'team-logos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users upload own avatars"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users update own avatars"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
