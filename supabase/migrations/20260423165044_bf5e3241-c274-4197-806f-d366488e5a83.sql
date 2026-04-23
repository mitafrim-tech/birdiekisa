-- Re-attach the trigger that auto-adds the admin as a team member.
-- The function public.handle_new_team() already exists.
DROP TRIGGER IF EXISTS on_team_created_add_admin ON public.teams;
CREATE TRIGGER on_team_created_add_admin
AFTER INSERT ON public.teams
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_team();

-- Also re-attach the trigger that creates a profile row when a new auth user signs up.
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user();

-- Updated_at triggers for teams, profiles, rounds.
DROP TRIGGER IF EXISTS set_updated_at_teams ON public.teams;
CREATE TRIGGER set_updated_at_teams
BEFORE UPDATE ON public.teams
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS set_updated_at_profiles ON public.profiles;
CREATE TRIGGER set_updated_at_profiles
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS set_updated_at_rounds ON public.rounds;
CREATE TRIGGER set_updated_at_rounds
BEFORE UPDATE ON public.rounds
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();