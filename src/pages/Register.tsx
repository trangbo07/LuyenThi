import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { formatAuthError } from '../lib/authErrors';
import { upsertProfileForUserId } from '../lib/profile';
import { useI18n } from '../i18n/I18nProvider';
import { BookOpen, UserPlus, Mail, Lock, User } from 'lucide-react';

export default function Register() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!isSupabaseConfigured()) {
      setError(t('registerSupabaseNotConfigured'));
      return;
    }

    const emailTrim = email.trim();
    if (password.length < 6) {
      setError(t('registerPasswordShort'));
      return;
    }

    setLoading(true);

    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const { data, error: signErr } = await supabase.auth.signUp({
      email: emailTrim,
      password,
      options: {
        emailRedirectTo: origin ? `${origin}/login` : undefined,
        data: {
          full_name: fullName.trim(),
        },
      },
    });

    if (signErr) {
      setLoading(false);
      setError(formatAuthError(signErr));
      return;
    }

    const uid = data.user?.id;
    if (!uid) {
      setLoading(false);
      setError(t('registerNoUserId'));
      return;
    }

    // With a session, RLS allows insert: same uuid as auth.uid() — always upsert profile (role user).
    if (data.session) {
      const { error: profileErr } = await upsertProfileForUserId(uid, fullName.trim() || 'User', 'user');
      if (profileErr) {
        console.warn('profiles upsert:', profileErr);
        setError(
          formatAuthError(profileErr) +
            ' Your account may exist; try signing in. If it persists, run Supabase migrations for the profiles table.'
        );
        setLoading(false);
        return;
      }
    }

    setLoading(false);

    if (data.session) {
      navigate('/generate', { replace: true });
      return;
    }

    navigate('/login', {
      replace: true,
      state: {
        message: t('registerEmailConfirmMessage'),
      },
    });
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
          <p className="auth-brand-subtitle">{t('registerSubtitle')}</p>
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
            <h2>{t('registerTitle')}</h2>
            <p className="text-muted">{t('registerSubtitle')}</p>
          </div>

          {!isSupabaseConfigured() && (
            <div className="auth-error">{t('registerMissingEnv')}</div>
          )}

          {error && (
            <div className="auth-error">{error}</div>
          )}

          <form onSubmit={onSubmit} className="auth-form">
            <div className="auth-input-group">
              <label>{t('registerFullName')}</label>
              <div className="auth-input-icon-wrap">
                <User size={18} className="auth-input-icon" />
                <input
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                  placeholder={t('registerFullNamePlaceholder')}
                />
              </div>
            </div>

            <div className="auth-input-group">
              <label>{t('registerEmail')}</label>
              <div className="auth-input-icon-wrap">
                <Mail size={18} className="auth-input-icon" />
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  type="email"
                  required
                  autoComplete="email"
                  placeholder={t('registerEmailPlaceholder')}
                />
              </div>
            </div>

            <div className="auth-input-group">
              <label>{t('registerPassword')}</label>
              <div className="auth-input-icon-wrap">
                <Lock size={18} className="auth-input-icon" />
                <input
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  type="password"
                  required
                  minLength={6}
                  autoComplete="new-password"
                  placeholder={t('registerPasswordHint')}
                />
              </div>
            </div>

            <button className="btn btn-primary auth-submit-btn" type="submit" disabled={loading}>
              <UserPlus size={18} />
              {loading ? t('registerCreating') : t('registerCreate')}
            </button>
          </form>

          <div className="auth-footer">
            {t('registerHaveAccount')} <Link to="/login">{t('registerSignIn')}</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
