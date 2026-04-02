import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as any)?.from || '/generate';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) return alert('Sign-in failed: ' + error.message);
    navigate(from, { replace: true });
  };

  return (
    <div className="animate-fade-in" style={{ maxWidth: '520px', margin: '0 auto' }}>
      <div className="glass-card" style={{ padding: '1.5rem' }}>
        <h2 style={{ marginBottom: '0.25rem' }}>Log in</h2>
        <div className="text-sm" style={{ color: 'var(--text-secondary)', fontWeight: 600, marginBottom: '1rem' }}>
          Sign in to take exams and view your history.
        </div>

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

