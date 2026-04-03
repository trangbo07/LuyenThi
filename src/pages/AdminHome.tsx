import { Link } from 'react-router-dom';
import { Upload, Database, Swords, ClipboardList } from 'lucide-react';
import { useI18n } from '../i18n/I18nProvider';

export default function AdminHome() {
  const { t } = useI18n();
  const cards = [
    {
      to: '/admin/import',
      title: t('adminCardImportTitle'),
      description: t('adminCardImportDesc'),
      icon: Upload,
      color: '#4F46E5'
    },
    {
      to: '/admin/bank',
      title: t('adminCardBankTitle'),
      description: t('adminCardBankDesc'),
      icon: Database,
      color: '#0F766E'
    },
    {
      to: '/admin/battle/create',
      title: t('adminCardCreateBattleTitle'),
      description: t('adminCardCreateBattleDesc'),
      icon: Swords,
      color: '#C2410C'
    },
    {
      to: '/admin/battle/manage',
      title: t('adminCardManageRoomTitle'),
      description: t('adminCardManageRoomDesc'),
      icon: ClipboardList,
      color: '#7C3AED'
    }
  ];

  return (
    <div className="animate-fade-in">
      <div className="mb-6">
        <h2 style={{ margin: 0, fontSize: '1.35rem' }}>{t('adminOverview')}</h2>
        <p className="text-sm text-muted" style={{ fontWeight: 600, marginTop: '0.35rem' }}>
          {t('adminOverviewSubtitle')}
        </p>
      </div>

      <div className="admin-dashboard-grid">
        {cards.map(({ to, title, description, icon: Icon, color }) => (
          <Link key={to} to={to} className="admin-dashboard-card card" style={{ textDecoration: 'none' }}>
            <div className="admin-dashboard-card-icon" style={{ background: `${color}18`, color }}>
              <Icon size={26} />
            </div>
            <div style={{ fontWeight: 900, fontSize: '1.05rem', color: 'var(--text-primary)', marginBottom: '0.35rem' }}>
              {title}
            </div>
            <div className="text-sm text-muted" style={{ fontWeight: 600, lineHeight: 1.45 }}>
              {description}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
