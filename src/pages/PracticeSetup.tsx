import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../auth/useAuth';
import { useI18n } from '../i18n/I18nProvider';
import type { Subject, ExamSession, QuestionMastery } from '../types/database.types';
import { GraduationCap, RotateCcw, Shuffle, AlertTriangle, ChevronRight } from 'lucide-react';

type SessionStats = {
  total: number;
  mastered: number;
  wrong: number;
  untouched: number;
};

export default function PracticeSetup() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const { user } = useAuth();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [sessions, setSessions] = useState<ExamSession[]>([]);
  const [selectedSubject, setSelectedSubject] = useState('');
  const [selectedSession, setSelectedSession] = useState('');
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<SessionStats | null>(null);
  const [masteryRows, setMasteryRows] = useState<QuestionMastery[]>([]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('subjects').select('*').order('name');
      if (data) setSubjects(data);
    })();
  }, []);

  const handleSubjectChange = async (subId: string) => {
    setSelectedSubject(subId);
    setSelectedSession('');
    setStats(null);
    setMasteryRows([]);
    if (!subId) {
      setSessions([]);
      return;
    }
    const { data } = await supabase.from('exam_sessions').select('*').eq('subject_id', subId).order('name');
    if (data) setSessions(data);
  };

  const handleSessionChange = async (sessId: string) => {
    setSelectedSession(sessId);
    setStats(null);
    setMasteryRows([]);
    if (!sessId || !user?.id) return;

    setLoading(true);

    // Get question count for this session
    const { count } = await supabase
      .from('questions')
      .select('*', { count: 'exact', head: true })
      .eq('session_id', sessId);

    const total = count ?? 0;

    // Get mastery data
    const { data: mastery } = await supabase
      .from('question_mastery')
      .select('*')
      .eq('user_id', user.id)
      .eq('session_id', sessId);

    const rows = (mastery as QuestionMastery[]) || [];
    setMasteryRows(rows);

    const mastered = rows.filter(r => r.is_mastered).length;
    const wrong = rows.filter(r => r.last_answer_correct === false).length;
    const untouched = total - rows.length;

    setStats({ total, mastered, wrong, untouched });
    setLoading(false);
  };

  const masteryPercent = useMemo(() => {
    if (!stats || stats.total === 0) return 0;
    return Math.round((stats.mastered / stats.total) * 100);
  }, [stats]);

  const startPractice = (mode: 'all' | 'wrong' | 'confusing') => {
    navigate('/practice/session', {
      state: {
        subjectId: selectedSubject,
        sessionId: selectedSession,
        mode,
      },
    });
  };

  const wrongCount = useMemo(() => {
    return masteryRows.filter(r => r.last_answer_correct === false || (!r.is_mastered && r.total_attempts > 0)).length;
  }, [masteryRows]);

  return (
    <div className="animate-fade-in" style={{ maxWidth: '760px', margin: '0 auto' }}>
      <div className="glass-card practice-hero">
        <div className="practice-hero-icon">
          <GraduationCap size={30} />
        </div>
        <div>
          <h2 style={{ marginBottom: '0.2rem' }}>{t('practiceTitle')}</h2>
          <p className="text-muted" style={{ margin: 0 }}>{t('practiceSubtitle')}</p>
        </div>
      </div>

      <div className="card" style={{ marginTop: '1.5rem' }}>
        <div className="grid gap-4">
          <div>
            <label className="profile-label">{t('practiceSubject')}</label>
            <select value={selectedSubject} onChange={(e) => handleSubjectChange(e.target.value)}>
              <option value="">{t('generateChooseSubject')}</option>
              {subjects.map(s => <option key={s.id} value={s.id}>{s.code} - {s.name}</option>)}
            </select>
          </div>

          {selectedSubject && (
            <div>
              <label className="profile-label">{t('practiceSession')}</label>
              <select value={selectedSession} onChange={(e) => handleSessionChange(e.target.value)}>
                <option value="">{t('practiceChooseSession')}</option>
                {sessions.map(s => <option key={s.id} value={s.id}>{s.code} - {s.name}</option>)}
              </select>
            </div>
          )}
        </div>
      </div>

      {loading && (
        <div className="card text-center" style={{ marginTop: '1.5rem', padding: '2rem' }}>
          {t('practiceLoading')}
        </div>
      )}

      {stats && !loading && (
        <>
          {/* Stats overview */}
          <div className="card" style={{ marginTop: '1.5rem' }}>
            <div style={{ fontWeight: 900, marginBottom: '0.75rem', fontSize: '1.05rem' }}>
              {t('practiceMasteryOverview')}
            </div>

            <div className="practice-stats-grid">
              <div className="practice-stat-item">
                <div className="practice-stat-num">{stats.total}</div>
                <div className="practice-stat-label">{t('practiceTotalQuestions')}</div>
              </div>
              <div className="practice-stat-item practice-stat-mastered">
                <div className="practice-stat-num">{stats.mastered}</div>
                <div className="practice-stat-label">{t('practiceMastered')}</div>
              </div>
              <div className="practice-stat-item practice-stat-wrong">
                <div className="practice-stat-num">{stats.wrong}</div>
                <div className="practice-stat-label">{t('practiceWrong')}</div>
              </div>
              <div className="practice-stat-item practice-stat-untouched">
                <div className="practice-stat-num">{stats.untouched}</div>
                <div className="practice-stat-label">{t('practiceUntouched')}</div>
              </div>
            </div>

            <div style={{ marginTop: '1rem' }}>
              <div className="flex justify-between text-sm" style={{ fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>
                <span>{t('practiceMasteryProgress')}</span>
                <span>{masteryPercent}%</span>
              </div>
              <div className="progress-track">
                <div className="progress-fill" style={{ width: `${masteryPercent}%`, background: masteryPercent === 100 ? 'var(--success-color)' : undefined }}></div>
              </div>
            </div>
          </div>

          {/* Practice modes */}
          <div className="grid gap-3" style={{ marginTop: '1.5rem' }}>
            <button
              className="card practice-mode-card"
              onClick={() => startPractice('all')}
              disabled={stats.total === 0}
            >
              <div className="practice-mode-icon" style={{ background: 'rgba(14, 165, 233, 0.12)', color: '#0ea5e9' }}>
                <Shuffle size={24} />
              </div>
              <div className="practice-mode-info">
                <div className="practice-mode-title">{t('practiceModeAll')}</div>
                <div className="practice-mode-desc">{t('practiceModeAllDesc', { count: stats.total })}</div>
              </div>
              <ChevronRight size={20} className="practice-mode-arrow" />
            </button>

            <button
              className="card practice-mode-card"
              onClick={() => startPractice('wrong')}
              disabled={wrongCount === 0}
            >
              <div className="practice-mode-icon" style={{ background: 'rgba(239, 68, 68, 0.12)', color: '#ef4444' }}>
                <RotateCcw size={24} />
              </div>
              <div className="practice-mode-info">
                <div className="practice-mode-title">{t('practiceModeWrong')}</div>
                <div className="practice-mode-desc">{t('practiceModeWrongDesc', { count: wrongCount })}</div>
              </div>
              <ChevronRight size={20} className="practice-mode-arrow" />
            </button>

            <button
              className="card practice-mode-card"
              onClick={() => startPractice('confusing')}
              disabled={stats.total === 0}
            >
              <div className="practice-mode-icon" style={{ background: 'rgba(245, 158, 11, 0.12)', color: '#f59e0b' }}>
                <AlertTriangle size={24} />
              </div>
              <div className="practice-mode-info">
                <div className="practice-mode-title">{t('practiceModeConfusing')}</div>
                <div className="practice-mode-desc">{t('practiceModeConfusingDesc')}</div>
              </div>
              <ChevronRight size={20} className="practice-mode-arrow" />
            </button>
          </div>

          {/* Progress link */}
          <div style={{ marginTop: '1rem', textAlign: 'center' }}>
            <button
              className="btn btn-secondary"
              style={{ borderRadius: '999px' }}
              onClick={() => navigate('/practice/progress', { state: { subjectId: selectedSubject, sessionId: selectedSession } })}
            >
              {t('practiceViewProgress')}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
