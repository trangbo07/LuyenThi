import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../auth/useAuth';
import { useI18n } from '../i18n/I18nProvider';
import { diffWords } from '../lib/diffHighlight';
import type { Question, QuestionMastery } from '../types/database.types';
import { CheckCircle, XCircle, ChevronRight, ArrowLeft, Trophy, AlertTriangle, BarChart3 } from 'lucide-react';

type PracticeQ = Question & {
  shuffled_options: { label: string; text: string }[];
  mastery?: QuestionMastery;
};

type ConfusingMatch = {
  question: Question;
  sessionCode: string;
};

function normalizeText(input: string) {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function textSimilarity(a: string, b: string) {
  const ta = new Set(normalizeText(a).split(' ').filter(Boolean));
  const tb = new Set(normalizeText(b).split(' ').filter(Boolean));
  if (ta.size === 0 || tb.size === 0) return 0;
  let intersection = 0;
  for (const tok of ta) {
    if (tb.has(tok)) intersection += 1;
  }
  const union = new Set([...ta, ...tb]).size;
  return union ? intersection / union : 0;
}

export default function PracticeSession() {
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useI18n();
  const { user } = useAuth();

  const sessionId: string = location.state?.sessionId || '';
  const subjectId: string = location.state?.subjectId || '';
  const mode: 'all' | 'wrong' | 'confusing' = location.state?.mode || 'all';
  const shuffleQuestions: boolean = location.state?.shuffleQuestions ?? true;
  const shuffleOptions: boolean = location.state?.shuffleOptions ?? true;

  const [questions, setQuestions] = useState<PracticeQ[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<string[]>([]);
  const [answered, setAnswered] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [loading, setLoading] = useState(true);
  const [masteryMap, setMasteryMap] = useState<Record<string, QuestionMastery>>({});
  const [confusingMatches, setConfusingMatches] = useState<ConfusingMatch[]>([]);
  const [allSubjectQuestions, setAllSubjectQuestions] = useState<(Question & { session_code?: string })[]>([]);

  // Load questions + mastery data
  useEffect(() => {
    if (!sessionId || !user?.id) return;
    let cancelled = false;

    (async () => {
      setLoading(true);

      // 1. Load questions for this session
      const { data: qData } = await supabase
        .from('questions')
        .select('*')
        .eq('session_id', sessionId);

      if (cancelled) return;
      const allQuestions = (qData as Question[]) || [];

      // 2. Load mastery for this user + session
      const { data: mData } = await supabase
        .from('question_mastery')
        .select('*')
        .eq('user_id', user.id)
        .eq('session_id', sessionId);

      if (cancelled) return;
      const masteryData = (mData as QuestionMastery[]) || [];
      const mMap: Record<string, QuestionMastery> = {};
      for (const m of masteryData) {
        mMap[m.question_id] = m;
      }
      setMasteryMap(mMap);

      // 3. Filter questions based on mode
      let filtered: Question[];
      if (mode === 'wrong') {
        filtered = allQuestions.filter(q => {
          const m = mMap[q.id];
          return m && (m.last_answer_correct === false || (!m.is_mastered && m.total_attempts > 0));
        });
      } else if (mode === 'confusing') {
        // We'll load all subject questions to find confusing pairs
        filtered = allQuestions; // Start with all, will mark confusing ones
      } else {
        filtered = allQuestions;
      }

      // 4. Shuffle questions
      const orderedQuestions = shuffleQuestions
        ? [...filtered].sort(() => Math.random() - 0.5)
        : filtered;

      // 5. Shuffle options for each question
      const processed: PracticeQ[] = orderedQuestions.map(q => {
        const opts = (q.options || []).map((text, idx) => ({
          label: String.fromCharCode(65 + idx),
          text,
        }));
        const shuffledOpts = shuffleOptions
          ? [...opts].sort(() => Math.random() - 0.5)
          : opts;
        return {
          ...q,
          shuffled_options: shuffledOpts,
          mastery: mMap[q.id],
        };
      });

      setQuestions(processed);

      // 6. Load other session questions from same subject for confusing detection
      if (subjectId) {
        const { data: sessData } = await supabase
          .from('exam_sessions')
          .select('id, code')
          .eq('subject_id', subjectId);

        if (cancelled) return;
        const otherSessionIds = (sessData || [])
          .filter(s => s.id !== sessionId)
          .map(s => s.id);

        const sessionCodeMap: Record<string, string> = {};
        for (const s of sessData || []) {
          sessionCodeMap[s.id] = s.code;
        }

        if (otherSessionIds.length > 0) {
          const { data: otherQ } = await supabase
            .from('questions')
            .select('*')
            .in('session_id', otherSessionIds);

          if (!cancelled) {
            setAllSubjectQuestions(
              ((otherQ as Question[]) || []).map(q => ({
                ...q,
                session_code: sessionCodeMap[q.session_id] || q.session_id,
              }))
            );
          }
        }
      }

      setLoading(false);
    })();

    return () => { cancelled = true; };
  }, [sessionId, subjectId, user?.id, mode, shuffleQuestions, shuffleOptions]);

  // Find confusing matches for current question
  useEffect(() => {
    if (questions.length === 0 || !questions[currentIndex]) {
      setConfusingMatches([]);
      return;
    }
    const current = questions[currentIndex];
    const matches: ConfusingMatch[] = [];

    for (const other of allSubjectQuestions) {
      if (other.id === current.id) continue;
      const sim = textSimilarity(current.question_text, other.question_text);
      if (sim >= 0.35) {
        const correctSigA = [...(current.correct_options || [])].sort().join(',');
        const correctSigB = [...(other.correct_options || [])].sort().join(',');
        if (correctSigA !== correctSigB) {
          matches.push({
            question: other,
            sessionCode: (other as Question & { session_code?: string }).session_code || '',
          });
        }
      }
    }

    setConfusingMatches(matches);
  }, [questions, currentIndex, allSubjectQuestions]);

  const currentQuestion = questions[currentIndex] ?? null;

  const handleSelectAnswer = (label: string) => {
    if (answered) return;
    setSelectedAnswers(prev =>
      prev.includes(label) ? prev.filter(l => l !== label) : [...prev, label]
    );
  };

  const handleSubmitAnswer = async () => {
    if (!currentQuestion || selectedAnswers.length === 0 || !user?.id) return;
    const correct = currentQuestion.correct_options || [];
    const right = selectedAnswers.length === correct.length && selectedAnswers.every(s => correct.includes(s));

    setIsCorrect(right);
    setAnswered(true);

    // Update mastery in database
    const existing = masteryMap[currentQuestion.id];
    if (existing) {
      const newCorrectCount = right ? existing.correct_count + 1 : 0;
      const newIsMastered = newCorrectCount >= 5;
      const update = {
        correct_count: newCorrectCount,
        total_attempts: existing.total_attempts + 1,
        wrong_count: right ? existing.wrong_count : existing.wrong_count + 1,
        is_mastered: newIsMastered,
        last_answer_correct: right,
        last_attempted_at: new Date().toISOString(),
      };
      await supabase
        .from('question_mastery')
        .update(update)
        .eq('id', existing.id);

      setMasteryMap(prev => ({
        ...prev,
        [currentQuestion.id]: { ...existing, ...update },
      }));
    } else {
      const newRow = {
        user_id: user.id,
        question_id: currentQuestion.id,
        session_id: sessionId,
        correct_count: right ? 1 : 0,
        total_attempts: 1,
        wrong_count: right ? 0 : 1,
        is_mastered: false,
        last_answer_correct: right,
        last_attempted_at: new Date().toISOString(),
      };
      const { data } = await supabase
        .from('question_mastery')
        .insert([newRow])
        .select()
        .single();

      if (data) {
        setMasteryMap(prev => ({
          ...prev,
          [currentQuestion.id]: data as QuestionMastery,
        }));
      }
    }
  };

  const handleNext = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setSelectedAnswers([]);
      setAnswered(false);
      setIsCorrect(false);
    }
  };

  const goToQuestion = (idx: number) => {
    setCurrentIndex(idx);
    setSelectedAnswers([]);
    setAnswered(false);
    setIsCorrect(false);
  };

  const masteredCount = useMemo(() => {
    return Object.values(masteryMap).filter(m => m.is_mastered).length;
  }, [masteryMap]);

  const progressPercent = questions.length > 0 ? Math.round((masteredCount / questions.length) * 100) : 0;
  const isLast = currentIndex >= questions.length - 1;

  if (loading) {
    return (
      <div className="card text-center" style={{ padding: '3rem' }}>
        {t('practiceLoading')}
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="card text-center animate-fade-in" style={{ padding: '3rem' }}>
        <h3>{t('practiceNoQuestions')}</h3>
        <p className="text-muted">{t('practiceNoQuestionsHint')}</p>
        <button className="btn btn-primary mt-4" onClick={() => navigate('/practice')}>
          <ArrowLeft size={18} /> {t('practiceBack')}
        </button>
      </div>
    );
  }

  const currentMastery = masteryMap[currentQuestion?.id || ''];
  const masteryCount = currentMastery?.correct_count ?? 0;
  const masteryBars = Array.from({ length: 5 }, (_, i) => i < masteryCount);

  return (
    <div className="animate-fade-in practice-wrapper">
      <div className="practice-shell">
        {/* Header */}
        <div className="glass-card practice-header">
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="flex items-center gap-2" style={{ marginBottom: '0.35rem' }}>
              <button className="btn btn-secondary practice-back-btn" onClick={() => navigate('/practice')} style={{ padding: '0.4rem 0.7rem', borderRadius: '999px' }}>
                <ArrowLeft size={16} />
              </button>
              <h3 className="practice-header-title">{t('practiceSessionTitle')}</h3>
            </div>
            <div className="text-sm" style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>
              <span style={{ color: 'var(--primary-color)', fontWeight: 800 }}>{masteredCount}</span> {t('practiceMasteredOf')} {questions.length} {t('practiceQuestions')}
            </div>
          </div>
          <div className="practice-header-right">
            <button
              className="btn btn-secondary"
              onClick={() => navigate('/practice/progress', { state: { subjectId, sessionId } })}
              style={{ borderRadius: '999px', padding: '0.5rem 0.8rem' }}
            >
              <BarChart3 size={16} /> <span className="hidden sm:inline">{t('practiceProgressBtn')}</span>
            </button>
          </div>
        </div>

        {/* Progress bar */}
        <div style={{ marginBottom: '1.25rem' }}>
          <div className="flex justify-between text-sm" style={{ fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
            <span>{t('practiceMasteryProgress')}</span>
            <span>{progressPercent}%</span>
          </div>
          <div className="progress-track">
            <div className="progress-fill" style={{ width: `${progressPercent}%`, background: progressPercent === 100 ? 'var(--success-color)' : undefined }}></div>
          </div>
        </div>

        {/* Question card */}
        <div className="glass-card practice-question-card">
          <div className="practice-q-badge">
            Q{currentIndex + 1}/{questions.length}
          </div>

          <div className="practice-q-text">
            {currentQuestion.question_text}
          </div>

          {/* Mastery bar */}
          <div className="practice-mastery-bar">
            <span className="practice-mastery-label">{t('practiceMasteryLabel')}</span>
            <div className="practice-mastery-blocks">
              {masteryBars.map((filled, i) => (
                <div key={i} className={`practice-mastery-block ${filled ? 'filled' : ''} ${currentMastery?.is_mastered ? 'mastered' : ''}`} />
              ))}
            </div>
            <span className="practice-mastery-count">{masteryCount}/5</span>
          </div>

          {/* Answer hint */}
          {!answered && (
            <div className="practice-answer-hint">
              {(currentQuestion.correct_options || []).length > 1
                ? t('examSelectAnswers', { count: currentQuestion.correct_options.length })
                : t('examSelectOne')}
            </div>
          )}

          {/* Options */}
          <div className="grid gap-3">
            {currentQuestion.shuffled_options.map((opt, oIdx) => {
              const isSelected = selectedAnswers.includes(opt.label);
              const isActuallyCorrect = (currentQuestion.correct_options || []).includes(opt.label);

              let cardClass = 'practice-option';
              if (!answered) {
                if (isSelected) cardClass += ' selected';
              } else {
                if (isSelected && isActuallyCorrect) cardClass += ' correct';
                else if (isSelected && !isActuallyCorrect) cardClass += ' wrong';
                else if (!isSelected && isActuallyCorrect) cardClass += ' missed';
              }

              return (
                <button
                  key={opt.label}
                  type="button"
                  className={cardClass}
                  onClick={() => handleSelectAnswer(opt.label)}
                  disabled={answered}
                >
                  <span className="practice-option-letter">{String.fromCharCode(65 + oIdx)}.</span>
                  <span className="practice-option-text">{opt.text}</span>
                  {answered && isActuallyCorrect && <CheckCircle size={18} className="practice-option-icon correct" />}
                  {answered && isSelected && !isActuallyCorrect && <XCircle size={18} className="practice-option-icon wrong" />}
                </button>
              );
            })}
          </div>

          {/* Result feedback */}
          {answered && (
            <div className={`practice-feedback ${isCorrect ? 'correct' : 'wrong'}`}>
              {isCorrect ? (
                <>
                  <CheckCircle size={20} />
                  <span>{t('practiceCorrectFeedback')}</span>
                  {currentMastery?.is_mastered && (
                    <span className="practice-feedback-mastered">
                      <Trophy size={16} /> {t('practiceMasteredBadge')}
                    </span>
                  )}
                </>
              ) : (
                <>
                  <XCircle size={20} />
                  <span>{t('practiceWrongFeedback')}</span>
                  <span className="practice-feedback-reset">{t('practiceResetWarning')}</span>
                </>
              )}
            </div>
          )}

          {/* Confusing pairs */}
          {answered && confusingMatches.length > 0 && (
            <div className="practice-confusing-section">
              <div className="practice-confusing-header">
                <AlertTriangle size={18} />
                <span>{t('practiceConfusingAlert')}</span>
              </div>
              {confusingMatches.slice(0, 3).map((match) => {
                const { tokensA, tokensB } = diffWords(
                  currentQuestion.question_text,
                  match.question.question_text
                );
                const correctA = (currentQuestion.correct_options || []).join(', ');
                const correctB = (match.question.correct_options || []).join(', ');
                return (
                  <div key={match.question.id} className="practice-confusing-pair">
                    <div className="practice-confusing-q">
                      <div className="practice-confusing-tag">{t('practiceCurrentSession')}</div>
                      <div className="practice-confusing-text">
                        {tokensA.map((tok, i) => (
                          <span key={i} className={tok.changed ? 'keyword-diff' : ''}>{tok.text}</span>
                        ))}
                      </div>
                      <div className="practice-confusing-answer">
                        {t('resultCorrectAnswer')}: <strong>{correctA}</strong>
                      </div>
                    </div>
                    <div className="practice-confusing-q other">
                      <div className="practice-confusing-tag">{t('practiceOtherSession', { code: match.sessionCode })}</div>
                      <div className="practice-confusing-text">
                        {tokensB.map((tok, i) => (
                          <span key={i} className={tok.changed ? 'keyword-diff' : ''}>{tok.text}</span>
                        ))}
                      </div>
                      <div className="practice-confusing-answer">
                        {t('resultCorrectAnswer')}: <strong>{correctB}</strong>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Action buttons */}
          <div className="practice-actions">
            {!answered ? (
              <button
                className="btn btn-primary practice-submit-btn"
                onClick={handleSubmitAnswer}
                disabled={selectedAnswers.length === 0}
              >
                {t('practiceCheckAnswer')}
              </button>
            ) : isLast ? (
              <button
                className="btn btn-primary practice-submit-btn"
                onClick={() => navigate('/practice/progress', { state: { subjectId, sessionId } })}
              >
                <BarChart3 size={18} /> {t('practiceFinish')}
              </button>
            ) : (
              <button
                className="btn btn-primary practice-submit-btn"
                onClick={handleNext}
              >
                {t('practiceNextQuestion')} <ChevronRight size={18} />
              </button>
            )}
          </div>
        </div>

        {/* Question navigator */}
        <div className="practice-nav-grid">
          {questions.map((q, idx) => {
            const m = masteryMap[q.id];
            let cls = 'practice-nav-item';
            if (idx === currentIndex) cls += ' active';
            if (m?.is_mastered) cls += ' mastered';
            else if (m && m.total_attempts > 0 && m.last_answer_correct === false) cls += ' wrong';
            else if (m && m.total_attempts > 0 && m.correct_count > 0) cls += ' learning';
            return (
              <button key={q.id} type="button" className={cls} onClick={() => goToQuestion(idx)}>
                {idx + 1}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
