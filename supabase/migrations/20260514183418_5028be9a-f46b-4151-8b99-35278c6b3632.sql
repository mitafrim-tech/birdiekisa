-- Defense-in-depth: revoke EXECUTE on SECURITY DEFINER functions from anon.
-- All callers should be authenticated; functions still enforce their own auth.uid()/role checks.
REVOKE EXECUTE ON FUNCTION public.join_team_by_code(text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.list_team_members(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.transfer_team_admin(uuid, uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.get_team_join_code(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.admin_update_member_nickname(uuid, uuid, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.admin_remove_team_member(uuid, uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_team_admin(uuid, uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_team_admin(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_team_member(uuid, uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_super_admin() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.get_team_by_join_code(text) FROM anon, public;

GRANT EXECUTE ON FUNCTION public.join_team_by_code(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_team_members(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.transfer_team_admin(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_team_join_code(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_member_nickname(uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_remove_team_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_team_admin(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_team_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_team_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_super_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_team_by_join_code(text) TO authenticated;