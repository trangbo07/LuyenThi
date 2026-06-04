-- =============================================================================
-- FULL SCHEMA RESET — safe to run on a DB that already has data.
-- All CREATE TABLE / ADD COLUMN use IF NOT EXISTS.
-- All policies are dropped then recreated (idempotent).
-- Run once in Supabase SQL Editor.
-- =============================================================================

-- ============================================================
-- 1. CORE TABLES (subjects, exam_sessions, questions)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.subjects (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code       text UNIQUE NOT NULL,
  name       text NOT NULL,
  created_at timestamptz DEFAULT timezone('utc', now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.exam_sessions (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id uuid NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  code       text NOT NULL,
  name       text NOT NULL,
  created_at timestamptz DEFAULT timezone('utc', now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.questions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id      uuid NOT NULL REFERENCES public.exam_sessions(id) ON DELETE CASCADE,
  question_text   text NOT NULL,
  options         text[] NOT NULL,
  correct_options text[] NOT NULL,
  created_at      timestamptz DEFAULT timezone('utc', now()) NOT NULL
);

-- ============================================================
-- 2. PROFILES
-- ============================================================

CREATE TABLE IF NOT EXISTS public.profiles (
  id         uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name  text NOT NULL,
  role       text NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
  created_at timestamptz DEFAULT timezone('utc', now()) NOT NULL
);

-- ============================================================
-- 3. COMPETITIONS (must exist before FK on attempts)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.competitions (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code                text UNIQUE NOT NULL,
  created_by          uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  subject_id          uuid REFERENCES public.subjects(id) ON DELETE SET NULL,
  time_limit_minutes  integer NOT NULL,
  status              text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  created_at          timestamptz DEFAULT timezone('utc', now()) NOT NULL
);

-- ============================================================
-- 4. ATTEMPTS (core table + extra columns)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.attempts (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id       uuid REFERENCES public.subjects(id) ON DELETE SET NULL,
  total_questions  integer NOT NULL DEFAULT 0,
  correct_answers  integer NOT NULL DEFAULT 0,
  score            numeric NOT NULL DEFAULT 0,
  created_at       timestamptz DEFAULT timezone('utc', now()) NOT NULL
);

ALTER TABLE public.attempts
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.attempts
  ADD COLUMN IF NOT EXISTS competition_id uuid REFERENCES public.competitions(id) ON DELETE SET NULL;

ALTER TABLE public.attempts
  ADD COLUMN IF NOT EXISTS time_spent_seconds integer;

-- ============================================================
-- 5. ATTEMPT ANSWERS
-- ============================================================

CREATE TABLE IF NOT EXISTS public.attempt_answers (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id       uuid NOT NULL REFERENCES public.attempts(id) ON DELETE CASCADE,
  question_id      uuid NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  selected_options text[] NOT NULL,
  is_correct       boolean NOT NULL DEFAULT false,
  created_at       timestamptz DEFAULT timezone('utc', now()) NOT NULL
);

-- ============================================================
-- 6. COMPETITION SUPPORT TABLES
-- ============================================================

CREATE TABLE IF NOT EXISTS public.competition_questions (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  competition_id uuid NOT NULL REFERENCES public.competitions(id) ON DELETE CASCADE,
  question_id    uuid NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  position       integer NOT NULL,
  UNIQUE (competition_id, position),
  UNIQUE (competition_id, question_id)
);

CREATE TABLE IF NOT EXISTS public.competition_participants (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  competition_id uuid NOT NULL REFERENCES public.competitions(id) ON DELETE CASCADE,
  user_id        uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  joined_at      timestamptz DEFAULT timezone('utc', now()) NOT NULL,
  UNIQUE (competition_id, user_id)
);

-- ============================================================
-- 7. QUESTION MASTERY
-- ============================================================

CREATE TABLE IF NOT EXISTS public.question_mastery (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  question_id          uuid NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  session_id           uuid REFERENCES public.exam_sessions(id) ON DELETE CASCADE,
  correct_count        integer NOT NULL DEFAULT 0,
  total_attempts       integer NOT NULL DEFAULT 0,
  wrong_count          integer NOT NULL DEFAULT 0,
  is_mastered          boolean NOT NULL DEFAULT false,
  last_answer_correct  boolean,
  last_attempted_at    timestamptz DEFAULT now(),
  created_at           timestamptz DEFAULT timezone('utc', now()) NOT NULL,
  UNIQUE (user_id, question_id)
);

-- ============================================================
-- 8. UNIQUE INDEX — one battle attempt per user per competition
-- ============================================================

CREATE UNIQUE INDEX IF NOT EXISTS attempts_one_battle_per_user
  ON public.attempts (competition_id, user_id)
  WHERE competition_id IS NOT NULL;

-- ============================================================
-- 9. ENABLE ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE public.profiles              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attempts              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attempt_answers       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.competitions          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.competition_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.competition_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.question_mastery      ENABLE ROW LEVEL SECURITY;

-- Public read for subjects, exam_sessions, questions (no auth needed to browse)
ALTER TABLE public.subjects      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions     ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "subjects_select_all"        ON public.subjects;
DROP POLICY IF EXISTS "subjects_insert_admin"      ON public.subjects;
DROP POLICY IF EXISTS "subjects_update_admin"      ON public.subjects;
DROP POLICY IF EXISTS "subjects_delete_admin"      ON public.subjects;

DROP POLICY IF EXISTS "exam_sessions_select_all"   ON public.exam_sessions;
DROP POLICY IF EXISTS "exam_sessions_insert_admin" ON public.exam_sessions;
DROP POLICY IF EXISTS "exam_sessions_update_admin" ON public.exam_sessions;
DROP POLICY IF EXISTS "exam_sessions_delete_admin" ON public.exam_sessions;

DROP POLICY IF EXISTS "questions_select_all"       ON public.questions;
DROP POLICY IF EXISTS "questions_insert_admin"     ON public.questions;
DROP POLICY IF EXISTS "questions_update_admin"     ON public.questions;
DROP POLICY IF EXISTS "questions_delete_admin"     ON public.questions;

-- Everyone can read
CREATE POLICY "subjects_select_all"      ON public.subjects      FOR SELECT USING (true);
CREATE POLICY "exam_sessions_select_all" ON public.exam_sessions FOR SELECT USING (true);
CREATE POLICY "questions_select_all"     ON public.questions     FOR SELECT USING (true);

-- Only admins can write
CREATE POLICY "subjects_insert_admin" ON public.subjects FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));
CREATE POLICY "subjects_update_admin" ON public.subjects FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));
CREATE POLICY "subjects_delete_admin" ON public.subjects FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

