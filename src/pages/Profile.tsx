import { useEffect, useState } from 'react';
import { UserRound, Save, Mail, Shield } from 'lucide-react';
import { useAuth } from '../auth/useAuth';
import { supabase } from '../lib/supabase';
import { useI18n } from '../i18n/I18nProvider';

export default function Profile() {
  const { user, profile, role, refreshProfile } = useAuth();
  const { t } = useI18n();
  const [fullName, setFullName] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setFullName(profile?.full_name || '');
  }, [profile?.full_name]);

  const handleSave = async () => {
    const nextName = fullName.trim();
    if (!user?.id) return;
    if (!nextName) {
      alert(t('profileEnterFullName'));
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
      alert(t('profileSaveFailed', { message: error.message }));
      return;
    }

    await refreshProfile();
    alert(t('profileUpdated'));
  };

  return (
    <div className="animate-fade-in" style={{ maxWidth: '760px', margin: '0 auto' }}>
      <div className="glass-card profile-hero">
        <div className="profile-avatar">
          <UserRound size={30} />
        </div>
        <div>
          <h2 style={{ marginBottom: '0.2rem' }}>{t('profileTitle')}</h2>
          <p className="text-muted" style={{ margin: 0 }}>{t('profileSubtitle')}</p>
        </div>
      </div>

      <div className="card profile-form-card">
        <div className="grid gap-4">
          <div>
            <label className="profile-label">{t('profileFullName')}</label>
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder={t('profileFullNamePlaceholder')}
            />
          </div>

          <div className="profile-info-grid">
            <div className="profile-info-chip">
              <Mail size={16} />
              <span>{user?.email || t('profileNoEmail')}</span>
            </div>
            <div className="profile-info-chip">
              <Shield size={16} />
              <span>{t('profileRole', { role: role || 'user' })}</span>
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
              <Save size={17} /> {saving ? t('profileSaving') : t('profileSave')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
