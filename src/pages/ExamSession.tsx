import { useMemo, useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Clock, ChevronLeft, ChevronRight, Send, AlertCircle, LayoutGrid, Bookmark, StickyNote } from 'lucide-react';
import { useI18n } from '../i18n/I18nProvider';
import { useToast } from '../components/Toast';

type ProcessedQuestion = {
  id: string;
  question_text: string;
  correct_options: string[];
  shuffled_options: { label: string; text: string }[];
};

export default function ExamSession() {
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useI18n();
  const { toast } = useToast();
  
  const questions: ProcessedQuestion[] = location.state?.questions || [];
  const subjectId: string = location.state?.subjectId || '';
  const timeLimit: number = location.state?.timeLimit || 60;
  const competitionId: string | null = location.state?.competitionId || null;
  const battleCode: string | undefined = location.state?.battleCode;

  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [submitting, setSubmitting] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState(timeLimit * 60);
  const [navOpen, setNavOpen] = useState(false);
  const [startedAt] = useState(() => Date.now());
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [markedForReview, setMarkedForReview] = useState<Record<string, boolean>>({});
  const [draftLoaded, setDraftLoaded] = useState(false);

  const draftKey = useMemo(() => {
    const id = competitionId || `subject-${subjectId || 'unknown'}-q${questions.length}`;
    return `exam_draft_${id}`;
  }, [competitionId, subjectId, questions.length]);

  // Battle: block retake if an attempt already exists (one per user)
  useEffect(() => {
    if (!competitionId || !battleCode || questions.length === 0) return;
    let cancelled = false;
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      const uid = u.user?.id;
      if (!uid) return;
      const { data: existing } = await supabase
        .from('attempts')
        .select('id')
        .eq('competition_id', competitionId)
        .eq('user_id', uid)
        .maybeSingle();
      if (cancelled || !existing) return;
      toast(t('battleAlreadyPlayed'), 'warning');
      navigate(`/battle/${battleCode}/ranking`, { replace: true });
    })();
    return () => {
      cancelled = true;
    };
  }, [competitionId, battleCode, questions.length, navigate, t]);

  useEffect(() => {
    if (questions.length === 0 || submitting) return;
    
    if (timeLeft <= 0) {
        toast(t('examTimeUp'), 'warning');
      handleSubmit(true);
      return;
    }
    
    const timerId = setInterval(() => {
      setTimeLeft(prev => prev - 1);
    }, 1000);
    
    return () => clearInterval(timerId);
  }, [timeLeft, submitting, questions.length]);

  useEffect(() => {
    if (questions.length === 0 || draftLoaded) return;
    setDraftLoaded(true);
    try {
      const raw = localStorage.getItem(draftKey);
      if (!raw) return;
      const draft = JSON.parse(raw) as {
        answers?: Record<string, string[]>;
        currentIndex?: number;
        timeLeft?: number;
        notes?: Record<string, string>;
        markedForReview?: Record<string, boolean>;
      };
      const shouldRestore = window.confirm(t('examDraftFound'));
      if (!shouldRestore) return;

      if (draft.answers) setAnswers(draft.answers);
      if (typeof draft.currentIndex === 'number') {
        setCurrentIndex(Math.min(Math.max(0, draft.currentIndex), Math.max(0, questions.length - 1)));
      }
      if (typeof draft.timeLeft === 'number' && draft.timeLeft > 0) setTimeLeft(draft.timeLeft);
      if (draft.notes) setNotes(draft.notes);
      if (draft.markedForReview) setMarkedForReview(draft.markedForReview);
    } catch {
      localStorage.removeItem(draftKey);
    }
  }, [questions.length, draftLoaded, draftKey]);

  useEffect(() => {
    if (questions.length === 0 || submitting) return;
    const payload = {
      answers,
      currentIndex,
      timeLeft,
      notes,
      markedForReview,
      savedAt: Date.now()
    };
    localStorage.setItem(draftKey, JSON.stringify(payload));
  }, [answers, currentIndex, timeLeft, notes, markedForReview, questions.length, submitting, draftKey]);

  if (questions.length === 0) {
    return (
      <div className="card text-center" style={{ padding: '4rem' }}>
        <h2>{t('examNoActive')}</h2>
        <p className="text-muted mb-4">{t('examNoActiveHint')}</p>
        <button onClick={() => navigate('/generate')} className="btn btn-primary">{t('examGoGenerator')}</button>
      </div>
    );
  }

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const toggleAnswer = (qId: string, label: string) => {
    setAnswers(prev => {
      const current = prev[qId] || [];
      const updated = current.includes(label) 
        ? current.filter(l => l !== label) 
        : [...current, label];
      return { ...prev, [qId]: updated };
    });
  };

  const toggleReviewMark = (qId: string) => {
    setMarkedForReview((prev) => ({ ...prev, [qId]: !prev[qId] }));
  };

  const handleSubmit = async (autoSubmit = false) => {
    if (!autoSubmit && !confirm(t('examSubmitConfirm'))) return;
    
    setSubmitting(true);

    const { data: userData, error: userErr } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    if (userErr || !userId) {
      toast(t('examNeedSignIn'), 'error');
      setSubmitting(false);
      return;
    }

    let correctCount = 0;
    const answerRecords = questions.map(q => {
      const selected = answers[q.id] || [];
      const correct = q.correct_options || [];
      
      const isCorrect = selected.length > 0 && selected.length === correct.length && selected.every(s => correct.includes(s));
      
      if (isCorrect) correctCount++;

      return {
        question_id: q.id,
        selected_options: selected,
        is_correct: isCorrect
      };
    });

    const score = parseFloat(((correctCount / questions.length) * 10).toFixed(2));
    const timeSpentSeconds = Math.max(0, Math.round((Date.now() - startedAt) / 1000));

    const { data: attemptData, error: attemptError } = await supabase
      .from('attempts')
      .insert([{
        user_id: userId,
        subject_id: subjectId,
        total_questions: questions.length,
        correct_answers: correctCount,
        score: score,
        competition_id: competitionId,
        time_spent_seconds: timeSpentSeconds
      }])
      .select('id')
      .single();

    if (attemptError || !attemptData) {
      const code = (attemptError as { code?: string })?.code;
      const msg = attemptError?.message || '';
      if (code === '23505' || msg.includes('duplicate') || msg.includes('unique')) {
        toast(t('examDuplicateBattle'), 'warning');
        if (battleCode) navigate(`/battle/${battleCode}/ranking`, { replace: true });
        else navigate('/history', { replace: true });
      } else {
        toast(t('examSaveAttemptError', { message: msg }), 'error');
      }
      setSubmitting(false);
      return;
    }

    const answersToInsert = answerRecords.map(r => ({
      ...r,
      attempt_id: attemptData.id
    }));

    await supabase.from('attempt_answers').insert(answersToInsert);
    localStorage.removeItem(draftKey);

    navigate('/result', {
      state: {
        questions,
        answers,
        correctCount,
        score,
        totalCount: questions.length,
        battleCode: battleCode || undefined
      }
    });
  };

  const currentQuestion = questions[currentIndex];
  const answeredCount = useMemo(() => Object.keys(answers).filter(k => (answers[k] || []).length > 0).length, [answers]);
  const progressPercent = (answeredCount / questions.length) * 100;
  const isTimeCritical = timeLeft < 300; // Less than 5 mins
  const unansweredCount = questions.length - answeredCount;
  const markedCount = useMemo(() => Object.keys(markedForReview).filter((k) => markedForReview[k]).length, [markedForReview]);

  useEffect(() => {
    const warnBeforeClose = (e: BeforeUnloadEvent) => {
      if (submitting || questions.length === 0) return;
      if (answeredCount === 0) return;
      e.preventDefault();
      e.returnValue = '';
    };

    window.addEventListener('beforeunload', warnBeforeClose);
    return () => window.removeEventListener('beforeunload', warnBeforeClose);
  }, [submitting, questions.length, answeredCount]);

  const goToQuestion = (idx: number) => {
    setCurrentIndex(Math.min(Math.max(0, idx), questions.length - 1));
    setNavOpen(false);
  };

  const goPrev = () => {
    setCurrentIndex((prev) => Math.max(0, prev - 1));
  };

  const goNext = () => {
    setCurrentIndex((prev) => Math.min(questions.length - 1, prev + 1));
  };

  return (
    <div className="animate-fade-in exam-session-container">
      {/* HEADER BAR */}
      <header className="exam-header-glass">
        <div className="exam-header-left">
          <h1 className="exam-title text-truncate">{t('examTitle')}</h1>
          <div className="exam-stats-pill">
            <span className="stat-answered">{answeredCount}</span> {t('examAnswered')}
            <span className="stat-divider">•</span>
            <span className="stat-unanswered">{unansweredCount}</span> {t('examUnanswered')}
            <span className="stat-divider">•</span>
            <span className="stat-marked">{markedCount}</span> {t('examMarkedReview')}
          </div>
        </div>

        <div className="exam-header-right">
          <div className={`exam-timer ${isTimeCritical ? 'critical' : ''}`}>
             <Clock size={22} className="timer-icon" />
             <span className="timer-text">{formatTime(timeLeft)}</span>
          </div>

          <button
            className="btn btn-secondary exam-nav-btn desktop-hidden"
            onClick={() => setNavOpen(v => !v)}
            title={t('examOpenNavigator')}
          >
            <LayoutGrid size={20} />
          </button>
        </div>
      </header>

      {/* MOBILE PROGRESS */}
      <div className="exam-mobile-progress desktop-hidden">
        <div className="flex justify-between text-xs font-bold text-muted mb-1">
          <span>{t('examProgress')}</span>
          <span>{Math.round(progressPercent)}%</span>
        </div>
        <div className="progress-track">
          <div className="progress-fill" style={{ width: `${progressPercent}%` }} />
        </div>
      </div>

      <div className="exam-main-grid">
        
        {/* LEFT COLUMN: QUESTION */}
        <div className="exam-question-column">
           {/* ACTION BAR TOP */}
           <div className="exam-action-bar">
             <button
               onClick={goPrev}
               disabled={currentIndex === 0}
               className="btn btn-outline action-prev"
             >
               <ChevronLeft size={20} /> <span className="action-text">{t('examPrevious')}</span>
             </button>

             <div className="exam-current-badge">
               Q{currentIndex + 1} <span className="exam-total-badge">/ {questions.length}</span>
             </div>

             <button
               onClick={goNext}
               disabled={currentIndex === questions.length - 1}
               className="btn btn-outline action-next"
             >
               <span className="action-text">{t('examNext')}</span> <ChevronRight size={20} />
             </button>
           </div>

           {/* QUESTION CARD */}
           <div className="exam-question-card">
              <div className="question-text-content">
                {currentQuestion.question_text}
              </div>

              <div className="question-instruction">
                <AlertCircle size={18} className="instruction-icon" />
                <span>
                  {currentQuestion.correct_options.length > 1 
                      ? t('examSelectAnswers', { count: currentQuestion.correct_options.length })
                      : t('examSelectOne')}
                </span>
              </div>

              <div className="question-options">
                {currentQuestion.shuffled_options.map((opt, oIdx) => {
                  const isSelected = (answers[currentQuestion.id] || []).includes(opt.label);
                  return (
                    <label 
                      key={opt.label} 
                      className={`exam-option ${isSelected ? 'selected' : ''}`}
                    >
                        <input
                          type="checkbox"
                          className="sr-only"
                          checked={isSelected}
                          onChange={() => toggleAnswer(currentQuestion.id, opt.label)}
                        />
                        <div className="exam-option-indicator" />
                        <div className="exam-option-content">
                          <span className="exam-option-letter">{String.fromCharCode(65 + oIdx)}.</span>
                          <span className="exam-option-text">{opt.text}</span>
                        </div>
                    </label>
                  );
                })}
              </div>
           </div>

           {/* TOOLBAR BOTTOM */}
           <div className="exam-toolbar-bottom">
             <button
                type="button"
                className={`btn btn-secondary toolbar-mark-btn ${markedForReview[currentQuestion.id] ? 'active' : ''}`}
                onClick={() => toggleReviewMark(currentQuestion.id)}
              >
                <Bookmark size={18} /> 
                <span className="toolbar-text">{markedForReview[currentQuestion.id] ? t('examMarkedForReview') : t('examMarkForReview')}</span>
              </button>

              <button
                onClick={() => handleSubmit()}
                disabled={submitting}
                className="btn btn-primary toolbar-submit-btn"
              >
                <span className="toolbar-text">{submitting ? t('examSubmitting') : t('examSubmit')}</span>
                <Send size={18} />
              </button>
           </div>

           {/* NOTES SECTION */}
           <div className="exam-notes-section">
             <label className="notes-label">
                <StickyNote size={18} /> {t('examNoteTitle')}
             </label>
             <textarea
                className="notes-textarea"
                value={notes[currentQuestion.id] || ''}
                onChange={(e) => setNotes((prev) => ({ ...prev, [currentQuestion.id]: e.target.value }))}
                placeholder={t('examNotePlaceholder')}
                rows={3}
             />
           </div>
        </div>

        {/* RIGHT COLUMN: NAVIGATOR */}
        <aside className={`exam-sidebar ${navOpen ? 'open' : ''}`}>
           <div className="sidebar-header">
             <h3 className="sidebar-title">{t('examQuestions')}</h3>
             <button className="btn btn-secondary btn-icon-only nav-close-btn desktop-hidden" onClick={() => setNavOpen(false)}>
               &times;
             </button>
           </div>
           
           {/* Desktop Progress */}
           <div className="sidebar-progress mobile-hidden">
             <div className="flex justify-between text-xs font-bold text-muted mb-1">
               <span>{t('examProgress')}</span>
               <span>{Math.round(progressPercent)}%</span>
             </div>
             <div className="progress-track" style={{ height: '6px' }}>
               <div className="progress-fill" style={{ width: `${progressPercent}%` }} />
             </div>
           </div>

           <div className="sidebar-grid">
              {questions.map((q, idx) => {
                const isAnswered = (answers[q.id] || []).length > 0;
                const isActive = idx === currentIndex;
                const isMarked = markedForReview[q.id];
                let btnClass = 'grid-item';
                if (isActive) btnClass += ' active';
                if (isAnswered) btnClass += ' answered';
                if (isMarked) btnClass += ' marked';

                return (
                  <button
                    key={q.id}
                    className={btnClass}
                    onClick={() => goToQuestion(idx)}
                    title={isAnswered ? t('examAnsweredTitle') : t('examUnansweredTitle')}
                  >
                    {idx + 1}
                  </button>
                );
              })}
           </div>

           <div className="sidebar-footer">
              {t('examTip')}
           </div>
        </aside>

        {/* OVERLAY FOR MOBILE SIDEBAR */}
        {navOpen && <div className="exam-sidebar-overlay desktop-hidden" onClick={() => setNavOpen(false)} />}
      </div>
    </div>
  );
}
