-- At most one battle attempt per user per competition (room).
CREATE UNIQUE INDEX IF NOT EXISTS attempts_one_battle_per_user
  ON public.attempts (competition_id, user_id)
  WHERE competition_id IS NOT NULL;
