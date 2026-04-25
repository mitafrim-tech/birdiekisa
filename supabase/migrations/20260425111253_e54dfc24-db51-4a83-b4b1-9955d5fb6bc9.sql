-- Add a stable client-generated id so retries can never create duplicate rounds.
ALTER TABLE public.rounds
  ADD COLUMN IF NOT EXISTS submission_id uuid;

CREATE UNIQUE INDEX IF NOT EXISTS rounds_user_submission_id_key
  ON public.rounds (user_id, submission_id)
  WHERE submission_id IS NOT NULL;

ALTER TABLE public.notable_shots
  ADD COLUMN IF NOT EXISTS submission_id uuid;

CREATE UNIQUE INDEX IF NOT EXISTS notable_shots_user_submission_id_key
  ON public.notable_shots (user_id, submission_id)
  WHERE submission_id IS NOT NULL;