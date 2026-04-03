import { useI18n } from '../i18n/I18nProvider';

export default function LanguageSwitcher() {
  const { language, setLanguage, t } = useI18n();

  return (
    <label className="text-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
      {t('langLabel')}
      <select
        value={language}
        onChange={(e) => setLanguage(e.target.value as 'en' | 'vi')}
        style={{ width: 'auto', minWidth: '120px', padding: '0.4rem 0.55rem' }}
      >
        <option value="en">{t('langEnglish')}</option>
        <option value="vi">{t('langVietnamese')}</option>
      </select>
    </label>
  );
}
