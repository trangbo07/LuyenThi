import { useI18n } from '../i18n/I18nProvider';

type LanguageSwitcherProps = {
  compact?: boolean;
};

export default function LanguageSwitcher({ compact = false }: LanguageSwitcherProps) {
  const { language, setLanguage, t } = useI18n();

  return (
    <label className={`lang-switcher ${compact ? 'lang-switcher--compact' : ''}`}>
      <span className="lang-switcher-label">{t('langLabel')}</span>
      <select
        value={language}
        onChange={(e) => setLanguage(e.target.value as 'en' | 'vi')}
        className="lang-switcher-select"
      >
        <option value="en">{t('langEnglish')}</option>
        <option value="vi">{t('langVietnamese')}</option>
      </select>
    </label>
  );
}
