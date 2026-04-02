-- FIX: Avoid "infinite recursion detected in policy for relation attempts"
-- The previous policy referenced public.attempts inside the same table's policy,
-- which can recurse when Postgres plans RLS.
-- Allow ranking visibility via competition_participants membership only.

DROP POLICY IF EXISTS "attempts_select_same_competition" ON public.attempts;
CREATE POLICY "attempts_select_same_competition" ON public.attempts
  FOR SELECT TO authenticated
  USING (
    attempts.competition_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.competition_participants cp
      WHERE cp.competition_id = attempts.competition_id
        AND cp.user_id = auth.uid()
    )
  );

