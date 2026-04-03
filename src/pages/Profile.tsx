import { useEffect, useState } from 'react';
import { UserRound, Save, Mail, Shield } from 'lucide-react';
import { useAuth } from '../auth/useAuth';
import { supabase } from '../lib/supabase';

export default function Profile() {
  const { user, profile, role, refreshProfile } = useAuth();
  const [fullName, setFullName] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setFullName(profile?.full_name || '');
  }, [profile?.full_name]);

  const handleSave = async () => {
    const nextName = fullName.trim();
    if (!user?.id) return;
    if (!nextName) {
      alert('Please enter your full name.');
      return;
    }

    setSaving(true);
    const { error } = await supabase
      .from('profiles')
      .upsert({
        id: user.id,
        full_name: nextName,
        role: role || 'user'
      }, { onConflict: 'id' });

    setSaving(false);

    if (error) {
      alert('Could not save profile: ' + error.message);
      return;
    }

    await refreshProfile();
    alert('Profile updated.');
  };

  return (
    <div className="animate-fade-in" style={{ maxWidth: '760px', margin: '0 auto' }}>
      <div className="glass-card profile-hero">
        <div className="profile-avatar">
          <UserRound size={30} />
        </div>
        <div>
          <h2 style={{ marginBottom: '0.2rem' }}>My profile</h2>
          <p className="text-muted" style={{ margin: 0 }}>Manage your account information.</p>
        </div>
      </div>

      <div className="card profile-form-card">
        <div className="grid gap-4">
          <div>
            <label className="profile-label">Full name</label>
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Enter your full name"
            />
          </div>

          <div className="profile-info-grid">
            <div className="profile-info-chip">
              <Mail size={16} />
              <span>{user?.email || 'No email'}</span>
            </div>
            <div className="profile-info-chip">
              <Shield size={16} />
              <span>Role: {role || 'user'}</span>
            </div>
          </div>

          <div>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleSave}
              disabled={saving}
              style={{ borderRadius: '999px' }}
            >
              <Save size={17} /> {saving ? 'Saving...' : 'Save profile'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
