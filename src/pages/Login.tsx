import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { formatAuthError } from '../lib/authErrors';
import { loadOrCreateProfile } from '../lib/profile';

function safeRedirectPath(from: string | undefined): string | null {
  if (!from || from === '/login' || from === '/register') return null;
  return from;
}

export default function Login() {
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
      return alert('Signed in but user was not found. Try again.');
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
        <h2 style={{ marginBottom: '0.25rem' }}>Log in</h2>
        <div className="text-sm" style={{ color: 'var(--text-secondary)', fontWeight: 600, marginBottom: '1rem' }}>
          Sign in to take exams and view your history.
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
            <label style={{ display: 'block', fontWeight: 700, marginBottom: '0.35rem' }}>Email</label>
            <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required placeholder="you@example.com" />
          </div>
          <div>
            <label style={{ display: 'block', fontWeight: 700, marginBottom: '0.35rem' }}>Password</label>
            <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" required placeholder="••••••••" />
          </div>

          <button className="btn btn-primary" type="submit" disabled={loading} style={{ width: '100%', padding: '0.95rem', borderRadius: '999px' }}>
            {loading ? 'Signing in...' : 'Log in'}
          </button>
        </form>

        <div className="text-sm" style={{ marginTop: '1rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
          No account? <Link to="/register">Create one</Link>
        </div>
      </div>
    </div>
  );
}

