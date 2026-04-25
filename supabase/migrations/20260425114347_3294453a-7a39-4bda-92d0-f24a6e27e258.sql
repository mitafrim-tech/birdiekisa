-- 1) PRIVILEGE ESCALATION FIX: team_members INSERT policy
-- Replace the permissive self-insert policy with one that only allows
-- the team admin (initial team creation handled via handle_new_team trigger
-- which runs as SECURITY DEFINER and bypasses RLS) to be inserted directly.
-- All other joins MUST go through join_team_by_code() RPC which is SECURITY DEFINER.

DROP POLICY IF EXISTS "Users can join teams as themselves" ON public.team_members;

-- Only allow direct insert when the user is inserting themselves AS the team admin
-- (covers the rare case the trigger is bypassed; normal joins use the RPC).
CREATE POLICY "Admin self-insert on team creation"
ON public.team_members
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1 FROM public.teams t
    WHERE t.id = team_members.team_id
      AND t.admin_id = auth.uid()
  )
);

-- 2) REALTIME SUBSCRIPTION FIX: restrict realtime.messages
-- Enable RLS on realtime.messages and only allow authenticated users to
-- subscribe to topics that match a team they are a member of.
-- Topic convention: "team:<team_id>" (also accept the bare team UUID).

ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Team members can subscribe to their team topics" ON realtime.messages;

CREATE POLICY "Team members can subscribe to their team topics"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.team_members tm
    WHERE tm.user_id = auth.uid()
      AND (
        realtime.topic() = 'team:' || tm.team_id::text
        OR realtime.topic() = tm.team_id::text
      )
  )
);
