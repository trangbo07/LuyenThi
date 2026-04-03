import { useMemo, useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Clock, ChevronLeft, ChevronRight, Send, AlertCircle, LayoutGrid, Bookmark, StickyNote } from 'lucide-react';

type ProcessedQuestion = {
  id: string;
  question_text: string;
  correct_options: string[];
  shuffled_options: { label: string; text: string }[];
};

export default function ExamSession() {
  const location = useLocation();
  const navigate = useNavigate();
  
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
      alert('You already completed this battle room. One attempt per person.');
      navigate(`/battle/${battleCode}/ranking`, { replace: true });
    })();
    return () => {
      cancelled = true;
    };
  }, [competitionId, battleCode, questions.length, navigate]);

  useEffect(() => {
    if (questions.length === 0 || submitting) return;
    
    if (timeLeft <= 0) {
      alert('Time is up! Submitting automatically.');
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
      const shouldRestore = window.confirm('Found a saved draft for this exam. Restore it?');
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
        <h2>No Active Exam</h2>
        <p className="text-muted mb-4">Please generate an exam session first.</p>
        <button onClick={() => navigate('/generate')} className="btn btn-primary">Go to Generator</button>
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
    if (!autoSubmit && !confirm('Submit your answers now?')) return;
    
    setSubmitting(true);

    const { data: userData, error: userErr } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    if (userErr || !userId) {
      alert('You must be signed in to submit.');
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
        alert('You already submitted for this battle room. One attempt per person.');
        if (battleCode) navigate(`/battle/${battleCode}/ranking`, { replace: true });
        else navigate('/history', { replace: true });
      } else {
        alert('Error saving attempt: ' + msg);
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
    <div className="animate-fade-in exam-wrapper" style={{ margin: '-2rem -1.5rem 0', padding: '2rem 1.5rem 2rem', minHeight: 'calc(100vh - 60px)' }}>
      <div className="exam-shell" style={{ maxWidth: '1100px', margin: '0 auto' }}>
        
        {/* Header */}
        <div className="glass-card sticky z-10 mb-5 flex justify-between items-center" style={{ top: '1rem', padding: '1rem 1.25rem' }}>
          <div style={{ minWidth: 0 }}>
            <h3 className="mb-1" style={{ fontSize: '1.2rem', background: 'linear-gradient(90deg, #0f766e, #f59e0b)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              Taking exam
            </h3>
            <div className="text-sm" style={{ fontWeight: 500, color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
              <span style={{ color: 'var(--primary-color)', fontWeight: 800 }}>{answeredCount}</span> answered • <span style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{unansweredCount}</span> unanswered
            </div>
            <div className="text-sm" style={{ fontWeight: 500, color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
              <span style={{ color: '#b45309', fontWeight: 800 }}>{markedCount}</span> marked for review
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              className="btn btn-secondary exam-nav-toggle"
              onClick={() => setNavOpen(v => !v)}
              type="button"
              style={{ padding: '0.6rem 0.9rem', borderRadius: '999px' }}
              title="Open question navigator"
            >
              <LayoutGrid size={18} />
              <span className="hidden sm:inline">Questions</span>
            </button>

            <div className="flex items-center gap-2" style={{ fontWeight: 800, fontSize: '1.4rem' }}>
              <Clock size={26} className={isTimeCritical ? 'text-danger-pulse' : ''} style={{ color: isTimeCritical ? 'inherit' : 'var(--primary-color)' }} />
              <span className={isTimeCritical ? 'text-danger-pulse' : ''} style={{ fontVariantNumeric: 'tabular-nums', color: isTimeCritical ? 'inherit' : 'var(--text-primary)' }}>
                {formatTime(timeLeft)}
              </span>
            </div>
          </div>
        </div>

        {/* Progress */}
        <div className="mb-5">
          <div className="flex justify-between text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
            <span>Progress</span>
            <span>{Math.round(progressPercent)}%</span>
          </div>
          <div className="progress-track">
            <div className="progress-fill" style={{ width: `${progressPercent}%` }}></div>
          </div>
        </div>

        <div className="glass-card exam-action-bar mb-5">
          <div className="exam-action-row">
            <button
              onClick={goPrev}
              disabled={currentIndex === 0}
              className="btn btn-secondary flex items-center gap-2"
              style={{ borderRadius: '99px', opacity: currentIndex === 0 ? 0.5 : 1 }}
            >
              <ChevronLeft size={18} /> <span className="hidden sm:inline">Previous</span>
            </button>

            <div className="exam-action-meta text-sm">
              Question <strong>{currentIndex + 1}</strong> / {questions.length}
            </div>

            <button
              onClick={goNext}
              disabled={currentIndex === questions.length - 1}
              className="btn btn-primary flex items-center gap-2"
              style={{ borderRadius: '99px', opacity: currentIndex === questions.length - 1 ? 0.5 : 1 }}
            >
              <span className="hidden sm:inline">Next</span> <ChevronRight size={18} />
            </button>

            <button
              onClick={() => handleSubmit()}
              disabled={submitting}
              className="btn exam-submit-btn flex items-center gap-2"
              style={{ borderRadius: '99px' }}
            >
              {submitting ? 'Submitting...' : 'Submit'} <Send size={18} />
            </button>
          </div>
        </div>

        <div className="exam-grid">
          {/* Question Card */}
          <div className="glass-card p-8 mb-6 relative exam-main">
            <div className="absolute top-0 right-0 py-1 px-4 text-sm" style={{ background: 'var(--primary-color)', color: 'white', borderBottomLeftRadius: 'var(--radius-lg)', borderTopRightRadius: 'var(--radius-xl)', fontWeight: 700 }}>
              Q{currentIndex + 1}/{questions.length}
            </div>
            
            <div className="mb-7 mt-2">
              <h4 style={{ lineHeight: '1.7', fontSize: '1.25rem', color: 'var(--text-primary)' }}>
                {currentQuestion.question_text}
              </h4>
            </div>
            
            <div className="mb-6 inline-flex items-center gap-2" style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', padding: '0.4rem 1rem', borderRadius: '99px', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.9rem' }}>
              <AlertCircle size={18} style={{ color: 'var(--primary-color)' }} />
              {currentQuestion.correct_options.length > 1 
                  ? `Select ${currentQuestion.correct_options.length} answers` 
                  : 'Select 1 answer'}
            </div>

            <div className="mb-6">
              <button
                type="button"
                className={`btn btn-secondary ${markedForReview[currentQuestion.id] ? 'result-filter active' : ''}`}
                style={{ borderRadius: '999px' }}
                onClick={() => toggleReviewMark(currentQuestion.id)}
              >
                <Bookmark size={16} /> {markedForReview[currentQuestion.id] ? 'Marked for review' : 'Mark for review'}
              </button>
            </div>

            {/* Mobile quick navigator */}
            <div className="exam-qchips mb-6">
              {questions.map((q, idx) => {
                const isAnswered = (answers[q.id] || []).length > 0;
                const isActive = idx === currentIndex;
                return (
                  <button
                    key={q.id}
                    type="button"
                    className={`exam-qchip ${isActive ? 'active' : ''} ${isAnswered ? 'answered' : ''} ${markedForReview[q.id] ? 'marked' : ''}`}
                    onClick={() => goToQuestion(idx)}
                    title={isAnswered ? 'Answered' : 'Unanswered'}
                  >
                    {idx + 1}
                  </button>
                );
              })}
            </div>

            <div className="grid gap-4">
              {currentQuestion.shuffled_options.map((opt, oIdx) => {
                const isSelected = (answers[currentQuestion.id] || []).includes(opt.label);
                return (
                  <label 
                    key={opt.label} 
                    className={`option-card flex items-start p-4 ${isSelected ? 'selected' : ''}`}
                  >
                      <input
                        type="checkbox"
                        className="sr-only"
                        checked={isSelected}
                        onChange={() => toggleAnswer(currentQuestion.id, opt.label)}
                      />
                      <span className="option-check" aria-hidden="true" />
                      <div style={{ lineHeight: '1.6' }}>
                        <span style={{ fontWeight: 800, color: isSelected ? 'var(--primary-color)' : 'var(--text-secondary)', marginRight: '0.75rem', fontSize: '1.1rem' }}>
                          {String.fromCharCode(65 + oIdx)}.
                        </span>
                        <span style={{ fontSize: '1.05rem', color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)', fontWeight: isSelected ? 550 : 420 }}>
                          {opt.text}
                        </span>
                      </div>
                  </label>
                );
              })}
            </div>

            <div className="mt-6">
              <label className="profile-label" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                <StickyNote size={16} /> Personal note for this question
              </label>
              <textarea
                className="exam-note-area"
                value={notes[currentQuestion.id] || ''}
                onChange={(e) => setNotes((prev) => ({ ...prev, [currentQuestion.id]: e.target.value }))}
                placeholder="Write your own reminder, hint, or formula here..."
                rows={3}
              />
            </div>
          </div>

          {/* Desktop navigator */}
          <aside className={`glass-card exam-nav ${navOpen ? 'open' : ''}`}>
            <div className="flex justify-between items-center mb-4">
              <div style={{ fontWeight: 800, color: 'var(--text-primary)' }}>Questions</div>
              <button className="btn btn-secondary exam-nav-close" type="button" onClick={() => setNavOpen(false)} style={{ padding: '0.4rem 0.7rem', borderRadius: '999px' }}>
                Close
              </button>
            </div>

            <div className="text-sm mb-3" style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>
              <span style={{ color: 'var(--primary-color)', fontWeight: 900 }}>{answeredCount}</span> answered • {unansweredCount} unanswered
            </div>

            <div className="text-sm mb-3" style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>
              <span style={{ color: '#b45309', fontWeight: 900 }}>{markedCount}</span> marked for review
            </div>

            <div className="exam-nav-grid">
              {questions.map((q, idx) => {
                const isAnswered = (answers[q.id] || []).length > 0;
                const isActive = idx === currentIndex;
                return (
                  <button
                    key={q.id}
                    type="button"
                    className={`exam-nav-item ${isActive ? 'active' : ''} ${isAnswered ? 'answered' : ''} ${markedForReview[q.id] ? 'marked' : ''}`}
                    onClick={() => goToQuestion(idx)}
                    title={isAnswered ? 'Answered' : 'Unanswered'}
                  >
                    {idx + 1}
                  </button>
                );
              })}
            </div>

            <div className="mt-4">
              <div className="text-sm" style={{ color: 'var(--text-secondary)', lineHeight: 1.4, fontWeight: 600 }}>
                Tip: tap a number to jump to that question. Submit is in the bottom bar.
              </div>
            </div>
          </aside>
        </div>

      </div>
    </div>
  );
}
