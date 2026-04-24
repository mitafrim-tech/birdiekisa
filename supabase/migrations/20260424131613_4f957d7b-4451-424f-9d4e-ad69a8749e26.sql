-- 1. List members of a team (admin or member can call; returns nickname/avatar/is_admin)
CREATE OR REPLACE FUNCTION public.list_team_members(_team_id uuid)
RETURNS TABLE(user_id uuid, nickname text, avatar_url text, is_admin boolean, joined_at timestamptz)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF NOT public.is_team_member(_team_id, auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  RETURN QUERY
  SELECT
    tm.user_id,
    p.nickname,
    p.avatar_url,
    (t.admin_id = tm.user_id) AS is_admin,
    tm.joined_at
  FROM public.team_members tm
  LEFT JOIN public.profiles p ON p.id = tm.user_id
  JOIN public.teams t ON t.id = tm.team_id
  WHERE tm.team_id = _team_id
  ORDER BY (t.admin_id = tm.user_id) DESC, tm.joined_at ASC;
END;
$$;

-- 2. Admin updates a member's nickname
CREATE OR REPLACE FUNCTION public.admin_update_member_nickname(_team_id uuid, _user_id uuid, _nickname text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF NOT public.is_team_admin(_team_id, auth.uid()) THEN
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
END;
$$;

-- 3. Admin removes a member from a team
CREATE OR REPLACE FUNCTION public.admin_remove_team_member(_team_id uuid, _user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF NOT public.is_team_admin(_team_id, auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  SELECT admin_id INTO v_admin_id FROM public.teams WHERE id = _team_id;
  IF v_admin_id = _user_id THEN
    RAISE EXCEPTION 'Cannot remove the team admin. Transfer admin role first.';
  END IF;
  DELETE FROM public.team_members WHERE team_id = _team_id AND user_id = _user_id;
END;
$$;

-- 4. Admin transfers admin role to another existing member
CREATE OR REPLACE FUNCTION public.transfer_team_admin(_team_id uuid, _new_admin_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF NOT public.is_team_admin(_team_id, auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF NOT public.is_team_member(_team_id, _new_admin_id) THEN
    RAISE EXCEPTION 'New admin must already be a team member';
  END IF;
  UPDATE public.teams
  SET admin_id = _new_admin_id, updated_at = now()
  WHERE id = _team_id;
END;
$$;