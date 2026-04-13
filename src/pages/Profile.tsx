import { useEffect, useState } from 'react';
import { UserRound, Save, Mail, Shield, User } from 'lucide-react';
import { useAuth } from '../auth/useAuth';
import { supabase } from '../lib/supabase';
import { useI18n } from '../i18n/I18nProvider';
import { useToast } from '../components/Toast';

export default function Profile() {
  const { user, profile, role, refreshProfile } = useAuth();
  const { t } = useI18n();
  const { toast } = useToast();
  const [fullName, setFullName] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setFullName(profile?.full_name || '');
  }, [profile?.full_name]);

  const handleSave = async () => {
    const nextName = fullName.trim();
    if (!user?.id) return;
    if (!nextName) {
      toast(t('profileEnterFullName'), 'warning');
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
      toast(t('profileSaveFailed', { message: error.message }), 'error');
      return;
    }

    await refreshProfile();
    toast(t('profileUpdated'), 'success');
  };

  return (
    <div className="animate-fade-in profile-page-container">
      <div className="profile-hero-new">
        <div className="profile-avatar-large">
          <UserRound size={48} />
        </div>
        <div className="profile-hero-text">
          <h2>{profile?.full_name || t('profileTitle')}</h2>
          <p>{t('profileSubtitle')}</p>
        </div>
      </div>

      <div className="profile-content-grid">
        {/* Left Col: Account Info */}
        <div className="profile-card">
          <h3 className="profile-section-title">{t('profileTitle')}</h3>
          
          <div className="profile-input-group">
            <label>{t('profileFullName')}</label>
            <div className="profile-input-wrap">
              <User size={18} className="profile-input-icon" />
              <input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder={t('profileFullNamePlaceholder')}
              />
            </div>
          </div>

          <div className="profile-actions">
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleSave}
              disabled={saving}
            >
              <Save size={18} /> {saving ? t('profileSaving') : t('profileSave')}
            </button>
          </div>
        </div>

        {/* Right Col: Account Details */}
        <div className="profile-card">
          <h3 className="profile-section-title">Account Details</h3>
          
          <div className="profile-details-list">
            <div className="profile-detail-item">
              <div className="detail-icon"><Mail size={18} /></div>
              <div className="detail-content">
                <div className="detail-label">Email Address</div>
                <div className="detail-value">{user?.email || t('profileNoEmail')}</div>
              </div>
            </div>

            <div className="profile-detail-item">
              <div className="detail-icon"><Shield size={18} /></div>
              <div className="detail-content">
                <div className="detail-label">Account Role</div>
                <div className="detail-value" style={{ textTransform: 'capitalize' }}>
                  {t('profileRole', { role: role || 'user' }).replace('Role:', '').trim()}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
