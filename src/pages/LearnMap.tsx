import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../auth/useAuth';
import type { Subject, ExamSession, MockProgress } from '../types/database.types';
import { BookOpen, Lock, Star, ChevronRight, CheckCircle, Trophy } from 'lucide-react';

export const MOCK_SIZE = 25;

export default function LearnMap() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();

  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [sessions, setSessions] = useState<ExamSession[]>([]);
  const [selectedSubject, setSelectedSubject] = useState('');
  const [selectedSession, setSelectedSession] = useState('');
  const [questionCount, setQuestionCount] = useState(0);
  const [progress, setProgress] = useState<MockProgress[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const initSessionId = searchParams.get('session');
    supabase.from('subjects').select('*').order('name').then(async ({ data: subs }) => {
      if (subs) setSubjects(subs);
      if (initSessionId && subs && user?.id) {
        // Find the session to get its subject_id
        const { data: sess } = await supabase.from('exam_sessions').select('*').eq('id', initSessionId).maybeSingle();
        if (sess) {
          setSelectedSubject(sess.subject_id);
          const { data: allSessions } = await supabase.from('exam_sessions').select('*').eq('subject_id', sess.subject_id).order('name');
          if (allSessions) setSessions(allSessions);
          setSelectedSession(initSessionId);
          setLoading(true);
          const [{ count }, { data: prog }] = await Promise.all([
            supabase.from('questions').select('*', { count: 'exact', head: true }).eq('session_id', initSessionId),
            supabase.from('mock_progress').select('*').eq('user_id', user.id).eq('session_id', initSessionId),
          ]);
          setQuestionCount(count ?? 0);
          setProgress((prog as MockProgress[]) || []);
          setLoading(false);
          // Clean up the URL
          setSearchParams({}, { replace: true });
        }
      }
    });
  }, []);

  const handleSubjectChange = async (subId: string) => {
    setSelectedSubject(subId);
    setSelectedSession('');
    setQuestionCount(0);
    setProgress([]);
    if (!subId) { setSessions([]); return; }
    const { data } = await supabase.from('exam_sessions').select('*').eq('subject_id', subId).order('name');
    if (data) setSessions(data);
  };

  const handleSessionChange = async (sessId: string) => {
    setSelectedSession(sessId);
    setQuestionCount(0);
    setProgress([]);
    if (!sessId || !user?.id) return;

    setLoading(true);
    const [{ count }, { data: prog }] = await Promise.all([
      supabase.from('questions').select('*', { count: 'exact', head: true }).eq('session_id', sessId),
      supabase.from('mock_progress').select('*').eq('user_id', user.id).eq('session_id', sessId),
    ]);
    setQuestionCount(count ?? 0);
    setProgress((prog as MockProgress[]) || []);
    setLoading(false);
  };

  const totalMocks = Math.ceil(questionCount / MOCK_SIZE);
  const progressMap = Object.fromEntries(progress.map(p => [p.mock_index, p]));
  const completedMocks = progress.filter(p => p.stars > 0).length;
  const overallPercent = totalMocks > 0 ? Math.round((completedMocks / totalMocks) * 100) : 0;

  const isMockAvailable = (idx: number) => {
    if (idx === 0) return true;
    return (progressMap[idx - 1]?.stars ?? 0) > 0;
  };

  return (
    <div className="animate-fade-in" style={{ maxWidth: '860px', margin: '0 auto' }}>
      {/* Hero */}
      <div className="glass-card" style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem', padding: '1.25rem 1.5rem' }}>
        <div style={{ width: 50, height: 50, borderRadius: '50%', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', flexShrink: 0 }}>
          <BookOpen size={26} />
        </div>
        <div>
          <h2 style={{ margin: 0 }}>Học theo Mock</h2>
          <p className="text-muted" style={{ margin: 0, fontSize: '0.9rem' }}>Học từng phần nhỏ → luyện quiz → mở khóa level tiếp</p>
        </div>
      </div>

      {/* Selector */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <div>
            <label className="profile-label">Môn học</label>
            <select value={selectedSubject} onChange={e => handleSubjectChange(e.target.value)}>
              <option value="">-- Chọn môn --</option>
              {subjects.map(s => <option key={s.id} value={s.id}>{s.code} – {s.name}</option>)}
            </select>
          </div>
          {selectedSubject && (
            <div>
              <label className="profile-label">Bộ câu hỏi</label>
              <select value={selectedSession} onChange={e => handleSessionChange(e.target.value)}>
                <option value="">-- Chọn bộ đề --</option>
                {sessions.map(s => <option key={s.id} value={s.id}>{s.code} – {s.name}</option>)}
              </select>
            </div>
          )}
        </div>
      </div>

      {loading && (
        <div className="card text-center" style={{ padding: '2rem', color: 'var(--text-secondary)' }}>Đang tải...</div>
      )}

      {selectedSession && !loading && questionCount === 0 && (
        <div className="card text-center" style={{ padding: '2rem', color: 'var(--text-secondary)' }}>
          Bộ đề này chưa có câu hỏi nào.
        </div>
      )}

      {selectedSession && !loading && questionCount > 0 && (
        <>
          {/* Overall progress */}
          <div className="card" style={{ marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, marginBottom: '0.5rem' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Trophy size={16} /> Tiến độ tổng thể
              </span>
              <span style={{ color: overallPercent === 100 ? 'var(--success-color)' : 'var(--primary-color)', fontSize: '1.1rem' }}>
                {overallPercent}%
              </span>
            </div>
            <div className="progress-track">
              <div
                className="progress-fill"
                style={{
                  width: `${overallPercent}%`,
                  background: overallPercent === 100 ? 'var(--success-color)' : undefined,
                  transition: 'width 0.5s ease',
                }}
              />
            </div>
            <div className="text-muted" style={{ fontSize: '0.85rem', marginTop: '0.4rem' }}>
              {completedMocks}/{totalMocks} mock hoàn thành &nbsp;·&nbsp; {questionCount} câu hỏi &nbsp;·&nbsp; {MOCK_SIZE} câu/mock
            </div>
          </div>

          {/* Mock grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '0.85rem' }}>
            {Array.from({ length: totalMocks }).map((_, idx) => {
              const prog = progressMap[idx];
              const available = isMockAvailable(idx);
              const passed = (prog?.stars ?? 0) > 0;
              const start = idx * MOCK_SIZE + 1;
              const end = Math.min((idx + 1) * MOCK_SIZE, questionCount);

              return (
                <button
                  key={idx}
                  className="card"
                  disabled={!available}
                  onClick={() => navigate(`/learn/${selectedSession}/mock/${idx}/study`)}
                  style={{
                    textAlign: 'left',
                    cursor: available ? 'pointer' : 'not-allowed',
                    opacity: available ? 1 : 0.45,
                    border: passed
                      ? '2px solid var(--success-color)'
                      : available
                      ? '2px solid var(--primary-color)'
                      : '2px solid var(--border-color)',
                    position: 'relative',
                    transition: 'transform 0.15s, box-shadow 0.15s',
                  }}
                >
                  {passed && (
                    <div style={{ position: 'absolute', top: 10, right: 10 }}>
                      <CheckCircle size={17} color="var(--success-color)" />
                    </div>
                  )}
                  {!available && (
                    <div style={{ position: 'absolute', top: 10, right: 10 }}>
                      <Lock size={15} color="var(--text-secondary)" />
                    </div>
                  )}

                  <div style={{ fontWeight: 800, fontSize: '1rem', marginBottom: '0.2rem' }}>
                    Mock {idx + 1}
                  </div>
                  <div className="text-muted" style={{ fontSize: '0.82rem', marginBottom: '0.6rem' }}>
                    Câu {start}–{end} &nbsp;({end - start + 1} câu)
                  </div>

                  {passed ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                      {[1, 2, 3].map(s => (
                        <Star key={s} size={15} fill={s <= (prog?.stars ?? 0) ? '#f59e0b' : 'none'} color="#f59e0b" />
                      ))}
                      <span style={{ fontSize: '0.8rem', marginLeft: 4, color: 'var(--text-secondary)' }}>
                        {Math.round(prog!.best_score)}%
                      </span>
                    </div>
                  ) : available ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--primary-color)', fontSize: '0.85rem', fontWeight: 700 }}>
                      Bắt đầu <ChevronRight size={14} />
                    </div>
                  ) : (
                    <div className="text-muted" style={{ fontSize: '0.82rem' }}>
                      Hoàn thành mock {idx} trước
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
