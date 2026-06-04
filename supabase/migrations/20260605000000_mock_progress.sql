-- Mock learning progress per user per session
CREATE TABLE IF NOT EXISTS public.mock_progress (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id   uuid NOT NULL REFERENCES public.exam_sessions(id) ON DELETE CASCADE,
  mock_index   integer NOT NULL,
  stars        integer NOT NULL DEFAULT 0 CHECK (stars BETWEEN 0 AND 3),
  best_score   numeric NOT NULL DEFAULT 0,
  attempts     integer NOT NULL DEFAULT 0,
  completed_at timestamptz DEFAULT now(),
  UNIQUE (user_id, session_id, mock_index)
);

ALTER TABLE public.mock_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mock_progress_own" ON public.mock_progress
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
