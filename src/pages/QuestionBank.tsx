import { useState } from 'react';
import SubjectManager from '../components/SubjectManager';
import SessionManager from '../components/SessionManager';
import QuestionList from '../components/QuestionList';
import QuestionConfusionChecker from '../components/QuestionConfusionChecker';
import { useI18n } from '../i18n/I18nProvider';

export default function QuestionBank() {
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState<'subjects' | 'sessions' | 'questions' | 'confusion'>('subjects');

  return (
    <div className="animate-fade-in">
      <div className="flex justify-between items-center mb-4">
        <h2>{t('qbTitle')}</h2>
      </div>

      <div className="flex gap-4 mb-4" style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
        <button 
          className={`btn ${activeTab === 'subjects' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('subjects')}
        >
          {t('qbSubjects')}
        </button>
        <button 
          className={`btn ${activeTab === 'sessions' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('sessions')}
        >
          {t('qbSessions')}
        </button>
        <button 
          className={`btn ${activeTab === 'questions' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('questions')}
        >
          {t('qbQuestions')}
        </button>
        <button
          className={`btn ${activeTab === 'confusion' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('confusion')}
        >
          {t('qbConfusion')}
        </button>
      </div>

      {activeTab === 'subjects' && <SubjectManager />}
      {activeTab === 'sessions' && <SessionManager />}
      {activeTab === 'questions' && <QuestionList />}
      {activeTab === 'confusion' && <QuestionConfusionChecker />}
    </div>
  );
}
