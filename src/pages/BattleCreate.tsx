import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import type { ExamSession, Subject } from '../types/database.types';
import { shuffleSeeded } from '../lib/seedShuffle';
import { useI18n } from '../i18n/I18nProvider';

function genCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < 6; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

export default function BattleCreate() {
  const navigate = useNavigate();
  const { t } = useI18n();
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
    if (!selectedSubject) return alert(t('battleCreateSelectSubject'));
    if (selectedSessions.length === 0) return alert(t('battleCreateSelectSession'));
    if (questionCount <= 0) return alert(t('battleCreateQuestionCountInvalid'));

    setCreating(true);

    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) {
      setCreating(false);
      return alert(t('battleCreateNeedSignIn'));
    }

    // Fetch all questions from selected sessions
    const { data: qs, error } = await supabase
      .from('questions')
      .select('id, question_text')
      .in('session_id', selectedSessions);

    if (error || !qs || qs.length === 0) {
      setCreating(false);
      return alert(t('battleCreateLoadQuestionsError'));
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
      return alert(t('battleCreateCollisionError'));
    }

    // Seeded shuffle for fairness (same question set order)
    const chosen = shuffleSeeded(unique, `battle:${code}`).slice(0, Math.min(questionCount, unique.length));

    const inserts = chosen.map((q, idx) => ({ competition_id: competitionId, question_id: q.id, position: idx + 1 }));
    const { error: cqErr } = await supabase.from('competition_questions').insert(inserts);
    if (cqErr) {
      setCreating(false);
      return alert(t('battleCreateSaveQuestionError', { message: cqErr.message }));
    }

    // Admin creates room only — participants join via room list / code.

    setCreating(false);
    navigate(`/battle/${code}`);
  };

  return (
    <div className="animate-fade-in" style={{ padding: '2rem 1rem', maxWidth: '700px', margin: '0 auto' }}>
      <div className="glass-card" style={{ padding: '2.5rem', borderRadius: 'var(--radius-xl)' }}>
        <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <h2 style={{ fontSize: '1.8rem', fontWeight: 900, marginBottom: '0.5rem', background: 'var(--gradient-primary)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            {t('battleCreateTitle')}
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.95rem' }}>
            {t('battleCreateSubtitle')}
          </p>
        </div>

        <div className="auth-form" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div className="auth-input-group">
            <label>{t('battleCreateSubject')}</label>
            <select
              value={selectedSubject}
              onChange={(e) => {
                const id = e.target.value;
                setSelectedSubject(id);
                setSelectedSessions([]);
                setSessions([]);
                if (id) fetchSessions(id);
              }}
              style={{ width: '100%', padding: '0.85rem 1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', backgroundColor: '#f8fafc', fontWeight: 600, color: 'var(--text-primary)' }}
            >
              <option value="">{t('battleCreateChooseSubject')}</option>
              {subjects.map(s => (
                <option key={s.id} value={s.id}>{s.code} - {s.name}</option>
              ))}
            </select>
          </div>

          {selectedSubject && (
            <div className="auth-input-group">
              <label>{t('battleCreateSessions')}</label>
              <div style={{ maxHeight: '240px', overflowY: 'auto', border: '1px solid var(--border-color)', padding: '1rem', borderRadius: 'var(--radius-lg)', backgroundColor: '#f8fafc', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {sessions.length === 0 ? (
                  <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '1rem', fontWeight: 500, fontSize: '0.9rem' }}>
                    Loading...
                  </div>
                ) : (
                  sessions.map(s => (
                    <label key={s.id} style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', cursor: 'pointer', padding: '0.5rem', borderRadius: 'var(--radius-md)', background: 'white', border: '1px solid #e2e8f0', transition: 'all 0.2s', fontWeight: 600, color: 'var(--text-primary)' }}>
                      <input 
                        type="checkbox" 
                        style={{ width: '18px', height: '18px', accentColor: 'var(--primary-color)', cursor: 'pointer' }} 
                        checked={selectedSessions.includes(s.id)} 
                        onChange={() => toggleSession(s.id)} 
                      />
                      <span style={{ fontSize: '0.95rem' }}>{s.code} - {s.name}</span>
                    </label>
                  ))
                )}
              </div>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
             <div className="auth-input-group">
                <label>{t('battleCreateQuestionCount')}</label>
                <input
                  type="number"
                  min={1}
                  max={200}
                  value={questionCount}
                  onChange={(e) => setQuestionCount(Number(e.target.value))}
                  style={{ width: '100%', padding: '0.85rem 1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', backgroundColor: '#f8fafc', fontWeight: 800, color: 'var(--primary-color)' }}
                />
             </div>
             <div className="auth-input-group">
                <label>{t('battleCreateTimeLimit')}</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <input
                    type="number"
                    min={1}
                    max={300}
                    value={timeLimit}
                    onChange={(e) => setTimeLimit(Number(e.target.value))}
                    style={{ flex: 1, padding: '0.85rem 1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', backgroundColor: '#f8fafc', fontWeight: 800, color: 'var(--primary-color)' }}
                  />
                  <span style={{ fontWeight: 700, color: 'var(--text-secondary)' }}>min</span>
                </div>
             </div>
          </div>

          <div style={{ marginTop: '1rem' }}>
            <button
              onClick={handleCreate}
              disabled={creating || !selectedSubject || selectedSessions.length === 0 || questionCount <= 0}
              className="btn btn-primary"
              style={{ width: '100%', padding: '1rem', borderRadius: '999px', fontSize: '1.1rem', fontWeight: 800 }}
            >
              {creating ? t('battleCreating') : t('battleCreateBtn')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

