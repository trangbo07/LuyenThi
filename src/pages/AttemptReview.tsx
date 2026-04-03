import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useI18n } from '../i18n/I18nProvider';

type DbAttempt = {
  id: string;
  subject_id: string;
  total_questions: number;
  correct_answers: number;
  score: number;
};

type DbAttemptAnswer = {
  question_id: string;
  selected_options: string[];
  is_correct: boolean;
};

type DbQuestion = {
  id: string;
  question_text: string;
  options: string[];
  correct_options: string[];
};

export default function AttemptReview() {
  const { t } = useI18n();
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!id) return;

      setLoading(true);

      const { data: attempt, error: attemptErr } = await supabase
        .from('attempts')
        .select('id, subject_id, total_questions, correct_answers, score')
        .eq('id', id)
        .single();

      if (cancelled) return;
      if (attemptErr || !attempt) {
        alert(t('attemptNotFound'));
        navigate('/history');
        return;
      }

      const { data: attemptAnswers, error: aaErr } = await supabase
        .from('attempt_answers')
        .select('question_id, selected_options, is_correct')
        .eq('attempt_id', id);

      if (cancelled) return;
      if (aaErr || !attemptAnswers) {
        alert(t('attemptLoadAnswersError'));
        navigate('/history');
        return;
      }

      const questionIds = Array.from(new Set((attemptAnswers as DbAttemptAnswer[]).map(a => a.question_id)));
      const { data: questions, error: qErr } = await supabase
        .from('questions')
        .select('id, question_text, options, correct_options')
        .in('id', questionIds);

      if (cancelled) return;
      if (qErr || !questions) {
        alert(t('attemptLoadQuestionsError'));
        navigate('/history');
        return;
      }

      const answersMap: Record<string, string[]> = {};
      for (const a of attemptAnswers as DbAttemptAnswer[]) {
        answersMap[a.question_id] = a.selected_options || [];
      }

      // We don't have the original shuffled order stored, so we show options in original A/B/C/D order.
      const processedQuestions = (questions as DbQuestion[]).map(q => ({
        id: q.id,
        question_text: q.question_text,
        correct_options: q.correct_options || [],
        shuffled_options: (q.options || []).map((text, idx) => ({
          label: String.fromCharCode(65 + idx),
          text
        }))
      }));

      // Keep a stable order matching attempt_answers order when possible
      const orderIndex = new Map<string, number>();
      questionIds.forEach((qid, idx) => orderIndex.set(qid, idx));
      processedQuestions.sort((a, b) => (orderIndex.get(a.id) ?? 0) - (orderIndex.get(b.id) ?? 0));

      navigate('/result', {
        replace: true,
        state: {
          questions: processedQuestions,
          answers: answersMap,
          correctCount: (attempt as DbAttempt).correct_answers,
          score: Number((attempt as DbAttempt).score),
          totalCount: (attempt as DbAttempt).total_questions
        }
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [id, navigate, t]);

  return (
    <div className="card text-center" style={{ padding: '3rem' }}>
      {loading ? t('attemptLoadingReview') : t('attemptRedirecting')}
    </div>
  );
}

