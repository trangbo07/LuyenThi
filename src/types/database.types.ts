export type Subject = {
  id: string;
  code: string;
  name: string;
  created_at?: string;
};

export type ExamSession = {
  id: string;
  subject_id: string;
  code: string;
  name: string;
  created_at?: string;
};

export type Question = {
  id: string;
  session_id: string;
  question_text: string;
  options: string[];
  correct_options: string[];
  created_at?: string;
};

export type Attempt = {
  id: string;
  user_id?: string;
  subject_id: string;
  competition_id?: string | null;
  total_questions: number;
  correct_answers: number;
  score: number;
  time_spent_seconds?: number | null;
  created_at?: string;
};

export type AttemptAnswer = {
  id: string;
  attempt_id: string;
  question_id: string;
  selected_options: string[];
  is_correct: boolean;
  created_at?: string;
};

export type Profile = {
  id: string;
  full_name: string;
  role: 'admin' | 'user';
  created_at?: string;
};

export type Competition = {
  id: string;
  code: string;
  created_by?: string | null;
  subject_id?: string | null;
  time_limit_minutes: number;
  status: 'open' | 'closed';
  created_at?: string;
};

export type QuestionMastery = {
  id: string;
  user_id: string;
  question_id: string;
  session_id: string;
  correct_count: number;
  total_attempts: number;
  wrong_count: number;
  is_mastered: boolean;
  last_answer_correct: boolean | null;
  last_attempted_at?: string;
  created_at?: string;
};
