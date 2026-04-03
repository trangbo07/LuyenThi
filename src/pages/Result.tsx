import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Target, CheckCircle, XCircle, ListFilter, LayoutGrid, ArrowLeft, Trophy } from 'lucide-react';
import PaginationControls from '../components/PaginationControls';
import { useI18n } from '../i18n/I18nProvider';

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

  if (!questions) {
    return (
      <div className="card text-center" style={{ padding: '4rem' }}>
        <h2>{t('resultNoData')}</h2>
        <button onClick={() => navigate('/')} className="btn btn-primary mt-4">{t('resultGoHome')}</button>
      </div>
    );
  }

  const isPassing = score >= 5.0;

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
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setNavOpen(false);
  };

  return (
    <div className="animate-fade-in result-shell" style={{ maxWidth: '1100px', margin: '0 auto' }}>
      
      <div className="glass-card mb-6" style={{ padding: '1.25rem' }}>
        <div className="flex justify-between items-center" style={{ gap: '1rem', flexWrap: 'wrap' }}>
          <div className="flex items-center" style={{ gap: '0.75rem' }}>
            <Target size={38} color={isPassing ? 'var(--success-color)' : 'var(--error-color)'} />
            <div>
              <div style={{ fontWeight: 900, fontSize: '1.25rem', color: 'var(--text-primary)', marginBottom: '0.15rem' }}>
                {t('resultComplete')}
              </div>
              <div className="text-sm" style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>
                {t('resultDetail')}
              </div>
            </div>
          </div>

          <div className="flex items-center" style={{ gap: '0.75rem', flexWrap: 'wrap' }}>
            {typeof battleCode === 'string' && battleCode.length > 0 && (
              <button
                className="btn btn-primary"
                type="button"
                onClick={() => navigate(`/battle/${battleCode}/ranking`)}
                style={{ borderRadius: '999px', padding: '0.65rem 0.95rem' }}
              >
                <Trophy size={18} /> {t('resultRoomRanking')}
              </button>
            )}
            <button
              className="btn btn-secondary"
              type="button"
              onClick={() => navigate('/')}
              style={{ borderRadius: '999px', padding: '0.65rem 0.95rem' }}
            >
              <ArrowLeft size={18} /> {t('resultHome')}
            </button>
            <button
              className="btn btn-secondary"
              type="button"
              onClick={() => setNavOpen(v => !v)}
              style={{ borderRadius: '999px', padding: '0.65rem 0.95rem' }}
              title={t('resultOpenNavigator')}
            >
              <LayoutGrid size={18} /> {t('resultQuestions')}
            </button>
          </div>
        </div>

        <div className="result-top-grid" style={{ marginTop: '1rem' }}>
          <div className="result-score card" style={{ padding: '1rem', background: isPassing ? 'rgba(209, 250, 229, 0.65)' : 'rgba(254, 226, 226, 0.65)', borderColor: isPassing ? 'rgba(16, 185, 129, 0.35)' : 'rgba(239, 68, 68, 0.35)' }}>
            <div className="text-sm" style={{ color: 'var(--text-secondary)', fontWeight: 800, marginBottom: '0.25rem' }}>{t('resultScore')}</div>
            <div style={{ fontSize: '2.4rem', fontWeight: 950, letterSpacing: '-0.02em', color: isPassing ? '#065f46' : '#991b1b' }}>
              {Number(score).toFixed(2)} <span style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-secondary)' }}>/ 10</span>
            </div>
            <div className="text-sm" style={{ marginTop: '0.25rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
              {isPassing ? t('resultPass') : t('resultFail')} • {t('resultCorrect')} {correctCount}/{totalCount}
            </div>
          </div>

          <div className="card" style={{ padding: '1rem' }}>
            <div className="flex justify-between items-center mb-4">
              <div style={{ fontWeight: 900, color: 'var(--text-primary)' }}>{t('resultSummary')}</div>
              <div className="text-sm" style={{ color: 'var(--text-secondary)', fontWeight: 700 }}>{counts.total} {t('resultQuestions')}</div>
            </div>
            <div className="result-stat-row">
              <div className="result-stat">
                <div className="result-stat-dot" style={{ background: 'var(--success-color)' }} />
                <div>
                  <div className="text-sm" style={{ color: 'var(--text-secondary)', fontWeight: 700 }}>{t('resultCorrect')}</div>
                  <div style={{ fontWeight: 950, fontSize: '1.25rem', color: 'var(--text-primary)' }}>{counts.correct}</div>
                </div>
              </div>
              <div className="result-stat">
                <div className="result-stat-dot" style={{ background: 'var(--error-color)' }} />
                <div>
                  <div className="text-sm" style={{ color: 'var(--text-secondary)', fontWeight: 700 }}>{t('resultWrong')}</div>
                  <div style={{ fontWeight: 950, fontSize: '1.25rem', color: 'var(--text-primary)' }}>{counts.wrong}</div>
                </div>
              </div>
              <div className="result-stat">
                <div className="result-stat-dot" style={{ background: '#94a3b8' }} />
                <div>
                  <div className="text-sm" style={{ color: 'var(--text-secondary)', fontWeight: 700 }}>{t('resultSkipped')}</div>
                  <div style={{ fontWeight: 950, fontSize: '1.25rem', color: 'var(--text-primary)' }}>{counts.unanswered}</div>
                </div>
              </div>
            </div>
            <div style={{ marginTop: '0.9rem' }}>
              <div className="progress-track">
                <div className="progress-fill" style={{ width: `${(counts.correct / Math.max(1, counts.total)) * 100}%` }}></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="glass-card mb-5" style={{ padding: '1rem' }}>
        <div className="flex justify-between items-center" style={{ gap: '1rem', flexWrap: 'wrap' }}>
          <div style={{ fontWeight: 950, color: 'var(--text-primary)', fontSize: '1.05rem' }}>{t('resultAnswerReview')}</div>
          <div className="flex" style={{ gap: '0.5rem', flexWrap: 'wrap' }}>
            <button className={`btn btn-secondary result-filter ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')} type="button" style={{ borderRadius: '999px', padding: '0.55rem 0.85rem' }}>
              <ListFilter size={16} /> {t('resultAll')} ({counts.total})
            </button>
            <button className={`btn btn-secondary result-filter ${filter === 'correct' ? 'active' : ''}`} onClick={() => setFilter('correct')} type="button" style={{ borderRadius: '999px', padding: '0.55rem 0.85rem' }}>
              <CheckCircle size={16} color="var(--success-color)" /> {t('resultCorrect')} ({counts.correct})
            </button>
            <button className={`btn btn-secondary result-filter ${filter === 'wrong' ? 'active' : ''}`} onClick={() => setFilter('wrong')} type="button" style={{ borderRadius: '999px', padding: '0.55rem 0.85rem' }}>
              <XCircle size={16} color="var(--error-color)" /> {t('resultWrong')} ({counts.wrong})
            </button>
            <button className={`btn btn-secondary result-filter ${filter === 'unanswered' ? 'active' : ''}`} onClick={() => setFilter('unanswered')} type="button" style={{ borderRadius: '999px', padding: '0.55rem 0.85rem' }}>
              {t('resultSkipped')} ({counts.unanswered})
            </button>
          </div>
        </div>
      </div>

      <aside className={`glass-card result-nav ${navOpen ? 'open' : ''}`}>
        <div className="flex justify-between items-center mb-4">
          <div style={{ fontWeight: 950, color: 'var(--text-primary)' }}>{t('resultQuestions')}</div>
          <button className="btn btn-secondary" type="button" onClick={() => setNavOpen(false)} style={{ padding: '0.4rem 0.7rem', borderRadius: '999px' }}>
            {t('examClose')}
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
        <div className="text-sm" style={{ marginTop: '0.85rem', color: 'var(--text-secondary)', fontWeight: 700 }}>
          {t('resultJumpHint')}
        </div>
      </aside>

      <div className="grid gap-6">
        {pagedFiltered.map(({ q, idx, selected, correct, isCorrect, isAnswered }) => {

          return (
            <div id={`rq-${q.id}`} key={q.id} className="card result-card" style={{ borderLeft: `6px solid ${isCorrect ? 'var(--success-color)' : isAnswered ? 'var(--error-color)' : '#94a3b8'}` }}>
              <div className="flex items-start gap-3 mb-4">
                <div style={{ marginTop: '0.2rem' }}>
                  {!isAnswered ? (
                    <div className="result-badge" style={{ background: '#e2e8f0', color: '#334155' }}>{t('resultSkipped')}</div>
                  ) : isCorrect ? (
                    <div className="result-badge" style={{ background: 'rgba(16, 185, 129, 0.12)', color: '#065f46' }}><CheckCircle size={16} color="var(--success-color)" /> {t('resultCorrect')}</div>
                  ) : (
                    <div className="result-badge" style={{ background: 'rgba(239, 68, 68, 0.12)', color: '#991b1b' }}><XCircle size={16} color="var(--error-color)" /> {t('resultWrong')}</div>
                  )}
                </div>
                <h4 style={{ lineHeight: '1.6' }}>
                  <span style={{ color: 'var(--text-secondary)', marginRight: '0.5rem' }}>Q{idx + 1}:</span>
                  {q.question_text}
                </h4>
              </div>
              
              <div className="grid gap-2 pl-8">
                {q.shuffled_options.map((opt) => {
                  const isSelected = selected.includes(opt.label);
                  const isActuallyCorrect = correct.includes(opt.label);
                  
                  let bg = 'transparent';
                  let border = '1px solid var(--border-color)';
                  
                  // Highlight logic
                  if (isSelected && isActuallyCorrect) {
                     bg = '#d1fae5'; // green bg
                     border = '1px solid var(--success-color)';
                  } else if (isSelected && !isActuallyCorrect) {
                     bg = '#fee2e2'; // red bg
                     border = '1px solid var(--error-color)';
                  } else if (!isSelected && isActuallyCorrect) {
                     bg = '#d1fae5'; // Should have been selected
                     border = '1px dashed var(--success-color)';
                  }

                  return (
                    <div 
                      key={opt.label} 
                      className="p-3"
                      style={{ 
                        background: bg,
                        border: border,
                        borderRadius: 'var(--radius-md)'
                      }}
                    >
                       <span style={{ fontWeight: 800, marginRight: '0.5rem' }}>{opt.label}.</span>
                       <span>{opt.text}</span>
                       {isActuallyCorrect && !isSelected && <span className="ml-2 text-sm" style={{ color: 'var(--success-color)', fontWeight: 800 }}>({t('resultCorrectAnswer')})</span>}
                       {isSelected && !isActuallyCorrect && <span className="ml-2 text-sm" style={{ color: 'var(--error-color)', fontWeight: 800 }}>({t('resultYourChoice')})</span>}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
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
      </div>

      <div className="mt-8 mb-8 flex justify-center items-center gap-3" style={{ flexWrap: 'wrap' }}>
        {typeof battleCode === 'string' && battleCode.length > 0 && (
          <button
            type="button"
            onClick={() => navigate(`/battle/${battleCode}/ranking`)}
            className="btn btn-primary"
            style={{ padding: '0.85rem 2rem', borderRadius: '999px' }}
          >
            <Trophy size={18} /> {t('resultBattleRanking')}
          </button>
        )}
        <button onClick={() => navigate('/')} className="btn btn-secondary" style={{ padding: '0.85rem 2rem', borderRadius: '999px' }}>
          {t('resultHome')}
        </button>
      </div>
    </div>
  );
}
