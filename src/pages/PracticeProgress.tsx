import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../auth/useAuth';
import { useI18n } from '../i18n/I18nProvider';
import type { Question, QuestionMastery } from '../types/database.types';
import PaginationControls from '../components/PaginationControls';
import { ArrowLeft, CheckCircle, XCircle, RotateCcw, Trophy, GraduationCap, Filter } from 'lucide-react';

type RowData = {
  question: Question;
  mastery: QuestionMastery | null;
};

export default function PracticeProgress() {
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useI18n();
  const { user } = useAuth();

  const sessionId: string = location.state?.sessionId || '';
  const subjectId: string = location.state?.subjectId || '';

  const [rows, setRows] = useState<RowData[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'mastered' | 'learning' | 'wrong' | 'untouched'>('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    if (!sessionId || !user?.id) return;
    let cancelled = false;

    (async () => {
      setLoading(true);

      const { data: qData } = await supabase
        .from('questions')
        .select('*')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: true });

      const { data: mData } = await supabase
        .from('question_mastery')
        .select('*')
        .eq('user_id', user.id)
        .eq('session_id', sessionId);

      if (cancelled) return;

      const questions = (qData as Question[]) || [];
      const masteryData = (mData as QuestionMastery[]) || [];
      const mMap: Record<string, QuestionMastery> = {};
      for (const m of masteryData) {
        mMap[m.question_id] = m;
      }

      const combined: RowData[] = questions.map(q => ({
        question: q,
        mastery: mMap[q.id] || null,
      }));

      setRows(combined);
      setLoading(false);
    })();

    return () => { cancelled = true; };
  }, [sessionId, user?.id]);

  const counts = useMemo(() => {
    let mastered = 0, learning = 0, wrong = 0, untouched = 0;
    for (const r of rows) {
      if (!r.mastery) { untouched++; continue; }
      if (r.mastery.is_mastered) mastered++;
      else if (r.mastery.last_answer_correct === false) wrong++;
      else if (r.mastery.correct_count > 0) learning++;
      else untouched++;
    }
    return { mastered, learning, wrong, untouched, total: rows.length };
  }, [rows]);

  const filtered = useMemo(() => {
    if (filter === 'all') return rows;
    return rows.filter(r => {
      if (filter === 'mastered') return r.mastery?.is_mastered;
      if (filter === 'wrong') return r.mastery && r.mastery.last_answer_correct === false;
      if (filter === 'learning') return r.mastery && !r.mastery.is_mastered && r.mastery.correct_count > 0 && r.mastery.last_answer_correct !== false;
      // untouched
      return !r.mastery || r.mastery.total_attempts === 0;
    });
  }, [rows, filter]);

  useEffect(() => { setPage(1); }, [filter]);

  const paged = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);

  const masteryPercent = counts.total > 0 ? Math.round((counts.mastered / counts.total) * 100) : 0;

  if (!sessionId) {
    return (
      <div className="card text-center animate-fade-in" style={{ padding: '3rem' }}>
        <h3>{t('practiceNoSession')}</h3>
        <button className="btn btn-primary mt-4" onClick={() => navigate('/practice')}>
          <ArrowLeft size={18} /> {t('practiceBack')}
        </button>
      </div>
    );
  }

  return (
    <div className="animate-fade-in" style={{ maxWidth: '900px', margin: '0 auto' }}>
      {/* Header */}
      <div className="glass-card" style={{ padding: '1.25rem', marginBottom: '1.5rem' }}>
        <div className="flex justify-between items-center" style={{ gap: '1rem', flexWrap: 'wrap' }}>
          <div className="flex items-center gap-3">
            <button className="btn btn-secondary" onClick={() => navigate('/practice')} style={{ borderRadius: '999px', padding: '0.5rem 0.75rem' }}>
              <ArrowLeft size={18} />
            </button>
            <div>
              <h2 style={{ margin: 0 }}>{t('progressTitle')}</h2>
              <div className="text-sm text-muted" style={{ fontWeight: 600, marginTop: '0.15rem' }}>{t('progressSubtitle')}</div>
            </div>
          </div>
          <button
            className="btn btn-primary"
            style={{ borderRadius: '999px' }}
            onClick={() => navigate('/practice/session', { state: { subjectId, sessionId, mode: 'wrong' } })}
            disabled={counts.wrong === 0}
          >
            <RotateCcw size={16} /> {t('practiceRedoWrong')}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="card text-center" style={{ padding: '3rem' }}>{t('practiceLoading')}</div>
      ) : (
        <>
          {/* Summary section */}
          <div className="card" style={{ marginBottom: '1.5rem' }}>
            <div className="practice-progress-summary">
              <div className="practice-progress-ring-area">
                <div className="practice-progress-ring" style={{ '--percent': masteryPercent } as React.CSSProperties}>
                  <div className="practice-progress-ring-inner">
                    <GraduationCap size={22} style={{ color: masteryPercent === 100 ? 'var(--success-color)' : 'var(--primary-color)' }} />
                    <div style={{ fontWeight: 950, fontSize: '1.4rem' }}>{masteryPercent}%</div>
                  </div>
                </div>
                <div className="text-sm text-center" style={{ fontWeight: 700, color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
                  {t('practiceMasteryProgress')}
                </div>
              </div>

              <div className="practice-progress-counts">
                <div className="practice-progress-count-item">
                  <div className="practice-progress-dot mastered"></div>
                  <div>
                    <div className="text-sm" style={{ fontWeight: 700, color: 'var(--text-secondary)' }}>{t('practiceMastered')}</div>
                    <div style={{ fontWeight: 950, fontSize: '1.15rem' }}>{counts.mastered}</div>
                  </div>
                </div>
                <div className="practice-progress-count-item">
                  <div className="practice-progress-dot learning"></div>
                  <div>
                    <div className="text-sm" style={{ fontWeight: 700, color: 'var(--text-secondary)' }}>{t('practiceLearning')}</div>
                    <div style={{ fontWeight: 950, fontSize: '1.15rem' }}>{counts.learning}</div>
                  </div>
                </div>
                <div className="practice-progress-count-item">
                  <div className="practice-progress-dot wrong"></div>
                  <div>
                    <div className="text-sm" style={{ fontWeight: 700, color: 'var(--text-secondary)' }}>{t('practiceWrong')}</div>
                    <div style={{ fontWeight: 950, fontSize: '1.15rem' }}>{counts.wrong}</div>
                  </div>
                </div>
                <div className="practice-progress-count-item">
                  <div className="practice-progress-dot untouched"></div>
                  <div>
                    <div className="text-sm" style={{ fontWeight: 700, color: 'var(--text-secondary)' }}>{t('practiceUntouched')}</div>
                    <div style={{ fontWeight: 950, fontSize: '1.15rem' }}>{counts.untouched}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Filters */}
          <div className="glass-card" style={{ padding: '1rem', marginBottom: '1.25rem' }}>
            <div className="flex items-center gap-2" style={{ flexWrap: 'wrap' }}>
              <Filter size={16} style={{ color: 'var(--text-secondary)' }} />
              {(['all', 'mastered', 'learning', 'wrong', 'untouched'] as const).map(f => {
                const labels: Record<string, string> = {
                  all: `${t('resultAll')} (${counts.total})`,
                  mastered: `${t('practiceMastered')} (${counts.mastered})`,
                  learning: `${t('practiceLearning')} (${counts.learning})`,
                  wrong: `${t('practiceWrong')} (${counts.wrong})`,
                  untouched: `${t('practiceUntouched')} (${counts.untouched})`,
                };
                return (
                  <button
                    key={f}
                    className={`btn btn-secondary result-filter ${filter === f ? 'active' : ''}`}
                    onClick={() => setFilter(f)}
                    style={{ borderRadius: '999px', padding: '0.45rem 0.75rem' }}
                  >
                    {labels[f]}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Question list */}
          <div className="grid gap-3">
            {paged.map(({ question, mastery }) => {
              const globalIdx = rows.findIndex(r => r.question.id === question.id) + 1;
              const correctCount = mastery?.correct_count ?? 0;
              const totalAttempts = mastery?.total_attempts ?? 0;
              const isMastered = mastery?.is_mastered ?? false;
              const lastCorrect = mastery?.last_answer_correct;

              let statusColor = '#94a3b8';
              let statusLabel = t('practiceUntouched');
              let StatusIcon = () => <div className="practice-progress-dot untouched" style={{ width: 10, height: 10 }} />;

              if (isMastered) {
                statusColor = 'var(--success-color)';
                statusLabel = t('practiceMastered');
                StatusIcon = () => <Trophy size={16} color="var(--success-color)" />;
              } else if (lastCorrect === false) {
                statusColor = 'var(--error-color)';
                statusLabel = t('practiceWrong');
                StatusIcon = () => <XCircle size={16} color="var(--error-color)" />;
              } else if (correctCount > 0) {
                statusColor = '#f59e0b';
                statusLabel = t('practiceLearning');
                StatusIcon = () => <CheckCircle size={16} color="#f59e0b" />;
              }

              return (
                <div key={question.id} className="card" style={{ padding: '1rem', borderLeft: `5px solid ${statusColor}` }}>
                  <div className="flex justify-between items-start" style={{ gap: '0.75rem' }}>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div className="flex items-center gap-2" style={{ marginBottom: '0.35rem' }}>
                        <StatusIcon />
                        <span className="text-sm" style={{ fontWeight: 800, color: statusColor }}>{statusLabel}</span>
                      </div>
                      <div style={{ fontWeight: 600, lineHeight: 1.6, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const }}>
                        <span className="text-muted" style={{ marginRight: '0.35rem' }}>Q{globalIdx}.</span>
                        {question.question_text}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div className="practice-mastery-blocks" style={{ justifyContent: 'flex-end' }}>
                        {Array.from({ length: 5 }, (_, i) => (
                          <div key={i} className={`practice-mastery-block ${i < correctCount ? 'filled' : ''} ${isMastered ? 'mastered' : ''}`} />
                        ))}
                      </div>
                      <div className="text-sm" style={{ color: 'var(--text-secondary)', fontWeight: 700, marginTop: '0.3rem' }}>
                        {correctCount}/5 • {totalAttempts} {t('practiceAttempts')}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <PaginationControls
            page={page}
            pageSize={pageSize}
            totalItems={filtered.length}
            onPageChange={setPage}
            onPageSizeChange={(size) => { setPageSize(size); setPage(1); }}
          />
        </>
      )}
    </div>
  );
}
