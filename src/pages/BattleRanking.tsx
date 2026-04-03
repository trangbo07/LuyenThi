import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { RefreshCw, Trophy } from 'lucide-react';
import PaginationControls from '../components/PaginationControls';
import { useI18n } from '../i18n/I18nProvider';

type DbCompetition = { id: string; code: string };

type LeaderRow = {
  id: string;
  user_id: string;
  score: number;
  correct_answers: number;
  total_questions: number;
  time_spent_seconds: number | null;
  created_at: string;
  /** Names merged from profiles (no FK attempts→profiles for PostgREST embed) */
  full_name?: string | null;
};

export default function BattleRanking() {
  const { code } = useParams();
  const navigate = useNavigate();
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [competition, setCompetition] = useState<DbCompetition | null>(null);
  const [rows, setRows] = useState<LeaderRow[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const load = async () => {
    if (!code) return;
    setLoading(true);

    const { data: comp, error: compErr } = await supabase
      .from('competitions')
      .select('id, code')
      .eq('code', code)
      .single();

    if (compErr || !comp) {
      setLoading(false);
      alert(t('battleRoomNotFound'));
      navigate('/battle/join');
      return;
    }

    setCompetition(comp as DbCompetition);

    const { data: attemptRows, error } = await supabase
      .from('attempts')
      .select('id, user_id, score, correct_answers, total_questions, time_spent_seconds, created_at')
      .eq('competition_id', comp.id);

    if (error) {
      setLoading(false);
      alert(t('battleLoadRankingError', { message: error.message }));
      return;
    }

    const attempts = (attemptRows || []) as Omit<LeaderRow, 'full_name'>[];
    const userIds = [...new Set(attempts.map((a) => a.user_id))];

    const nameByUser = new Map<string, string>();
    if (userIds.length > 0) {
      const { data: profs, error: pErr } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', userIds);
      if (!pErr && profs) {
        for (const p of profs as { id: string; full_name: string }[]) {
          nameByUser.set(p.id, p.full_name);
        }
      }
    }

    const merged: LeaderRow[] = attempts.map((a) => ({
      ...a,
      full_name: nameByUser.get(a.user_id) ?? null
    }));

    merged.sort((a, b) => {
      const ds = Number(b.score) - Number(a.score);
      if (ds !== 0) return ds;
      const ta = a.time_spent_seconds ?? 999999;
      const tb = b.time_spent_seconds ?? 999999;
      if (ta !== tb) return ta - tb;
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    });

    setRows(merged);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, t]);

  const display = useMemo(() => {
    return rows.map((r, idx) => ({
      ...r,
      rank: idx + 1,
      name: r.full_name || r.user_id
    }));
  }, [rows]);

  const pagedDisplay = useMemo(() => {
    const start = (page - 1) * pageSize;
    return display.slice(start, start + pageSize);
  }, [display, page, pageSize]);

  return (
    <div className="animate-fade-in" style={{ maxWidth: '900px', margin: '0 auto' }}>
      <div className="glass-card mb-6" style={{ padding: '1.25rem' }}>
        <div className="flex justify-between items-center" style={{ gap: '1rem', flexWrap: 'wrap' }}>
          <div>
            <h2 style={{ margin: 0 }}>{t('battleRanking')}</h2>
            <div className="text-sm" style={{ color: 'var(--text-secondary)', fontWeight: 700, marginTop: '0.25rem' }}>
              {t('battleRankingRoom', { code: competition?.code || code || '' })}
            </div>
          </div>
          <div className="flex gap-3">
            <button className="btn btn-secondary" onClick={() => navigate(`/battle/${code}`)} style={{ borderRadius: '999px' }}>
              {t('battleBackToRoom')}
            </button>
            <button className="btn btn-secondary" onClick={load} style={{ borderRadius: '999px' }}>
              <RefreshCw size={18} /> {t('battleRefresh')}
            </button>
          </div>
        </div>
      </div>

      {loading && (
        <div className="card text-center" style={{ padding: '3rem' }}>
          {t('battleLoadingRanking')}
        </div>
      )}

      {!loading && display.length === 0 && (
        <div className="card text-center" style={{ padding: '3rem' }}>
          {t('battleNoSubmissions')}
        </div>
      )}

      {!loading && display.length > 0 && (
        <div className="grid gap-6">
          {pagedDisplay.map((r) => (
            <div key={r.id} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0 }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '999px', display: 'grid', placeItems: 'center', background: r.rank === 1 ? 'rgba(245, 158, 11, 0.15)' : '#F1F5F9', border: '1px solid var(--border-color)', fontWeight: 950 }}>
                  {r.rank === 1 ? <Trophy size={18} color="#F59E0B" /> : r.rank}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 950, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</div>
                  <div className="text-sm" style={{ color: 'var(--text-secondary)', fontWeight: 650 }}>
                    {t('battleRankingCorrectStat', {
                      correct: r.correct_answers,
                      total: r.total_questions,
                      time: r.time_spent_seconds != null ? ` • ${r.time_spent_seconds}s` : ''
                    })}
                  </div>
                </div>
              </div>
              <div style={{ fontWeight: 950, fontSize: '1.4rem', color: 'var(--text-primary)' }}>
                {Number(r.score).toFixed(2)}
              </div>
            </div>
          ))}
          <PaginationControls
            page={page}
            pageSize={pageSize}
            totalItems={display.length}
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

