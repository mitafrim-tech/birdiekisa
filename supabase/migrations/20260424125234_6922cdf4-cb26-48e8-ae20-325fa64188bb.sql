-- Revoke direct column access to join_code from regular roles
REVOKE SELECT (join_code) ON public.teams FROM authenticated;
REVOKE SELECT (join_code) ON public.teams FROM anon;

-- Grant explicit SELECT on the remaining columns to authenticated
-- (RLS still applies; this just restores column-level visibility)
GRANT SELECT (id, name, logo_url, admin_id, season_start, season_end, created_at, updated_at) ON public.teams TO authenticated;

-- Admin-only RPC to fetch the join code for a team
CREATE OR REPLACE FUNCTION public.get_team_join_code(_team_id uuid)
RETURNS text
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF NOT public.is_team_admin(_team_id, auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  SELECT join_code INTO v_code FROM public.teams WHERE id = _team_id;
  RETURN v_code;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_team_join_code(uuid) TO authenticated;