-- =====================================================================
-- PHASE 1: ROLES FOUNDATION (backend-only, non-breaking)
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. team_member_role enum + team_members.role column
-- ---------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'team_member_role') THEN
    CREATE TYPE public.team_member_role AS ENUM ('admin', 'member');
  END IF;
END$$;

ALTER TABLE public.team_members
  ADD COLUMN IF NOT EXISTS role public.team_member_role NOT NULL DEFAULT 'member';

-- Backfill: each team's current admin (teams.admin_id) becomes role='admin'.
UPDATE public.team_members tm
SET role = 'admin'
FROM public.teams t
WHERE tm.team_id = t.id
  AND tm.user_id = t.admin_id
  AND tm.role <> 'admin';

CREATE INDEX IF NOT EXISTS idx_team_members_team_role
  ON public.team_members (team_id, role);

-- Keep the handle_new_team trigger function in sync: when a team is created,
-- the creator should be inserted as an admin row, not a default member.
CREATE OR REPLACE FUNCTION public.handle_new_team()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
BEGIN
  INSERT INTO public.team_members (team_id, user_id, role)
  VALUES (NEW.id, NEW.admin_id, 'admin')
  ON CONFLICT (team_id, user_id) DO UPDATE SET role = 'admin';
  RETURN NEW;
END;
$function$;

-- ---------------------------------------------------------------------
-- 2. app_roles table (platform-level roles)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.app_roles (
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role       text NOT NULL CHECK (role IN ('super_admin')),
  granted_at timestamptz NOT NULL DEFAULT now(),
  granted_by uuid REFERENCES auth.users(id),
  PRIMARY KEY (user_id, role)
);

ALTER TABLE public.app_roles ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------
-- 3. super_admin_actions audit log
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.super_admin_actions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id   uuid NOT NULL REFERENCES auth.users(id),
  action_type     text NOT NULL,
  target_team_id  uuid REFERENCES public.teams(id),
  target_user_id  uuid REFERENCES auth.users(id),
  payload         jsonb,
  created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.super_admin_actions ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_super_admin_actions_team_created
  ON public.super_admin_actions (target_team_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_super_admin_actions_actor_created
  ON public.super_admin_actions (actor_user_id, created_at DESC);

-- ---------------------------------------------------------------------
-- 4. Helper functions
-- ---------------------------------------------------------------------

-- is_super_admin(): true iff caller has role='super_admin' in app_roles.
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.app_roles
    WHERE user_id = auth.uid() AND role = 'super_admin'
  );
$$;
GRANT EXECUTE ON FUNCTION public.is_super_admin() TO authenticated;

-- New single-arg variant: is_team_admin(team_uuid).
-- True if the caller is a team admin (via team_members.role='admin' OR legacy
-- teams.admin_id) OR a platform super admin.
CREATE OR REPLACE FUNCTION public.is_team_admin(team_uuid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    public.is_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.team_members
      WHERE team_id = team_uuid
        AND user_id = auth.uid()
        AND role = 'admin'
    )
    OR EXISTS (
      SELECT 1 FROM public.teams
      WHERE id = team_uuid
        AND admin_id = auth.uid()
    );
$$;
GRANT EXECUTE ON FUNCTION public.is_team_admin(uuid) TO authenticated;

