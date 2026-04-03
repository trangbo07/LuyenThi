import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import type { Attempt } from '../types/database.types';
import { Clock, Eye, Search, Trophy } from 'lucide-react';
import { useAuth } from '../auth/useAuth';
import PaginationControls from '../components/PaginationControls';
import { useI18n } from '../i18n/I18nProvider';

type AttemptRow = Attempt & {
  subjects?: Array<{ code: string; name: string }> | null;
  competitions?: { code: string } | null;
};

function formatDateTime(iso?: string) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}

export default function History() {
  const { user, role } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  const [rows, setRows] = useState<AttemptRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      let q = supabase
        .from('attempts')
        .select('id, user_id, subject_id, competition_id, total_questions, correct_answers, score, created_at, subjects ( code, name ), competitions ( code )')
        .order('created_at', { ascending: false });

      if (role !== 'admin' && user?.id) {
        q = q.eq('user_id', user.id);
      }

      const { data, error } = await q;

      if (cancelled) return;

      if (error) {
        alert(t('battleLoadRoomsError', { message: error.message }));
        setRows([]);
        setLoading(false);
        return;
      }

      setRows(((data as unknown) as AttemptRow[]) || []);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [user?.id, role, t]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(r => {
      const s0 = r.subjects?.[0];
      const subj = `${s0?.code || ''} ${s0?.name || ''}`.trim().toLowerCase();
      const score = String(r.score ?? '').toLowerCase();
      const room = (r.competitions?.code || '').toLowerCase();
      return subj.includes(q) || score.includes(q) || room.includes(q);
    });
  }, [rows, query]);

  useEffect(() => {
    setPage(1);
  }, [query]);

  const pagedRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);

  return (
    <div className="animate-fade-in history-page" style={{ maxWidth: '1100px', margin: '0 auto' }}>
      <div className="glass-card mb-6 history-hero" style={{ padding: '1.25rem' }}>
        <div className="flex justify-between items-center history-hero-row" style={{ gap: '1rem', flexWrap: 'wrap' }}>
          <div>
            <h2 style={{ margin: 0 }}>{t('historyTitle')}</h2>
            <div className="text-sm" style={{ color: 'var(--text-secondary)', fontWeight: 600, marginTop: '0.25rem' }}>
              {t('historySubtitle')}
            </div>
          </div>

          <div className="history-search-wrap" style={{ width: 'min(440px, 100%)' }}>
            <div className="flex items-center gap-2 history-search-box" style={{ background: '#fff', border: '1px solid var(--border-color)', borderRadius: '999px', padding: '0.4rem 0.8rem' }}>
              <Search size={18} color="var(--text-secondary)" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t('historySearchPlaceholder')}
                style={{ border: 'none', outline: 'none', padding: '0.35rem 0.25rem' }}
              />
            </div>
          </div>
        </div>
      </div>

      {loading && (
        <div className="card text-center" style={{ padding: '3rem' }}>
          {t('historyLoading')}
        </div>
      )}

      {!loading && filtered.length === 0 && (
        <div className="card text-center" style={{ padding: '3rem' }}>
          <div style={{ fontWeight: 800, marginBottom: '0.25rem' }}>{t('historyEmptyTitle')}</div>
          <div className="text-muted">{t('historyEmptyHint')}</div>
          <button className="btn btn-primary mt-6" onClick={() => navigate('/generate')}>
            {t('historyGenerateStart')}
          </button>
        </div>
      )}

      {!loading && filtered.length > 0 && (
        <div className="grid gap-6 history-list">
          {pagedRows.map((a) => {
            const s0 = a.subjects?.[0];
            const subjectLabel = s0 ? `${s0.code} - ${s0.name}` : a.subject_id;
            const isPassing = Number(a.score) >= 5;
            return (
              <div key={a.id} className="card history-card" style={{ borderLeft: `6px solid ${isPassing ? 'var(--success-color)' : 'var(--error-color)'}` }}>
                <div className="flex justify-between items-start history-card-row" style={{ gap: '1rem', flexWrap: 'wrap' }}>
                  <div className="history-card-main" style={{ minWidth: 0 }}>
                    <div className="history-subject" style={{ fontWeight: 950, fontSize: '1.05rem', marginBottom: '0.25rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {subjectLabel}
                    </div>
                    <div className="text-sm history-meta" style={{ color: 'var(--text-secondary)', fontWeight: 650, display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                        <Clock size={16} /> {formatDateTime(a.created_at)}
                      </span>
                      <span className="history-dot">•</span>
                      <span>
                        {t('resultCorrect')} <span style={{ fontWeight: 900, color: 'var(--text-primary)' }}>{a.correct_answers}</span>/{a.total_questions}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 history-actions" style={{ flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                    <div className="history-score" style={{ textAlign: 'right' }}>
                      <div className="text-sm" style={{ color: 'var(--text-secondary)', fontWeight: 800 }}>{t('resultScore')}</div>
                      <div style={{ fontWeight: 950, fontSize: '1.6rem', color: isPassing ? '#065f46' : '#991b1b' }}>
                        {Number(a.score).toFixed(2)}
                      </div>
                    </div>
                    {a.competition_id && a.competitions?.code && (
                      <button
                        type="button"
                        className="btn btn-primary history-btn"
                        onClick={() => navigate(`/battle/${a.competitions!.code}/ranking`)}
                        style={{ borderRadius: '999px' }}
                        title={t('battleViewRanking')}
                      >
                        <Trophy size={18} /> {t('battleRanking')}
                      </button>
                    )}
                    <button
                      className="btn btn-secondary history-btn"
                      onClick={() => navigate(`/attempt/${a.id}`)}
                      style={{ borderRadius: '999px' }}
                      title={t('resultAnswerReview')}
                    >
                      <Eye size={18} /> {t('resultAnswerReview')}
                    </button>
                  </div>
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
      )}
    </div>
  );
}

