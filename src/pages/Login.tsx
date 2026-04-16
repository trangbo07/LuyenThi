import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { formatAuthError } from '../lib/authErrors';
import { loadOrCreateProfile } from '../lib/profile';
import { useI18n } from '../i18n/I18nProvider';
import { useToast } from '../components/Toast';
import { BookOpen, LogIn, Mail, Lock } from 'lucide-react';

function safeRedirectPath(from: string | undefined): string | null {
  if (!from || from === '/login' || from === '/register') return null;
  return from;
}

export default function Login() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { toast } = useToast();
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
      toast(formatAuthError(error), 'error');
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      toast(t('loginMissingUser'), 'error');
      return;
    }

    const profile = await loadOrCreateProfile(user);
    const role = profile?.role ?? 'user';

    const destination =
      returnTo ?? (role === 'admin' ? '/admin' : '/generate');

    setLoading(false);
    navigate(destination, { replace: true });
  };

  return (
    <div className="auth-page">
      {/* Left: Branding */}
      <div className="auth-brand">
        <div className="auth-brand-content">
          <div className="auth-brand-icon">
            <BookOpen size={40} />
          </div>
          <h1 className="auth-brand-title">Exam System Pro</h1>
          <p className="auth-brand-subtitle">{t('loginSubtitle')}</p>
          <div className="auth-brand-features">
            <div className="auth-feature-item">
              <span className="auth-feature-dot" />
              {t('homeKicker')}
            </div>
            <div className="auth-feature-item">
              <span className="auth-feature-dot" />
              Smart Practice Mode
            </div>
            <div className="auth-feature-item">
              <span className="auth-feature-dot" />
              Battle & Competition
            </div>
          </div>
        </div>
        <div className="auth-brand-decoration" />
      </div>

      {/* Right: Form */}
      <div className="auth-form-wrapper">
        <div className="auth-form-card animate-fade-in">
          <div className="auth-form-header">
            <h2>{t('loginTitle')}</h2>
            <p className="text-muted">{t('loginSubtitle')}</p>
          </div>

          {bannerMessage && (
            <div className="auth-banner">
              {bannerMessage}
            </div>
          )}

          <form onSubmit={onSubmit} className="auth-form">
            <div className="auth-input-group">
              <label>{t('loginEmail')}</label>
              <div className="auth-input-icon-wrap">
                <Mail size={18} className="auth-input-icon" />
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  type="email"
                  required
                  placeholder={t('loginEmailPlaceholder')}
                />
              </div>
            </div>

            <div className="auth-input-group">
              <label>{t('loginPassword')}</label>
              <div className="auth-input-icon-wrap">
                <Lock size={18} className="auth-input-icon" />
                <input
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  type="password"
                  required
                  placeholder={t('loginPasswordPlaceholder')}
                />
              </div>
            </div>

            <button className="btn btn-primary auth-submit-btn" type="submit" disabled={loading}>
              <LogIn size={18} />
              {loading ? t('loginLoading') : t('loginButton')}
            </button>
          </form>

          <div className="auth-footer">
            {t('loginNoAccount')} <Link to="/register">{t('loginCreateOne')}</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