CREATE POLICY "exam_sessions_insert_admin" ON public.exam_sessions FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));
CREATE POLICY "exam_sessions_update_admin" ON public.exam_sessions FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));
CREATE POLICY "exam_sessions_delete_admin" ON public.exam_sessions FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

CREATE POLICY "questions_insert_admin" ON public.questions FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));
CREATE POLICY "questions_update_admin" ON public.questions FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));
CREATE POLICY "questions_delete_admin" ON public.questions FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

-- ============================================================
-- 10. RLS POLICIES — profiles
-- ============================================================

DROP POLICY IF EXISTS "profiles_select_own"             ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_own"             ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own"             ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_authenticated"   ON public.profiles;

-- Each user can manage their own row
CREATE POLICY "profiles_select_own"   ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "profiles_insert_own"   ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update_own"   ON public.profiles FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- All authenticated users can read profiles (needed for ranking / display names)
CREATE POLICY "profiles_select_authenticated" ON public.profiles
  FOR SELECT TO authenticated USING (true);

-- ============================================================
-- 11. RLS POLICIES — attempts
-- ============================================================

DROP POLICY IF EXISTS "attempts_select_own"              ON public.attempts;
DROP POLICY IF EXISTS "attempts_insert_own"              ON public.attempts;
DROP POLICY IF EXISTS "attempts_update_none"             ON public.attempts;
DROP POLICY IF EXISTS "attempts_select_admin"            ON public.attempts;
DROP POLICY IF EXISTS "attempts_select_same_competition" ON public.attempts;

-- Owner sees their own attempts
CREATE POLICY "attempts_select_own" ON public.attempts
  FOR SELECT USING (auth.uid() = user_id);

-- Only owner can insert
CREATE POLICY "attempts_insert_own" ON public.attempts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Nobody can update
CREATE POLICY "attempts_update_none" ON public.attempts
  FOR UPDATE USING (false);

-- Admin sees everything
CREATE POLICY "attempts_select_admin" ON public.attempts
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- Participants in a battle room can see all scores in that room (ranking)
-- Uses competition_participants only to avoid infinite recursion.
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

-- ============================================================
-- 12. RLS POLICIES — attempt_answers
-- ============================================================

DROP POLICY IF EXISTS "attempt_answers_select_own" ON public.attempt_answers;
DROP POLICY IF EXISTS "attempt_answers_insert_own" ON public.attempt_answers;

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

-- ============================================================
-- 13. RLS POLICIES — competitions
-- ============================================================

DROP POLICY IF EXISTS "competitions_select_authenticated" ON public.competitions;
DROP POLICY IF EXISTS "competitions_insert_admin"         ON public.competitions;
DROP POLICY IF EXISTS "competitions_update_admin"         ON public.competitions;

CREATE POLICY "competitions_select_authenticated" ON public.competitions
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "competitions_insert_admin" ON public.competitions
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

CREATE POLICY "competitions_update_admin" ON public.competitions
  FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

-- ============================================================
-- 14. RLS POLICIES — competition_questions
-- ============================================================

DROP POLICY IF EXISTS "competition_questions_select_authenticated" ON public.competition_questions;
DROP POLICY IF EXISTS "competition_questions_insert_admin"         ON public.competition_questions;

CREATE POLICY "competition_questions_select_authenticated" ON public.competition_questions
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "competition_questions_insert_admin" ON public.competition_questions
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

-- ============================================================
-- 15. RLS POLICIES — competition_participants
-- ============================================================

DROP POLICY IF EXISTS "competition_participants_select_authenticated" ON public.competition_participants;
DROP POLICY IF EXISTS "competition_participants_insert_own"           ON public.competition_participants;

CREATE POLICY "competition_participants_select_authenticated" ON public.competition_participants
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "competition_participants_insert_own" ON public.competition_participants
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- 16. RLS POLICIES — question_mastery
-- ============================================================

DROP POLICY IF EXISTS "Users manage own mastery" ON public.question_mastery;

CREATE POLICY "Users manage own mastery" ON public.question_mastery
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- 17. TRIGGER — auto-create profile on new user signup
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name text;
BEGIN
  v_name := NULLIF(trim(COALESCE(NEW.raw_user_meta_data->>'full_name', '')), '');
  IF v_name IS NULL AND NEW.email IS NOT NULL THEN
    v_name := split_part(NEW.email, '@', 1);
  END IF;
  IF v_name IS NULL OR v_name = '' THEN
    v_name := 'User';
  END IF;

  INSERT INTO public.profiles (id, full_name, role)
  VALUES (NEW.id, v_name, 'user')
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE PROCEDURE public.handle_new_user();
