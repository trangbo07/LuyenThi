import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarCheck2, Flame, Sparkles, Swords, Trophy } from 'lucide-react';
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
  const { user } = useAuth();
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

  return (
    <div className="animate-fade-in home-shell">
      <section className="home-hero">
        <div>
          <div className="home-kicker"><Sparkles size={16} /> {t('homeKicker')}</div>
          <h1 style={{ marginBottom: '0.45rem' }}>{t('homeTitle')}</h1>
          <p className="text-muted" style={{ maxWidth: '60ch' }}>
            {t('homeSubtitle')}
          </p>
          <div className="flex gap-3 mt-6" style={{ flexWrap: 'wrap' }}>
            <button className="btn btn-primary" style={{ borderRadius: '999px' }} onClick={() => navigate('/generate')}>
              {t('homeStartExam')}
            </button>
            <button className="btn btn-secondary" style={{ borderRadius: '999px' }} onClick={() => navigate('/battle/join')}>
              <Swords size={16} /> {t('navJoinBattle')}
            </button>
          </div>
        </div>
        <div className="home-hero-badge">
          <Trophy size={18} /> {t('homeKeepStreak')}
        </div>
      </section>

      <section className="home-stats-grid">
        <article className="card home-stat-card">
          <div className="home-stat-label">{t('homeTotalAttempts')}</div>
          <div className="home-stat-value">{loading ? '...' : stats.total}</div>
        </article>
        <article className="card home-stat-card">
          <div className="home-stat-label">{t('homeAverageScore')}</div>
          <div className="home-stat-value">{loading ? '...' : stats.avg.toFixed(2)}</div>
        </article>
        <article className="card home-stat-card">
          <div className="home-stat-label">{t('homeBestScore')}</div>
          <div className="home-stat-value">{loading ? '...' : stats.best.toFixed(2)}</div>
        </article>
        <article className="card home-stat-card">
          <div className="home-stat-label">{t('homeCurrentStreak')}</div>
          <div className="home-stat-value"><Flame size={18} /> {loading ? '...' : stats.streak} {t('homeDay')}</div>
        </article>
      </section>

      <section className="card home-goal-card">
        <div className="flex justify-between items-center" style={{ gap: '0.8rem', flexWrap: 'wrap' }}>
          <div>
            <div className="home-stat-label"><CalendarCheck2 size={16} /> {t('homeDailyGoal')}</div>
            <div className="text-sm text-muted">{t('homeTodayAttempts', { count: stats.todayCount })}</div>
          </div>
          <div className="flex items-center gap-2">
            <label htmlFor="daily-goal" className="text-sm text-muted">{t('homeTarget')}</label>
            <input
              id="daily-goal"
              type="number"
              min={1}
              max={20}
              value={goal}
              onChange={(e) => setGoal(Math.min(20, Math.max(1, Number(e.target.value) || 1)))}
              style={{ width: '92px' }}
            />
          </div>
        </div>
        <div style={{ marginTop: '0.8rem' }}>
          <div className="progress-track">
            <div className="progress-fill" style={{ width: `${progress}%` }}></div>
          </div>
        </div>
      </section>
    </div>
  );
}
