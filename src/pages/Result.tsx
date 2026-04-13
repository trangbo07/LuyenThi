import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Target, CheckCircle, XCircle, ListFilter, LayoutGrid, ArrowLeft, Trophy, Star } from 'lucide-react';
import PaginationControls from '../components/PaginationControls';
import { useI18n } from '../i18n/I18nProvider';
import confetti from 'canvas-confetti';

type ReviewQuestion = {
  id: string;
  question_text: string;
  correct_options: string[];
  shuffled_options: { label: string; text: string }[];
};

export default function Result() {
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useI18n();
  
  const { questions, answers, score, correctCount, totalCount, battleCode } = location.state || {};
  const reviewQuestions: ReviewQuestion[] = questions || [];
  const reviewAnswers: Record<string, string[]> = answers || {};
  const [filter, setFilter] = useState<'all' | 'correct' | 'wrong' | 'unanswered'>('all');
  const [navOpen, setNavOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  
  const [showCelebration, setShowCelebration] = useState(false);

  const isPassing = score >= 5.0;

  useEffect(() => {
    if (isPassing && questions) {
      setShowCelebration(true);
      
      const duration = 3000;
      const end = Date.now() + duration;

      const frame = () => {
        confetti({
          particleCount: 5,
          angle: 60,
          spread: 55,
          origin: { x: 0 },
          colors: ['#10b981', '#3b82f6', '#fbbf24']
        });
        confetti({
          particleCount: 5,
          angle: 120,
          spread: 55,
          origin: { x: 1 },
          colors: ['#10b981', '#3b82f6', '#fbbf24']
        });

        if (Date.now() < end) {
          requestAnimationFrame(frame);
        }
      };
      
      frame();
    }
  }, [isPassing, questions]);

  if (!questions) {
    return (
      <div className="card text-center" style={{ padding: '4rem' }}>
        <h2>{t('resultNoData')}</h2>
        <button onClick={() => navigate('/')} className="btn btn-primary mt-4">{t('resultGoHome')}</button>
      </div>
    );
  }

  const perQuestion = useMemo(() => {
    return reviewQuestions.map((q, idx) => {
      const selected = reviewAnswers[q.id] || [];
      const correct = q.correct_options || [];
      const isAnswered = selected.length > 0;
      const isCorrect = isAnswered && selected.length === correct.length && selected.every(s => correct.includes(s));
      return { q, idx, selected, correct, isAnswered, isCorrect };
    });
  }, [reviewQuestions, reviewAnswers]);

  const counts = useMemo(() => {
    let correct = 0;
    let wrong = 0;
    let unanswered = 0;
    for (const row of perQuestion) {
      if (!row.isAnswered) unanswered++;
      else if (row.isCorrect) correct++;
      else wrong++;
    }
    return { correct, wrong, unanswered, total: perQuestion.length };
  }, [perQuestion]);

  const filtered = useMemo(() => {
    if (filter === 'all') return perQuestion;
    if (filter === 'correct') return perQuestion.filter(r => r.isCorrect);
    if (filter === 'wrong') return perQuestion.filter(r => r.isAnswered && !r.isCorrect);
    return perQuestion.filter(r => !r.isAnswered);
  }, [perQuestion, filter]);

  useEffect(() => {
    setPage(1);
  }, [filter]);

  const pagedFiltered = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);

  const goToId = (id: string) => {
    const el = document.getElementById(`rq-${id}`);
    if (el) {
      const y = el.getBoundingClientRect().top + window.scrollY - 100;
      window.scrollTo({ top: y, behavior: 'smooth' });
    }
    setNavOpen(false);
  };

  return (
    <div className="animate-fade-in result-shell" style={{ maxWidth: '1100px', margin: '0 auto' }}>
      
      {/* Celebration Banner for High Scores */}
      {showCelebration && (
         <div className="celebration-banner">
           <Star color="#fbbf24" fill="#fbbf24" size={24} />
           <div>
             <strong>Outstanding Performance!</strong> You passed the exam with flying colors.
           </div>
         </div>
      )}

      {/* Main Score Dashboard */}
      <div className="result-dashboard mb-6">
        <div className="result-header">
          <div className="flex items-center gap-4">
             <div className="result-icon-wrapper" style={{ background: isPassing ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)' }}>
               <Target size={32} color={isPassing ? 'var(--success-color)' : 'var(--error-color)'} />
             </div>
             <div>
               <h1 className="result-title">{t('resultComplete')}</h1>
               <div className="result-subtitle">{t('resultDetail')}</div>
             </div>
          </div>
          
          <div className="result-actions">
            {typeof battleCode === 'string' && battleCode.length > 0 && (
              <button
                className="btn btn-primary btn-round"
                onClick={() => navigate(`/battle/${battleCode}/ranking`)}
              >
                <Trophy size={18} /> {t('resultRoomRanking')}
              </button>
            )}
            <button className="btn btn-secondary btn-round" onClick={() => navigate('/')}>
              <ArrowLeft size={18} /> {t('resultHome')}
            </button>
            <button className="btn btn-secondary btn-round" onClick={() => setNavOpen(v => !v)}>
              <LayoutGrid size={18} /> {t('resultQuestions')}
            </button>
          </div>
        </div>

        <div className="result-stats-container">
           {/* Left Score Card */}
           <div className={`result-score-block ${isPassing ? 'passing' : 'failing'}`}>
              <div className="score-label">{t('resultScore')}</div>
              <div className="score-value">
                {Number(score).toFixed(2)}
                <span className="score-denominator">/ 10</span>
              </div>
              <div className="score-status">
                 {isPassing ? t('resultPass') : t('resultFail')} • {t('resultCorrect')} {correctCount}/{totalCount}
              </div>
           </div>

           {/* Right Breakdown Card */}
           <div className="result-breakdown-block">
              <div className="breakdown-header">
                <div>{t('resultSummary')}</div>
                <div className="breakdown-total text-sm">{counts.total} {t('resultQuestions')}</div>
              </div>
              
              <div className="breakdown-bars">
                 <div className="breakdown-bar-wrap w-full">
                    <div className="breakdown-bar-fill correct" style={{ width: `${(counts.correct / Math.max(1, counts.total)) * 100}%` }} />
                    <div className="breakdown-bar-fill wrong" style={{ width: `${(counts.wrong / Math.max(1, counts.total)) * 100}%` }} />
                    <div className="breakdown-bar-fill skipped" style={{ width: `${(counts.unanswered / Math.max(1, counts.total)) * 100}%` }} />
                 </div>
              </div>

              <div className="breakdown-legend">
                 <div className="legend-item"><div className="legend-dot correct" /> {counts.correct} {t('resultCorrect')}</div>
                 <div className="legend-item"><div className="legend-dot wrong" /> {counts.wrong} {t('resultWrong')}</div>
                 <div className="legend-item"><div className="legend-dot skipped" /> {counts.unanswered} {t('resultSkipped')}</div>
              </div>
           </div>
        </div>
      </div>

      <div className="glass-card mb-5 result-filters-wrap">
        <div style={{ fontWeight: 950, color: 'var(--text-primary)', fontSize: '1.05rem', marginBottom: '1rem' }}>{t('resultAnswerReview')}</div>
        <div className="result-filter-buttons">
          <button className={`btn btn-secondary result-filter ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}>
            <ListFilter size={16} /> {t('resultAll')} <span className="badge">{counts.total}</span>
          </button>
          <button className={`btn btn-secondary result-filter ${filter === 'correct' ? 'active' : ''}`} onClick={() => setFilter('correct')}>
            <CheckCircle size={16} color="var(--success-color)" /> {t('resultCorrect')} <span className="badge">{counts.correct}</span>
          </button>
          <button className={`btn btn-secondary result-filter ${filter === 'wrong' ? 'active' : ''}`} onClick={() => setFilter('wrong')}>
            <XCircle size={16} color="var(--error-color)" /> {t('resultWrong')} <span className="badge">{counts.wrong}</span>
          </button>
          <button className={`btn btn-secondary result-filter ${filter === 'unanswered' ? 'active' : ''}`} onClick={() => setFilter('unanswered')}>
            {t('resultSkipped')} <span className="badge">{counts.unanswered}</span>
          </button>
        </div>
      </div>

      <aside className={`glass-card result-nav ${navOpen ? 'open' : ''}`}>
        <div className="flex justify-between items-center mb-4">
          <div style={{ fontWeight: 950, color: 'var(--text-primary)' }}>{t('resultQuestions')}</div>
          <button className="btn btn-secondary flex items-center justify-center" type="button" onClick={() => setNavOpen(false)} style={{ width: '32px', height: '32px', borderRadius: '50%', padding: '0' }}>
            &times;
          </button>
        </div>
        <div className="result-nav-grid">
          {perQuestion.map(({ q, idx, isAnswered, isCorrect }) => (
            <button
              key={q.id}
              type="button"
              className={`result-nav-item ${isCorrect ? 'correct' : ''} ${isAnswered && !isCorrect ? 'wrong' : ''} ${!isAnswered ? 'unanswered' : ''}`}
              onClick={() => goToId(q.id)}
              title={!isAnswered ? t('resultSkipped') : isCorrect ? t('resultCorrect') : t('resultWrong')}
            >
              {idx + 1}
            </button>
          ))}
        </div>
      </aside>

      <div className="result-questions-list">
        {pagedFiltered.map(({ q, idx, selected, correct, isCorrect, isAnswered }) => {
          return (
            <div id={`rq-${q.id}`} key={q.id} className={`result-question-card ${isCorrect ? 'is-correct' : isAnswered ? 'is-wrong' : 'is-skipped'}`}>
              
              <div className="question-header">
                <div className="question-badge">
                   {!isAnswered ? (
                     <span>{t('resultSkipped')}</span>
                   ) : isCorrect ? (
                     <><CheckCircle size={14} /> {t('resultCorrect')}</>
                   ) : (
                     <><XCircle size={14} /> {t('resultWrong')}</>
                   )}
                </div>
                <div className="question-text">
                  <span className="question-number">Q{idx + 1}:</span>
                  {q.question_text}
                </div>
              </div>
              
              <div className="options-list">
                {q.shuffled_options.map((opt) => {
                  const isSelected = selected.includes(opt.label);
                  const isActuallyCorrect = correct.includes(opt.label);
                  
                  let stateClass = 'option-neutral';
                  
                  if (isSelected && isActuallyCorrect) {
                     stateClass = 'option-correct';
                  } else if (isSelected && !isActuallyCorrect) {
                     stateClass = 'option-wrong';
                  } else if (!isSelected && isActuallyCorrect) {
                     stateClass = 'option-missed';
                  }

                  return (
                    <div key={opt.label} className={`option-row ${stateClass}`}>
                       <span className="option-label">{opt.label}.</span>
                       <span className="option-text">{opt.text}</span>
                       <span className="option-feedback">
                         {isActuallyCorrect && !isSelected && `(${t('resultCorrectAnswer')})`}
                         {isSelected && !isActuallyCorrect && `(${t('resultYourChoice')})`}
                       </span>
                    </div>
                  );
                })}
              </div>

            </div>
          );
        })}

        {pagedFiltered.length === 0 && (
           <div className="text-center text-muted" style={{ padding: '3rem' }}>
              No questions found for this filter.
           </div>
        )}

        {pagedFiltered.length > 0 && (
          <PaginationControls
            page={page}
            pageSize={pageSize}
            totalItems={filtered.length}
            onPageChange={setPage}
            onPageSizeChange={(size) => {
              setPageSize(size);
              setPage(1);
            }}
          />
        )}
      </div>

      <div className="mt-8 mb-8 flex justify-center items-center gap-3">
        <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="btn btn-secondary btn-round">
           Back to Top
        </button>
      </div>
    </div>
  );
}
