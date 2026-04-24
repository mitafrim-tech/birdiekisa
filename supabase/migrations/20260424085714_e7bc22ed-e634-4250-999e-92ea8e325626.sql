-- Restrict profile reads: only self + teammates can view a profile.
-- This prevents leaking emails to any authenticated user.

DROP POLICY IF EXISTS "Profiles are viewable by authenticated users" ON public.profiles;

CREATE POLICY "Profiles viewable by self or teammates"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  auth.uid() = id
  OR EXISTS (
    SELECT 1
    FROM public.team_members tm_self
    JOIN public.team_members tm_other
      ON tm_self.team_id = tm_other.team_id
    WHERE tm_self.user_id = auth.uid()
      AND tm_other.user_id = profiles.id
  )
);