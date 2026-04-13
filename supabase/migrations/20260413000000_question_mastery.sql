-- Practice Mode: question mastery tracking per user per question
CREATE TABLE IF NOT EXISTS question_mastery (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  question_id uuid REFERENCES questions(id) ON DELETE CASCADE,
  session_id uuid REFERENCES exam_sessions(id) ON DELETE CASCADE,
  correct_count integer NOT NULL DEFAULT 0,
  total_attempts integer NOT NULL DEFAULT 0,
  wrong_count integer NOT NULL DEFAULT 0,
  is_mastered boolean NOT NULL DEFAULT false,
  last_answer_correct boolean,
  last_attempted_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT timezone('utc', now()) NOT NULL,
  UNIQUE (user_id, question_id)
);

-- RLS
ALTER TABLE question_mastery ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own mastery"
  ON question_mastery FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
