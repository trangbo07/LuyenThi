import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import {
  ClipboardList,
  Copy,
  RefreshCw,
  Trophy,
  Lock,
  Unlock,
  ExternalLink
} from 'lucide-react';

type CompetitionRow = {
  id: string;
  code: string;
  status: 'open' | 'closed';
  time_limit_minutes: number;
  created_at: string;
  subject_id: string | null;
  /** Supabase may return an object or a single-element array depending on FK */
  subjects?: { code: string; name: string } | { code: string; name: string }[] | null;
};

type Enriched = CompetitionRow & {
  questionCount: number;
  participantCount: number;
  submittedCount: number;
};

function countByCompetitionId(rows: { competition_id: string }[] | null) {
  const m = new Map<string, number>();
  for (const r of rows || []) {
    const id = r.competition_id;
    m.set(id, (m.get(id) || 0) + 1);
  }
  return m;
}

export default function BattleManage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Enriched[]>([]);
  const [filter, setFilter] = useState<'all' | 'open' | 'closed'>('all');
  const [closingId, setClosingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);

    const { data: comps, error: cErr } = await supabase
      .from('competitions')
      .select('id, code, status, time_limit_minutes, created_at, subject_id, subjects ( code, name )')
      .order('created_at', { ascending: false });

    if (cErr) {
      setLoading(false);
      alert('Could not load rooms: ' + cErr.message);
      return;
    }

    const list = (comps || []) as unknown as CompetitionRow[];
    const ids = list.map((c) => c.id);
    if (ids.length === 0) {
      setRows([]);
      setLoading(false);
      return;
    }

    const [{ data: cqRows }, { data: partRows }, { data: attRows }] = await Promise.all([
      supabase.from('competition_questions').select('competition_id').in('competition_id', ids),
      supabase.from('competition_participants').select('competition_id').in('competition_id', ids),
      supabase.from('attempts').select('competition_id').in('competition_id', ids)
    ]);

    const qMap = countByCompetitionId(cqRows as { competition_id: string }[] | null);
    const pMap = countByCompetitionId(partRows as { competition_id: string }[] | null);
    const aMap = countByCompetitionId(attRows as { competition_id: string }[] | null);

    const enriched: Enriched[] = list.map((c) => ({
      ...c,
      questionCount: qMap.get(c.id) || 0,
      participantCount: pMap.get(c.id) || 0,
      submittedCount: aMap.get(c.id) || 0
    }));

    setRows(enriched);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    if (filter === 'all') return rows;
    if (filter === 'open') return rows.filter((r) => r.status === 'open');
    return rows.filter((r) => r.status === 'closed');
  }, [rows, filter]);

  const closeRoom = async (id: string) => {
    if (!confirm('Close this room? Students will not be able to start a new attempt.')) return;
    setClosingId(id);
    const { error } = await supabase.from('competitions').update({ status: 'closed' }).eq('id', id);
    setClosingId(null);
    if (error) {
      alert('Could not close room: ' + error.message);
      return;
    }
    await load();
  };

  const reopenRoom = async (id: string) => {
    if (!confirm('Reopen this room?')) return;
    setClosingId(id);
    const { error } = await supabase.from('competitions').update({ status: 'open' }).eq('id', id);
    setClosingId(null);
    if (error) {
      alert('Could not reopen room: ' + error.message);
      return;
    }
    await load();
  };

  const copyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      alert('Copied code: ' + code);
    } catch {
      alert('Room code: ' + code);
    }
  };

  const subjectLabel = (r: Enriched) => {
    const s = r.subjects;
    if (s && typeof s === 'object' && !Array.isArray(s)) {
      return `${s.code} — ${s.name}`;
    }
    if (Array.isArray(r.subjects) && r.subjects[0]) {
      return `${r.subjects[0].code} — ${r.subjects[0].name}`;
    }
    return r.subject_id || '—';
  };

  return (
    <div className="animate-fade-in" style={{ maxWidth: '1200px', margin: '0 auto' }}>
      <div className="glass-card mb-6" style={{ padding: '1.25rem' }}>
        <div className="flex justify-between items-center" style={{ gap: '1rem', flexWrap: 'wrap' }}>
          <div className="flex items-center gap-2">
            <ClipboardList size={28} color="var(--primary-color)" />
            <div>
              <h2 style={{ margin: 0 }}>Battle room management</h2>
              <div className="text-sm" style={{ color: 'var(--text-secondary)', fontWeight: 600, marginTop: '0.25rem' }}>
                View open/closed rooms, participants, and submissions.
              </div>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button type="button" className="btn btn-secondary" style={{ borderRadius: '999px' }} onClick={() => load()}>
              <RefreshCw size={18} /> Refresh
            </button>
            <Link to="/admin/battle/create" className="btn btn-primary" style={{ borderRadius: '999px', textDecoration: 'none' }}>
              + New room
            </Link>
          </div>
        </div>

        <div className="flex gap-2 mt-4 flex-wrap">
          {(['all', 'open', 'closed'] as const).map((f) => (
            <button
              key={f}
              type="button"
              className="btn btn-secondary"
              style={{
                borderRadius: '999px',
                fontWeight: 800,
                borderColor: filter === f ? 'var(--primary-color)' : undefined,
                background: filter === f ? 'rgba(79, 70, 229, 0.1)' : undefined
              }}
              onClick={() => setFilter(f)}
            >
              {f === 'all' ? 'All' : f === 'open' ? 'Open' : 'Closed'}
            </button>
          ))}
        </div>
      </div>

      {loading && (
        <div className="card text-center" style={{ padding: '3rem' }}>
          Loading...
        </div>
      )}

      {!loading && filtered.length === 0 && (
        <div className="card text-center" style={{ padding: '3rem' }}>
          No battle rooms yet, or none match the filter.
        </div>
      )}

      {!loading && filtered.length > 0 && (
        <div className="grid gap-4">
          {filtered.map((r) => (
            <div key={r.id} className="card" style={{ borderLeft: `6px solid ${r.status === 'open' ? 'var(--success-color)' : 'var(--text-secondary)'}` }}>
              <div className="flex justify-between items-start gap-4 flex-wrap">
                <div style={{ minWidth: 0, flex: '1 1 280px' }}>
                  <div className="flex items-center gap-2 flex-wrap mb-2">
                    <span style={{ fontWeight: 950, fontSize: '1.15rem', letterSpacing: '0.08em' }}>{r.code}</span>
                    {r.status === 'open' ? (
                      <span style={{ fontSize: '0.8rem', fontWeight: 800, padding: '0.2rem 0.65rem', borderRadius: '999px', background: 'rgba(16, 185, 129, 0.15)', color: '#065f46' }}>
                        <Unlock size={12} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />
                        Open
                      </span>
                    ) : (
                      <span style={{ fontSize: '0.8rem', fontWeight: 800, padding: '0.2rem 0.65rem', borderRadius: '999px', background: 'rgba(100, 116, 139, 0.2)', color: '#334155' }}>
                        <Lock size={12} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />
                        Closed
                      </span>
                    )}
                  </div>
                  <div className="text-sm" style={{ color: 'var(--text-secondary)', fontWeight: 650, lineHeight: 1.5 }}>
                    <div><b>Subject:</b> {subjectLabel(r)}</div>
                    <div>
                      <b>Questions:</b> {r.questionCount} • <b>Time:</b> {r.time_limit_minutes} min
                    </div>
                    <div>
                      <b>Joined:</b> {r.participantCount} • <b>Submitted:</b> {r.submittedCount}
                    </div>
                    <div className="text-muted" style={{ fontSize: '0.85rem', marginTop: '0.25rem' }}>
                      Created: {new Date(r.created_at).toLocaleString()}
                    </div>
                  </div>
                </div>

                <div className="flex gap-2 flex-wrap" style={{ alignItems: 'center' }}>
                  <button type="button" className="btn btn-secondary" style={{ borderRadius: '999px' }} onClick={() => copyCode(r.code)}>
                    <Copy size={16} /> Copy code
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ borderRadius: '999px' }}
                    onClick={() => navigate(`/battle/${r.code}/ranking`)}
                  >
                    <Trophy size={16} /> Ranking
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ borderRadius: '999px' }}
                    onClick={() => navigate(`/battle/${r.code}`)}
                  >
                    <ExternalLink size={16} /> Open room
                  </button>
                  {r.status === 'open' ? (
                    <button
                      type="button"
                      className="btn"
                      style={{ borderRadius: '999px', background: '#fef2f2', color: '#991b1b', border: '1px solid #fecaca' }}
                      disabled={closingId === r.id}
                      onClick={() => closeRoom(r.id)}
                    >
                      <Lock size={16} /> Close room
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="btn btn-secondary"
                      style={{ borderRadius: '999px' }}
                      disabled={closingId === r.id}
                      onClick={() => reopenRoom(r.id)}
                    >
                      <Unlock size={16} /> Reopen
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
