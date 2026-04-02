-- Run in Supabase SQL Editor (or CLI) when `attempts` exists but has no user_id yet.
-- Order: profiles (if missing) → columns → competitions → RLS + policies

-- 0) profiles table (if missing)
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  role text NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
  created_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 1) Add user_id (NULL for old rows; app sends user_id for new rows)
ALTER TABLE public.attempts
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- 2) Battle/ranking: competitions must exist before FK competition_id on attempts
CREATE TABLE IF NOT EXISTS public.competitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  subject_id uuid REFERENCES public.subjects(id) ON DELETE SET NULL,
  time_limit_minutes integer NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  created_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.attempts
  ADD COLUMN IF NOT EXISTS competition_id uuid REFERENCES public.competitions(id) ON DELETE SET NULL;

ALTER TABLE public.attempts
  ADD COLUMN IF NOT EXISTS time_spent_seconds integer;

-- 3) Drop old policies if re-running (avoid "policy already exists")
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;

DROP POLICY IF EXISTS "attempts_select_own" ON public.attempts;
DROP POLICY IF EXISTS "attempts_insert_own" ON public.attempts;
DROP POLICY IF EXISTS "attempts_update_none" ON public.attempts;

DROP POLICY IF EXISTS "attempt_answers_select_own" ON public.attempt_answers;
DROP POLICY IF EXISTS "attempt_answers_insert_own" ON public.attempt_answers;

-- 4) Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attempt_answers ENABLE ROW LEVEL SECURITY;

-- 5) Policies profiles
CREATE POLICY "profiles_select_own" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- 6) attempts policies (owner rows only)
CREATE POLICY "attempts_select_own" ON public.attempts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "attempts_insert_own" ON public.attempts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "attempts_update_none" ON public.attempts FOR UPDATE USING (false);

-- 7) attempt_answers policies (via owning attempt)
CREATE POLICY "attempt_answers_select_own" ON public.attempt_answers
  FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.attempts a
    WHERE a.id = attempt_answers.attempt_id AND a.user_id = auth.uid()
  ));

CREATE POLICY "attempt_answers_insert_own" ON public.attempt_answers
  FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.attempts a
    WHERE a.id = attempt_answers.attempt_id AND a.user_id = auth.uid()
  ));

-- 8) Battle tables (if missing) — required for Battle / Ranking
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

-- 9) Extra policies: admin history + ranking + display names
DROP POLICY IF EXISTS "profiles_select_authenticated" ON public.profiles;
CREATE POLICY "profiles_select_authenticated" ON public.profiles
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "attempts_select_admin" ON public.attempts;
CREATE POLICY "attempts_select_admin" ON public.attempts
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

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
