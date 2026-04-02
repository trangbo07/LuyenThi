import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ExternalLink, RefreshCw, Trophy } from 'lucide-react';
import { supabase } from '../lib/supabase';

export default function BattleJoin() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [rooms, setRooms] = useState<Array<{
    id: string;
    code: string;
    time_limit_minutes: number;
    created_at: string;
    subjects?: { code: string; name: string } | { code: string; name: string }[] | null;
  }>>([]);
  const [error, setError] = useState<string | null>(null);

  const subjectLabel = useCallback((r: {
    subjects?: { code: string; name: string } | { code: string; name: string }[] | null;
  }) => {
    const s = r.subjects;
    if (!s) return '—';
    if (Array.isArray(s)) return s[0] ? `${s[0].code} - ${s[0].name}` : '—';
    return `${s.code} - ${s.name}`;
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: e } = await supabase
      .from('competitions')
      .select('id, code, time_limit_minutes, created_at, status, subjects ( code, name )')
      .eq('status', 'open')
      .order('created_at', { ascending: false });

    if (e) {
      setRooms([]);
      setError(e.message);
      setLoading(false);
      return;
    }

    setRooms((data || []) as any);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const latestCode = useMemo(() => (rooms.length > 0 ? rooms[0].code : null), [rooms]);

  return (
    <div className="animate-fade-in" style={{ maxWidth: '520px', margin: '0 auto' }}>
      <div className="glass-card" style={{ padding: '1.5rem' }}>
        <div className="flex justify-between items-start gap-3" style={{ flexWrap: 'wrap' }}>
          <div>
            <h2 style={{ marginBottom: '0.25rem' }}>Join a battle room</h2>
            <div className="text-sm" style={{ color: 'var(--text-secondary)', fontWeight: 650, marginBottom: '1rem', lineHeight: 1.5 }}>
              Pick an open room below to enter the exam and view the ranking.
            </div>
          </div>

          <button
            type="button"
            className="btn btn-secondary"
            style={{ borderRadius: '999px' }}
            onClick={() => void load()}
            disabled={loading}
            title="Refresh room list"
          >
            <RefreshCw size={18} /> Refresh
          </button>
        </div>

        {loading && (
          <div className="card text-center" style={{ padding: '1.5rem 1rem' }}>
            Loading...
          </div>
        )}

        {!loading && error && (
          <div className="mt-4 p-3" style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 'var(--radius-md)', fontWeight: 700, color: '#991b1b', lineHeight: 1.5 }}>
            Could not load rooms: {error}
          </div>
        )}

        {!loading && !error && rooms.length === 0 && (
          <div className="card text-center" style={{ padding: '1.5rem 1rem' }}>
            There are no open rooms right now.
          </div>
        )}

        {!loading && rooms.length > 0 && (
          <div className="grid gap-4">
            {rooms.map((r) => (
              <div
                key={r.id}
                className="card"
                style={{ padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 950, fontSize: '1.15rem', letterSpacing: '0.08em' }}>{r.code}</div>
                  <div className="text-sm" style={{ color: 'var(--text-secondary)', fontWeight: 650, marginTop: '0.25rem', lineHeight: 1.4 }}>
                    Subject: {subjectLabel(r)}
                  </div>
                  <div className="text-sm" style={{ color: 'var(--text-secondary)', fontWeight: 650, marginTop: '0.1rem' }}>
                    Time limit: {r.time_limit_minutes} min
                  </div>
                </div>

                <div className="flex items-center gap-2" style={{ flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="btn btn-primary"
                    style={{ borderRadius: '999px' }}
                    onClick={() => navigate(`/battle/${r.code}`)}
                    title="Enter room"
                  >
                    <ExternalLink size={16} /> Enter room
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ borderRadius: '999px' }}
                    onClick={() => navigate(`/battle/${r.code}/ranking`)}
                    title="Xem ranking"
                  >
                    <Trophy size={16} /> Ranking
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {latestCode && !loading && (
          <div className="text-sm" style={{ color: 'var(--text-secondary)', fontWeight: 650, marginTop: '1rem', lineHeight: 1.5 }}>
            Latest room: <b>{latestCode}</b>.
          </div>
        )}
      </div>
    </div>
  );
}

