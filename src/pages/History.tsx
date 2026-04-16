import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import type { Attempt } from '../types/database.types';
import { Eye, Search, Trophy, CalendarDays, Activity } from 'lucide-react';
import { useAuth } from '../auth/useAuth';
import PaginationControls from '../components/PaginationControls';
import { useI18n } from '../i18n/I18nProvider';
import { useToast } from '../components/Toast';

type AttemptRow = Attempt & {
  subjects?: Array<{ code: string; name: string }> | null;
  competitions?: { code: string } | null;
};

function formatDateTime(iso?: string) {
  if (!iso) return { date: '', time: '' };
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { date: iso, time: '' };
  
  return {
    date: d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }),
    time: d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
  };
}

export default function History() {
  const { user, role } = useAuth();
  const { t } = useI18n();
  const { toast } = useToast();
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
        toast(t('battleLoadRoomsError', { message: error.message }), 'error');
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
    <div className="animate-fade-in history-container">
      {/* HEADER SECTION */}
      <div className="history-header">
        <div className="history-header-content">
          <div>
            <h2 className="history-title">{t('historyTitle')}</h2>
            <div className="history-subtitle">{t('historySubtitle')}</div>
          </div>
          
          <div className="history-search">
            <div className="search-wrap">
              <Search size={18} className="search-icon" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t('historySearchPlaceholder')}
              />
            </div>
          </div>
        </div>
      </div>

      {loading && (
        <div className="card text-center" style={{ padding: '4rem' }}>
          <Activity size={32} className="mx-auto text-muted animate-pulse mb-3" />
          <h3 className="text-muted">{t('historyLoading')}</h3>
        </div>
      )}

      {!loading && filtered.length === 0 && (
        <div className="card text-center" style={{ padding: '5rem 2rem' }}>
          <CalendarDays size={48} className="mx-auto mb-4" style={{ color: 'var(--border-color)' }} />
          <h3 style={{ fontWeight: 800, marginBottom: '0.5rem' }}>{t('historyEmptyTitle')}</h3>
          <p className="text-muted mb-6">{t('historyEmptyHint')}</p>
          <button className="btn btn-primary btn-round" onClick={() => navigate('/generate')}>
            {t('historyGenerateStart')}
          </button>
        </div>
      )}

      {/* TIMELINE LIST */}
      {!loading && filtered.length > 0 && (
        <div className="timeline-wrapper">
          <div className="timeline-line" />
          
          {pagedRows.map((a, idx) => {
            const s0 = a.subjects?.[0];
            const subjectLabel = s0 ? `${s0.code} - ${s0.name}` : a.subject_id;
            const isPassing = Number(a.score) >= 5;
            const dt = formatDateTime(a.created_at);
            
            return (
              <div key={a.id} className="timeline-item" style={{ animationDelay: `${idx * 0.05}s` }}>
                <div className={`timeline-dot ${isPassing ? 'passing' : 'failing'}`} />
                
                <div className="timeline-content">
                  <div className="timeline-date-cluster">
                     <span className="timeline-date">{dt.date}</span>
                     <span className="timeline-time">{dt.time}</span>
                  </div>
                  
                  <div className={`timeline-card ${isPassing ? 'passing' : 'failing'}`}>
                    <div className="timeline-card-main">
                      <div className="timeline-subject">{subjectLabel}</div>
                      
                      <div className="timeline-stats-row">
                         <span className="timeline-score-badge">
                           {Number(a.score).toFixed(2)} pts
                         </span>
                         <span className="timeline-correct-ratio">
                           {a.correct_answers} / {a.total_questions} correct
                         </span>
                         {isPassing ? (
                           <span className="timeline-status-badge passing">{t('resultPass')}</span>
                         ) : (
                           <span className="timeline-status-badge failing">{t('resultFail')}</span>
                         )}
                      </div>
                    </div>
                    
                    <div className="timeline-actions">
                      {a.competition_id && a.competitions?.code && (
                        <button
                          className="btn btn-secondary timeline-btn tooltip-trigger"
                          onClick={() => navigate(`/battle/${a.competitions!.code}/ranking`)}
                          title={t('resultRoomRanking')}
                        >
                          <Trophy size={16} />
                        </button>
                      )}
                      <button
                        className="btn btn-primary timeline-btn"
                        onClick={() => navigate(`/attempt/${a.id}`)}
                      >
                        <Eye size={16} /> <span>{t('resultDetail')}</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!loading && filtered.length > 0 && (
        <div className="timeline-pagination">
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
