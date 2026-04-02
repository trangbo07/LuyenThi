import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

export default function Register() {
  const navigate = useNavigate();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName.trim()
        }
      }
    });

    if (error) {
      setLoading(false);
      return alert('Could not create account: ' + error.message);
    }

    // If sign-up returns a session (email confirmation disabled), upsert profile client-side.
    // (DB trigger handle_new_user also creates profile — upsert avoids duplicates / fallback if migration missing.)
    const uid = data.user?.id;
    if (uid && data.session) {
      const { error: profileErr } = await supabase.from('profiles').upsert(
        { id: uid, full_name: fullName.trim(), role: 'user' },
        { onConflict: 'id' }
      );
      if (profileErr) {
        console.warn('profiles upsert:', profileErr);
      }
    }

    setLoading(false);
    alert(
      data.session
        ? 'Account created. You can sign in now.'
        : 'If email confirmation is enabled, check your inbox. After confirming, sign in — your profile will be created automatically.'
    );
    navigate('/login');
  };

  return (
    <div className="animate-fade-in" style={{ maxWidth: '520px', margin: '0 auto' }}>
      <div className="glass-card" style={{ padding: '1.5rem' }}>
        <h2 style={{ marginBottom: '0.25rem' }}>Create account</h2>
        <div className="text-sm" style={{ color: 'var(--text-secondary)', fontWeight: 600, marginBottom: '1rem' }}>
          New accounts default to role <b>user</b>.
        </div>

        <form onSubmit={onSubmit} className="grid gap-4">
          <div>
            <label style={{ display: 'block', fontWeight: 700, marginBottom: '0.35rem' }}>Full name</label>
            <input value={fullName} onChange={(e) => setFullName(e.target.value)} required placeholder="Jane Doe" />
          </div>
          <div>
            <label style={{ display: 'block', fontWeight: 700, marginBottom: '0.35rem' }}>Email</label>
            <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required placeholder="you@example.com" />
          </div>
          <div>
            <label style={{ display: 'block', fontWeight: 700, marginBottom: '0.35rem' }}>Password</label>
            <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" required placeholder="At least 6 characters" />
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

