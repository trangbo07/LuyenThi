-- Ranking: users who submitted in a room (attempt with competition_id) could SELECT
-- all attempts in that room — not only via competition_participants.
-- Covers missing participant rows but existing scores.
-- NOTE: If this causes recursion, apply 20260204191000 instead.

DROP POLICY IF EXISTS "attempts_select_same_competition" ON public.attempts;
CREATE POLICY "attempts_select_same_competition" ON public.attempts
  FOR SELECT TO authenticated
  USING (
    attempts.competition_id IS NOT NULL
    AND (
      EXISTS (
        SELECT 1 FROM public.competition_participants cp
        WHERE cp.competition_id = attempts.competition_id
          AND cp.user_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM public.attempts mine
        WHERE mine.competition_id = attempts.competition_id
          AND mine.user_id = auth.uid()
      )
    )
  );
