-- =============================================================================
-- RLS fixes after 20260204120000: earlier policies were too strict and broke:
-- 1) Admin history: need SELECT on all attempts (not only own).
-- 2) Battle ranking: need SELECT on peers in same competition + profiles(full_name).
-- 3) Battle tables may be missing on older DBs.
--
-- Run once in Supabase SQL Editor (after the first migration).
-- =============================================================================

-- Battle tables (if missing)
CREATE TABLE IF NOT EXISTS public.competition_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  competition_id uuid REFERENCES public.competitions(id) ON DELETE CASCADE,
  question_id uuid REFERENCES public.questions(id) ON DELETE CASCADE,
  position integer NOT NULL,
  UNIQUE (competition_id, position),
  UNIQUE (competition_id, question_id)
);

CREATE TABLE IF NOT EXISTS public.competition_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  competition_id uuid REFERENCES public.competitions(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  joined_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE (competition_id, user_id)
);

-- Authenticated users can read profiles (ranking names; OR with select_own)
DROP POLICY IF EXISTS "profiles_select_authenticated" ON public.profiles;
CREATE POLICY "profiles_select_authenticated" ON public.profiles
  FOR SELECT TO authenticated
  USING (true);

-- Admin: all attempts
DROP POLICY IF EXISTS "attempts_select_admin" ON public.attempts;
CREATE POLICY "attempts_select_admin" ON public.attempts
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- Same battle room: see each other's scores (ranking)
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
