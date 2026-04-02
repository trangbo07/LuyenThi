import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import type { ExamSession, Subject } from '../types/database.types';
import { shuffleSeeded } from '../lib/seedShuffle';

function genCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < 6; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

export default function BattleCreate() {
  const navigate = useNavigate();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [sessions, setSessions] = useState<ExamSession[]>([]);
  const [selectedSubject, setSelectedSubject] = useState('');
  const [selectedSessions, setSelectedSessions] = useState<string[]>([]);
  const [questionCount, setQuestionCount] = useState<number>(30);
  const [timeLimit, setTimeLimit] = useState<number>(30);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('subjects').select('*').order('name');
      if (data) setSubjects(data);
    })();
  }, []);

  const fetchSessions = async (subId: string) => {
    const { data } = await supabase.from('exam_sessions').select('*').eq('subject_id', subId).order('name');
    if (data) setSessions(data);
  };

  const toggleSession = (id: string) => {
    setSelectedSessions(prev => (prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]));
  };

  const handleCreate = async () => {
    if (!selectedSubject) return alert('Select a subject.');
    if (selectedSessions.length === 0) return alert('Select at least one session.');
    if (questionCount <= 0) return alert('Question count must be greater than 0');

    setCreating(true);

    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) {
      setCreating(false);
      return alert('You must be signed in.');
    }

    // Fetch all questions from selected sessions
    const { data: qs, error } = await supabase
      .from('questions')
      .select('id, question_text')
      .in('session_id', selectedSessions);

    if (error || !qs || qs.length === 0) {
      setCreating(false);
      return alert('Could not load questions.');
    }

    // Deduplicate by normalized question text
    const map = new Map<string, { id: string; question_text: string }>();
    for (const q of qs as any[]) {
      const normalized = String(q.question_text || '').trim().toLowerCase().replace(/\s+/g, ' ');
      if (!map.has(normalized)) map.set(normalized, q);
    }
    const unique = Array.from(map.values());

    // Create competition (try a few codes if collision)
    let code = genCode();
    let competitionId: string | null = null;
    for (let attempt = 0; attempt < 5; attempt++) {
      const { data: comp, error: compErr } = await supabase
        .from('competitions')
        .insert([{ code, created_by: userId, subject_id: selectedSubject, time_limit_minutes: timeLimit, status: 'open' }])
        .select('id, code')
        .single();
      if (!compErr && comp?.id) {
        competitionId = comp.id;
        code = comp.code;
        break;
      }
      code = genCode();
    }

    if (!competitionId) {
      setCreating(false);
      return alert('Could not create room (code collision). Try again.');
    }

    // Seeded shuffle for fairness (same question set order)
    const chosen = shuffleSeeded(unique, `battle:${code}`).slice(0, Math.min(questionCount, unique.length));

    const inserts = chosen.map((q, idx) => ({ competition_id: competitionId, question_id: q.id, position: idx + 1 }));
    const { error: cqErr } = await supabase.from('competition_questions').insert(inserts);
    if (cqErr) {
      setCreating(false);
      return alert('Could not save battle questions: ' + cqErr.message);
    }

    // Admin creates room only — participants join via room list / code.

    setCreating(false);
    navigate(`/battle/${code}`);
  };

  return (
    <div className="card animate-fade-in" style={{ maxWidth: '700px', margin: '0 auto' }}>
      <h2 className="mb-2 text-center">Create battle room (Admin)</h2>
      <p className="text-muted text-sm text-center mb-4" style={{ fontWeight: 600 }}>
        Pick subject, sessions, question count, and time limit. Share the room code with students — one attempt per person per room; ranking by score.
      </p>

      <div className="mb-4">
        <label className="mb-2" style={{ display: 'block', fontWeight: 800 }}>Subject</label>
        <select
          value={selectedSubject}
          onChange={(e) => {
            const id = e.target.value;
            setSelectedSubject(id);
            setSelectedSessions([]);
            setSessions([]);
            if (id) fetchSessions(id);
          }}
        >
          <option value="">-- Choose subject --</option>
          {subjects.map(s => (
            <option key={s.id} value={s.id}>{s.code} - {s.name}</option>
          ))}
        </select>
      </div>

      {selectedSubject && (
        <div className="mb-4">
          <label className="mb-2" style={{ display: 'block', fontWeight: 800 }}>Sessions (one or more)</label>
          <div className="grid gap-2" style={{ maxHeight: '220px', overflowY: 'auto', border: '1px solid var(--border-color)', padding: '1rem', borderRadius: 'var(--radius-md)' }}>
            {sessions.map(s => (
              <label key={s.id} className="flex gap-2 items-center" style={{ cursor: 'pointer' }}>
                <input type="checkbox" style={{ width: 'auto' }} checked={selectedSessions.includes(s.id)} onChange={() => toggleSession(s.id)} />
                {s.code} - {s.name}
              </label>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-4 mb-6">
        <div className="flex-1">
          <label className="mb-2" style={{ display: 'block', fontWeight: 800 }}>Question count</label>
          <input type="number" value={questionCount} onChange={(e) => setQuestionCount(parseInt(e.target.value))} min={1} max={200} />
        </div>
        <div className="flex-1">
          <label className="mb-2" style={{ display: 'block', fontWeight: 800 }}>Time limit (minutes)</label>
          <input type="number" value={timeLimit} onChange={(e) => setTimeLimit(parseInt(e.target.value))} min={1} max={300} />
        </div>
      </div>

      <button className="btn btn-primary w-full" style={{ width: '100%', padding: '1rem' }} onClick={handleCreate} disabled={creating || !selectedSubject || selectedSessions.length === 0}>
        {creating ? 'Creating...' : 'Create room & get code'}
      </button>
    </div>
  );
}

