-- Delete the duplicate "Kyläjoen Albatrossit" team Vellu accidentally created
DELETE FROM public.team_members WHERE team_id = '50a8056e-d50c-441c-9592-373e4be57d30';
DELETE FROM public.teams WHERE id = '50a8056e-d50c-441c-9592-373e4be57d30';

-- Add Vellu as a member of Mika's original team
INSERT INTO public.team_members (team_id, user_id)
VALUES ('9472d321-d8d7-4aad-8dbf-9cc9d2d900aa', '4e406da0-eb16-4ac1-915f-d04beb36e766')
ON CONFLICT (team_id, user_id) DO NOTHING;