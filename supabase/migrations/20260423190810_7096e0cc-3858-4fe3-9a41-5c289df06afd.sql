
-- 1) Team courses
CREATE TABLE public.team_courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  added_by UUID NOT NULL,
  is_official BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (team_id, name)
);
CREATE INDEX idx_team_courses_team ON public.team_courses(team_id);
ALTER TABLE public.team_courses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view team courses"
  ON public.team_courses FOR SELECT TO authenticated
  USING (public.is_team_member(team_id, auth.uid()));

CREATE POLICY "Members can add team courses"
  ON public.team_courses FOR INSERT TO authenticated
  WITH CHECK (public.is_team_member(team_id, auth.uid()) AND auth.uid() = added_by);

CREATE POLICY "Admin can update team courses"
  ON public.team_courses FOR UPDATE TO authenticated
  USING (public.is_team_admin(team_id, auth.uid()));

CREATE POLICY "Admin or adder can delete team courses"
  ON public.team_courses FOR DELETE TO authenticated
  USING (public.is_team_admin(team_id, auth.uid()) OR auth.uid() = added_by);

-- 2) Team rules (markdown)
CREATE TABLE public.team_rules (
  team_id UUID PRIMARY KEY REFERENCES public.teams(id) ON DELETE CASCADE,
  content TEXT NOT NULL DEFAULT '',
  updated_by UUID,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.team_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view team rules"
  ON public.team_rules FOR SELECT TO authenticated
  USING (public.is_team_member(team_id, auth.uid()));

CREATE POLICY "Admin can insert team rules"
  ON public.team_rules FOR INSERT TO authenticated
  WITH CHECK (public.is_team_admin(team_id, auth.uid()));

CREATE POLICY "Admin can update team rules"
  ON public.team_rules FOR UPDATE TO authenticated
  USING (public.is_team_admin(team_id, auth.uid()));

CREATE TRIGGER update_team_rules_updated_at
  BEFORE UPDATE ON public.team_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3) Extend champions for manual entries (eagles/albatrosses/HIO + past birdie winners)
-- Add category, course_name, hole_number, event_date, competition, is_manual
ALTER TABLE public.champions
  ADD COLUMN category TEXT NOT NULL DEFAULT 'birdie_winner',
  ADD COLUMN course_name TEXT,
  ADD COLUMN hole_number INTEGER,
  ADD COLUMN event_date DATE,
  ADD COLUMN competition TEXT,
  ADD COLUMN is_manual BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN created_by UUID;

ALTER TABLE public.champions
  ADD CONSTRAINT champions_category_check
  CHECK (category IN ('birdie_winner','eagle','albatross','hole_in_one'));

-- Allow admin to insert manual entries (existing policy already covers it via is_team_admin)
-- Add update + delete for admin so manual entries are editable
CREATE POLICY "Admin can update champions"
  ON public.champions FOR UPDATE TO authenticated
  USING (public.is_team_admin(team_id, auth.uid()));

CREATE POLICY "Admin can delete champions"
  ON public.champions FOR DELETE TO authenticated
  USING (public.is_team_admin(team_id, auth.uid()));
