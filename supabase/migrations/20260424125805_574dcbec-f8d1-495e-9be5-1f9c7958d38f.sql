-- Revoke the broad table-level SELECT first (it was overriding column-level revokes)
REVOKE SELECT ON public.teams FROM PUBLIC;
REVOKE SELECT ON public.teams FROM anon;
REVOKE SELECT ON public.teams FROM authenticated;

-- Re-grant SELECT explicitly on every column EXCEPT join_code
GRANT SELECT (id, name, logo_url, admin_id, season_start, season_end, created_at, updated_at)
  ON public.teams TO authenticated;

-- Keep service_role unrestricted (it bypasses RLS / column ACLs anyway, but be explicit)
GRANT SELECT ON public.teams TO service_role;