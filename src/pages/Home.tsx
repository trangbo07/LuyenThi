import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarCheck2, Flame, Sparkles, Swords, Trophy, BookOpen, Brain, Clock } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../auth/useAuth';
import { useI18n } from '../i18n/I18nProvider';

type AttemptLite = {
  score: number;
  created_at?: string;
};

function dayKey(iso?: string) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function calcStreak(rows: AttemptLite[]) {
  const days = Array.from(new Set(rows.map((r) => dayKey(r.created_at)).filter(Boolean))).sort().reverse();
  if (days.length === 0) return 0;

  let streak = 0;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const allowedStart = new Set([dayKey(now.toISOString()), dayKey(yesterday.toISOString())]);
  if (!allowedStart.has(days[0])) return 0;

  let cursor = new Date(days[0]);
  while (true) {
    const k = dayKey(cursor.toISOString());
    if (!days.includes(k)) break;
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export default function Home() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const { user, profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [attempts, setAttempts] = useState<AttemptLite[]>([]);
  const [goal, setGoal] = useState<number>(() => {
    const raw = localStorage.getItem('exam_daily_goal');
    const parsed = Number(raw || 3);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 3;
  });

  useEffect(() => {
    localStorage.setItem('exam_daily_goal', String(goal));
  }, [goal]);

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from('attempts')
        .select('score, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(150);
      if (!cancelled) {
        setAttempts((data as AttemptLite[]) || []);
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const stats = useMemo(() => {
    const total = attempts.length;
    const avg = total ? attempts.reduce((sum, a) => sum + Number(a.score || 0), 0) / total : 0;
    const best = total ? Math.max(...attempts.map((a) => Number(a.score || 0))) : 0;
    const today = dayKey(new Date().toISOString());
    const todayCount = attempts.filter((a) => dayKey(a.created_at) === today).length;
    return {
      total,
      avg,
      best,
      todayCount,
      streak: calcStreak(attempts)
    };
  }, [attempts]);

  const progress = Math.min(100, Math.round((stats.todayCount / Math.max(1, goal)) * 100));
  const greeting = profile?.full_name ? `${t('homeTitle')}, ${profile.full_name}!` : t('homeTitle');

  return (
    <div className="animate-fade-in home-shell">
      {/* Hero Section */}
      <section className="home-hero-new">
        <div className="home-hero-text">
          <div className="home-kicker"><Sparkles size={16} /> {t('homeKicker')}</div>
          <h1>{greeting}</h1>
          <p className="text-muted" style={{ maxWidth: '55ch', marginBottom: '1.5rem' }}>
            {t('homeSubtitle')}
          </p>
        </div>
        <div className="home-hero-streak-badge">
          <Flame size={22} className="streak-flame" />
          <div>
            <div className="streak-number">{loading ? '...' : stats.streak}</div>
            <div className="streak-label">{t('homeDay')} streak</div>
          </div>
        </div>
      </section>

      {/* Quick Actions */}
      <section className="home-quick-actions">
        <button className="quick-action-card qa-exam" onClick={() => navigate('/generate')}>
          <div className="qa-icon"><BookOpen size={24} /></div>
          <div className="qa-text">
            <div className="qa-title">{t('homeStartExam')}</div>
            <div className="qa-desc">{t('homeSubtitle')}</div>
          </div>
        </button>
        <button className="quick-action-card qa-practice" onClick={() => navigate('/practice')}>
          <div className="qa-icon"><Brain size={24} /></div>
          <div className="qa-text">
            <div className="qa-title">Smart Practice</div>
            <div className="qa-desc">Master every question</div>
          </div>
        </button>
        <button className="quick-action-card qa-battle" onClick={() => navigate('/battle/join')}>
          <div className="qa-icon"><Swords size={24} /></div>
          <div className="qa-text">
            <div className="qa-title">{t('navJoinBattle')}</div>
            <div className="qa-desc">Compete with friends</div>
          </div>
        </button>
        <button className="quick-action-card qa-history" onClick={() => navigate('/history')}>
          <div className="qa-icon"><Clock size={24} /></div>
          <div className="qa-text">
            <div className="qa-title">{t('navHistory')}</div>
            <div className="qa-desc">Review past exams</div>
          </div>
        </button>
      </section>

      {/* Stats Grid */}
      <section className="home-stats-grid-new">
        <article className="home-stat-card-new">
          <div className="stat-card-icon" style={{ background: 'rgba(15,118,110,0.1)', color: 'var(--primary-color)' }}>
            <BookOpen size={20} />
          </div>
          <div>
            <div className="stat-card-value animate-count">{loading ? '...' : stats.total}</div>
            <div className="stat-card-label">{t('homeTotalAttempts')}</div>
          </div>
        </article>
        <article className="home-stat-card-new">
          <div className="stat-card-icon" style={{ background: 'rgba(16,185,129,0.1)', color: 'var(--success-color)' }}>
            <Trophy size={20} />
          </div>
          <div>
            <div className="stat-card-value animate-count">{loading ? '...' : stats.avg.toFixed(1)}</div>
            <div className="stat-card-label">{t('homeAverageScore')}</div>
          </div>
        </article>
        <article className="home-stat-card-new">
          <div className="stat-card-icon" style={{ background: 'rgba(245,158,11,0.1)', color: 'var(--accent-color)' }}>
            <Sparkles size={20} />
          </div>
          <div>
            <div className="stat-card-value animate-count">{loading ? '...' : stats.best.toFixed(1)}</div>
            <div className="stat-card-label">{t('homeBestScore')}</div>
          </div>
        </article>
      </section>

      {/* Daily Goal */}
      <section className="home-goal-card-new">
        <div className="goal-header">
          <div className="goal-info">
            <CalendarCheck2 size={20} />
            <div>
              <div className="goal-title">{t('homeDailyGoal')}</div>
              <div className="goal-progress-text">{stats.todayCount} / {goal} {t('homeTodayAttempts', { count: stats.todayCount }).replace(/^.*?(\d+).*$/, '').trim() || 'completed'}</div>
            </div>
          </div>
          <div className="goal-input-wrap">
            <label htmlFor="daily-goal">{t('homeTarget')}</label>
            <input
              id="daily-goal"
              type="number"
              min={1}
              max={20}
              value={goal}
              onChange={(e) => setGoal(Math.min(20, Math.max(1, Number(e.target.value) || 1)))}
            />
          </div>
        </div>
        <div className="goal-bar-wrapper">
          <div className="goal-bar-track">
            <div className="goal-bar-fill" style={{ width: `${progress}%` }} />
          </div>
          <span className="goal-percent">{progress}%</span>
        </div>
      </section>
    </div>
  );
}
