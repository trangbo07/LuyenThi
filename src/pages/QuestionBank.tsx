import { useState } from 'react';
import SubjectManager from '../components/SubjectManager';
import SessionManager from '../components/SessionManager';
import QuestionList from '../components/QuestionList';

export default function QuestionBank() {
  const [activeTab, setActiveTab] = useState<'subjects' | 'sessions' | 'questions'>('subjects');

  return (
    <div className="animate-fade-in">
      <div className="flex justify-between items-center mb-4">
        <h2>Question Bank Administration</h2>
      </div>

      <div className="flex gap-4 mb-4" style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
        <button 
          className={`btn ${activeTab === 'subjects' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('subjects')}
        >
          Subjects
        </button>
        <button 
          className={`btn ${activeTab === 'sessions' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('sessions')}
        >
          Exam Sessions
        </button>
        <button 
          className={`btn ${activeTab === 'questions' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('questions')}
        >
          Questions
        </button>
      </div>

      {activeTab === 'subjects' && <SubjectManager />}
      {activeTab === 'sessions' && <SessionManager />}
      {activeTab === 'questions' && <QuestionList />}
    </div>
  );
}