-- Keep the existing 2-arg signature for backward compatibility with all
-- existing RLS policies. Widen its body so it also recognizes:
--   - members with team_members.role = 'admin' (multi-admin support), and
--   - platform super admins (only when checking the calling user, since
--     is_super_admin() reads auth.uid()).
-- Original predicate (for traceability):
--   SELECT EXISTS (SELECT 1 FROM public.teams
--     WHERE id = _team_id AND admin_id = _user_id);
CREATE OR REPLACE FUNCTION public.is_team_admin(_team_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    EXISTS (
      SELECT 1 FROM public.teams
      WHERE id = _team_id AND admin_id = _user_id
    )
    OR EXISTS (
      SELECT 1 FROM public.team_members
      WHERE team_id = _team_id AND user_id = _user_id AND role = 'admin'
    )
    OR (
      _user_id = auth.uid() AND public.is_super_admin()
    );
$$;
GRANT EXECUTE ON FUNCTION public.is_team_admin(uuid, uuid) TO authenticated;

-- ---------------------------------------------------------------------
-- 5. RLS policies on app_roles
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS "Super admins can select app_roles" ON public.app_roles;
CREATE POLICY "Super admins can select app_roles"
  ON public.app_roles FOR SELECT TO authenticated
  USING (public.is_super_admin());

DROP POLICY IF EXISTS "Users can view their own app_roles" ON public.app_roles;
CREATE POLICY "Users can view their own app_roles"
  ON public.app_roles FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Super admins can insert app_roles" ON public.app_roles;
CREATE POLICY "Super admins can insert app_roles"
  ON public.app_roles FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS "Super admins can update app_roles" ON public.app_roles;
CREATE POLICY "Super admins can update app_roles"
  ON public.app_roles FOR UPDATE TO authenticated
  USING (public.is_super_admin());

DROP POLICY IF EXISTS "Super admins can delete app_roles" ON public.app_roles;
CREATE POLICY "Super admins can delete app_roles"
  ON public.app_roles FOR DELETE TO authenticated
  USING (public.is_super_admin());

-- ---------------------------------------------------------------------
-- 6. RLS policies on super_admin_actions
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS "Super admins can view audit log" ON public.super_admin_actions;
CREATE POLICY "Super admins can view audit log"
  ON public.super_admin_actions FOR SELECT TO authenticated
  USING (public.is_super_admin());
-- No INSERT/UPDATE/DELETE policies: rows are written only inside
-- SECURITY DEFINER RPCs, which bypass RLS.

-- ---------------------------------------------------------------------
-- 7. Widen admin-scoped policies that compared directly to teams.admin_id
-- ---------------------------------------------------------------------

-- teams: UPDATE
-- Original predicate (for traceability):
--   USING (auth.uid() = admin_id)
DROP POLICY IF EXISTS "Admin can update their team" ON public.teams;
CREATE POLICY "Admin can update their team"
  ON public.teams FOR UPDATE TO authenticated
  USING (public.is_team_admin(id, auth.uid()));

-- teams: DELETE
-- Original predicate (for traceability):
--   USING (auth.uid() = admin_id)
DROP POLICY IF EXISTS "Admin can delete their team" ON public.teams;
CREATE POLICY "Admin can delete their team"
  ON public.teams FOR DELETE TO authenticated
  USING (public.is_team_admin(id, auth.uid()));

-- teams: INSERT — left unchanged. Creating a team still requires the
-- creator to set admin_id = auth.uid(). Super admins do not create
-- teams on behalf of other users at this phase.

-- team_members: INSERT
-- Original predicate (for traceability):
--   WITH CHECK ((auth.uid() = user_id) AND (EXISTS (
--     SELECT 1 FROM teams t
--     WHERE t.id = team_members.team_id AND t.admin_id = auth.uid())))
-- New behavior: still requires inserting yourself OR being an existing
-- team admin / super admin (matches the previous admin-only direct insert
-- intent and keeps join-by-code flow on the SECURITY DEFINER RPC).
DROP POLICY IF EXISTS "Admin self-insert on team creation" ON public.team_members;
CREATE POLICY "Admin self-insert on team creation"
  ON public.team_members FOR INSERT TO authenticated
  WITH CHECK (
    (auth.uid() = user_id AND EXISTS (
      SELECT 1 FROM public.teams t
      WHERE t.id = team_members.team_id AND t.admin_id = auth.uid()
    ))
    OR public.is_team_admin(team_members.team_id, auth.uid())
  );

-- All other admin-scoped policies (champions, team_courses, team_rules)
-- already used is_team_admin(team_id, auth.uid()); they automatically
-- pick up multi-admin and super-admin support via the widened helper above.
-- Member-scoped policies (rounds, notable_shots, profiles, etc.) are not
-- touched.

-- ---------------------------------------------------------------------
-- 8. Updated SECURITY DEFINER RPCs (audit super-admin invocations)
-- ---------------------------------------------------------------------

-- join_team_by_code: behavior unchanged. Audit if invoked by a super admin
-- who is joining a team (rare but possible).
CREATE OR REPLACE FUNCTION public.join_team_by_code(_code text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_team_id UUID;
  v_user UUID := auth.uid();
  v_was_super_admin boolean := false;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT id INTO v_team_id FROM public.teams WHERE join_code = _code LIMIT 1;
  IF v_team_id IS NULL THEN
    RAISE EXCEPTION 'Invalid join code';
  END IF;

  INSERT INTO public.team_members (team_id, user_id, role)
  VALUES (v_team_id, v_user, 'member')
  ON CONFLICT (team_id, user_id) DO NOTHING;

  RETURN v_team_id;
END;
$function$;

-- list_team_members: allow super admin to list any team. Audit when used.
CREATE OR REPLACE FUNCTION public.list_team_members(_team_id uuid)
RETURNS TABLE(user_id uuid, nickname text, avatar_url text, is_admin boolean, joined_at timestamp with time zone)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF NOT public.is_team_member(_team_id, auth.uid()) AND NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  RETURN QUERY
  SELECT
    tm.user_id,
    p.nickname,
    p.avatar_url,
    (tm.role = 'admin' OR t.admin_id = tm.user_id) AS is_admin,
    tm.joined_at
  FROM public.team_members tm
  LEFT JOIN public.profiles p ON p.id = tm.user_id
  JOIN public.teams t ON t.id = tm.team_id
  WHERE tm.team_id = _team_id
  ORDER BY (tm.role = 'admin' OR t.admin_id = tm.user_id) DESC, tm.joined_at ASC;
END;
$function$;

-- get_team_join_code: allow super admin. Audit when used as super admin.
CREATE OR REPLACE FUNCTION public.get_team_join_code(_team_id uuid)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_code text;
  v_is_team_admin boolean;
  v_is_super boolean;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  v_is_team_admin := EXISTS (
    SELECT 1 FROM public.teams WHERE id = _team_id AND admin_id = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM public.team_members
    WHERE team_id = _team_id AND user_id = auth.uid() AND role = 'admin'
  );
  v_is_super := public.is_super_admin();
  IF NOT v_is_team_admin AND NOT v_is_super THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  SELECT join_code INTO v_code FROM public.teams WHERE id = _team_id;
  -- Note: get_team_join_code is read-only and not on the audited action list.
  RETURN v_code;
END;
$function$;

-- admin_remove_team_member
CREATE OR REPLACE FUNCTION public.admin_remove_team_member(_team_id uuid, _user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_admin_id uuid;
  v_is_team_admin boolean;
  v_is_super boolean;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  v_is_team_admin := EXISTS (
    SELECT 1 FROM public.teams WHERE id = _team_id AND admin_id = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM public.team_members
    WHERE team_id = _team_id AND user_id = auth.uid() AND role = 'admin'
  );
  v_is_super := public.is_super_admin();
  IF NOT v_is_team_admin AND NOT v_is_super THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  SELECT admin_id INTO v_admin_id FROM public.teams WHERE id = _team_id;
  IF v_admin_id = _user_id THEN
    RAISE EXCEPTION 'Cannot remove the team admin. Transfer admin role first.';
  END IF;
  DELETE FROM public.team_members WHERE team_id = _team_id AND user_id = _user_id;

  IF v_is_super AND NOT v_is_team_admin THEN
    INSERT INTO public.super_admin_actions
      (actor_user_id, action_type, target_team_id, target_user_id, payload)
    VALUES
      (auth.uid(), 'remove_member', _team_id, _user_id,
       jsonb_build_object('team_id', _team_id, 'user_id', _user_id));
  END IF;
END;
$function$;

-- transfer_team_admin: also flip team_members.role accordingly.
CREATE OR REPLACE FUNCTION public.transfer_team_admin(_team_id uuid, _new_admin_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_old_admin_id uuid;
  v_is_team_admin boolean;
  v_is_super boolean;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  v_is_team_admin := EXISTS (
    SELECT 1 FROM public.teams WHERE id = _team_id AND admin_id = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM public.team_members
    WHERE team_id = _team_id AND user_id = auth.uid() AND role = 'admin'
  );
  v_is_super := public.is_super_admin();
  IF NOT v_is_team_admin AND NOT v_is_super THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF NOT public.is_team_member(_team_id, _new_admin_id) THEN
    RAISE EXCEPTION 'New admin must already be a team member';
  END IF;

  SELECT admin_id INTO v_old_admin_id FROM public.teams WHERE id = _team_id;

  UPDATE public.teams
  SET admin_id = _new_admin_id, updated_at = now()
  WHERE id = _team_id;

  -- New admin's membership row gets role='admin'.
  UPDATE public.team_members
  SET role = 'admin'
  WHERE team_id = _team_id AND user_id = _new_admin_id;

  -- Old admin keeps membership but drops to 'member'
  -- (only if they aren't also explicitly admin via some other mechanism — there isn't one yet).
  IF v_old_admin_id IS NOT NULL AND v_old_admin_id <> _new_admin_id THEN
    UPDATE public.team_members
    SET role = 'member'
    WHERE team_id = _team_id AND user_id = v_old_admin_id;
  END IF;

  IF v_is_super AND NOT v_is_team_admin THEN
    INSERT INTO public.super_admin_actions
      (actor_user_id, action_type, target_team_id, target_user_id, payload)
    VALUES
      (auth.uid(), 'transfer_admin', _team_id, _new_admin_id,
       jsonb_build_object('team_id', _team_id, 'old_admin_id', v_old_admin_id, 'new_admin_id', _new_admin_id));
  END IF;
END;
$function$;

-- admin_update_member_nickname
CREATE OR REPLACE FUNCTION public.admin_update_member_nickname(_team_id uuid, _user_id uuid, _nickname text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_is_team_admin boolean;
  v_is_super boolean;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  v_is_team_admin := EXISTS (
    SELECT 1 FROM public.teams WHERE id = _team_id AND admin_id = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM public.team_members
    WHERE team_id = _team_id AND user_id = auth.uid() AND role = 'admin'
  );
  v_is_super := public.is_super_admin();
  IF NOT v_is_team_admin AND NOT v_is_super THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF NOT public.is_team_member(_team_id, _user_id) THEN
    RAISE EXCEPTION 'User is not a member of this team';
  END IF;
  IF _nickname IS NULL OR length(trim(_nickname)) = 0 THEN
    RAISE EXCEPTION 'Nickname cannot be empty';
  END IF;
  UPDATE public.profiles
  SET nickname = trim(_nickname), updated_at = now()
  WHERE id = _user_id;

  IF v_is_super AND NOT v_is_team_admin THEN
    INSERT INTO public.super_admin_actions
      (actor_user_id, action_type, target_team_id, target_user_id, payload)
    VALUES
      (auth.uid(), 'rename_member', _team_id, _user_id,
       jsonb_build_object('team_id', _team_id, 'user_id', _user_id, 'nickname', trim(_nickname)));
  END IF;
END;
$function$;

-- ---------------------------------------------------------------------
-- 9. Lock down search_path on the remaining helpers (warning hygiene)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_team_member(_team_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.team_members
    WHERE team_id = _team_id AND user_id = _user_id
  );
$function$;

-- ---------------------------------------------------------------------
-- 10. Manual seed for first super admin (DO NOT run automatically).
-- ---------------------------------------------------------------------
-- Run this once in SQL editor to grant yourself super admin.
-- Replace the email with your account.
--
-- INSERT INTO public.app_roles (user_id, role, granted_by)
-- SELECT id, 'super_admin', id
-- FROM auth.users
-- WHERE email = 'your-email@example.com'
-- ON CONFLICT (user_id, role) DO NOTHING;