import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { formatAuthError } from '../lib/authErrors';
import { loadOrCreateProfile } from '../lib/profile';
import { useI18n } from '../i18n/I18nProvider';

function safeRedirectPath(from: string | undefined): string | null {
  if (!from || from === '/login' || from === '/register') return null;
  return from;
}

export default function Login() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as { from?: string; message?: string } | null;
  const returnTo = safeRedirectPath(state?.from);
  const bannerMessage = state?.message;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setLoading(false);
      return alert(formatAuthError(error));
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return alert(t('loginMissingUser'));
    }

    const profile = await loadOrCreateProfile(user);
    const role = profile?.role ?? 'user';

    const destination =
      returnTo ?? (role === 'admin' ? '/admin' : '/generate');

    setLoading(false);
    navigate(destination, { replace: true });
  };

  return (
    <div className="animate-fade-in" style={{ maxWidth: '520px', margin: '0 auto' }}>
      <div className="glass-card" style={{ padding: '1.5rem' }}>
        <h2 style={{ marginBottom: '0.25rem' }}>{t('loginTitle')}</h2>
        <div className="text-sm" style={{ color: 'var(--text-secondary)', fontWeight: 600, marginBottom: '1rem' }}>
          {t('loginSubtitle')}
        </div>

        {bannerMessage && (
          <div
            role="status"
            style={{
              marginBottom: '1rem',
              padding: '0.75rem 1rem',
              borderRadius: 'var(--radius-md)',
              background: 'rgba(79, 70, 229, 0.08)',
              border: '1px solid rgba(79, 70, 229, 0.25)',
              color: 'var(--text-primary)',
              fontSize: '0.875rem',
              fontWeight: 600,
            }}
          >
            {bannerMessage}
          </div>
        )}

        <form onSubmit={onSubmit} className="grid gap-4">
          <div>
            <label style={{ display: 'block', fontWeight: 700, marginBottom: '0.35rem' }}>{t('loginEmail')}</label>
            <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required placeholder={t('loginEmailPlaceholder')} />
          </div>
          <div>
            <label style={{ display: 'block', fontWeight: 700, marginBottom: '0.35rem' }}>{t('loginPassword')}</label>
            <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" required placeholder={t('loginPasswordPlaceholder')} />
          </div>

          <button className="btn btn-primary" type="submit" disabled={loading} style={{ width: '100%', padding: '0.95rem', borderRadius: '999px' }}>
            {loading ? t('loginLoading') : t('loginButton')}
          </button>
        </form>

        <div className="text-sm" style={{ marginTop: '1rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
          {t('loginNoAccount')} <Link to="/register">{t('loginCreateOne')}</Link>
        </div>
      </div>
    </div>
  );
}

