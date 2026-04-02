import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { formatAuthError } from '../lib/authErrors';
import { upsertProfileForUserId } from '../lib/profile';

export default function Register() {
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
      setError(
        'Supabase is not configured. Create a .env file with VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (see .env.example), restart npm run dev, and try again.'
      );
      return;
    }

    const emailTrim = email.trim();
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
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
      setError('Sign-up succeeded but no user id was returned. Try signing in.');
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
    // No session yet (email confirmation): DB trigger handle_new_user should insert profiles; if not, first login runs loadOrCreateProfile in AuthProvider.

    setLoading(false);

    if (data.session) {
      navigate('/generate', { replace: true });
      return;
    }

    navigate('/login', {
      replace: true,
      state: {
        message:
          'If email confirmation is enabled, check your inbox and confirm. After you sign in, your profile will be created if it is still missing.',
      },
    });
  };

  return (
    <div className="animate-fade-in" style={{ maxWidth: '520px', margin: '0 auto' }}>
      <div className="glass-card" style={{ padding: '1.5rem' }}>
        <h2 style={{ marginBottom: '0.25rem' }}>Create account</h2>
        <div className="text-sm" style={{ color: 'var(--text-secondary)', fontWeight: 600, marginBottom: '1rem' }}>
          New accounts default to role <b>user</b>.
        </div>

        {!isSupabaseConfigured() && (
          <div
            role="status"
            style={{
              marginBottom: '1rem',
              padding: '0.75rem 1rem',
              borderRadius: 'var(--radius-md)',
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.35)',
              color: '#991b1b',
              fontSize: '0.875rem',
              fontWeight: 600,
            }}
          >
            Missing Supabase env vars. Copy .env.example to .env and set your project URL and anon key.
          </div>
        )}

        {error && (
          <div
            role="alert"
            style={{
              marginBottom: '1rem',
              padding: '0.75rem 1rem',
              borderRadius: 'var(--radius-md)',
              background: 'rgba(239, 68, 68, 0.08)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: '#b91c1c',
              fontSize: '0.875rem',
              fontWeight: 600,
              whiteSpace: 'pre-wrap',
            }}
          >
            {error}
          </div>
        )}

        <form onSubmit={onSubmit} className="grid gap-4">
          <div>
            <label style={{ display: 'block', fontWeight: 700, marginBottom: '0.35rem' }}>Full name</label>
            <input value={fullName} onChange={(e) => setFullName(e.target.value)} required placeholder="Jane Doe" />
          </div>
          <div>
            <label style={{ display: 'block', fontWeight: 700, marginBottom: '0.35rem' }}>Email</label>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              required
              autoComplete="email"
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label style={{ display: 'block', fontWeight: 700, marginBottom: '0.35rem' }}>Password</label>
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              required
              minLength={6}
              autoComplete="new-password"
              placeholder="At least 6 characters"
            />
          </div>

          <button className="btn btn-primary" type="submit" disabled={loading} style={{ width: '100%', padding: '0.95rem', borderRadius: '999px' }}>
            {loading ? 'Creating...' : 'Create account'}
          </button>
        </form>

        <div className="text-sm" style={{ marginTop: '1rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
          Already have an account? <Link to="/login">Log in</Link>
        </div>
      </div>
    </div>
  );
}
