import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import type { Subject, ExamSession } from '../types/database.types';
import { useI18n } from '../i18n/I18nProvider';
import { useToast } from '../components/Toast';
import { BookOpen, Layers, Settings, ChevronRight, ChevronLeft, Rocket } from 'lucide-react';

export default function GenerateExam() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const { toast } = useToast();
  
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [sessions, setSessions] = useState<ExamSession[]>([]);
  
  const [selectedSubject, setSelectedSubject] = useState('');
  const [selectedSessions, setSelectedSessions] = useState<string[]>([]);
  const [questionCount, setQuestionCount] = useState<number>(50);
  const [timeLimit, setTimeLimit] = useState<number>(60);
  
  const [shuffleQuestions, setShuffleQuestions] = useState<boolean>(true);
  const [shuffleOptions, setShuffleOptions] = useState<boolean>(true);
  
  const [step, setStep] = useState(1);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    fetchSubjects();
  }, []);

  const fetchSubjects = async () => {
    const { data } = await supabase.from('subjects').select('*').order('name');
    if (data) setSubjects(data);
  };

  const fetchSessions = async (subId: string) => {
    const { data } = await supabase.from('exam_sessions').select('*').eq('subject_id', subId).order('name');
    if (data) setSessions(data);
  };

  const handleSubjectSelect = (id: string) => {
    setSelectedSubject(id);
    setSelectedSessions([]);
    if (id) fetchSessions(id);
    else setSessions([]);
  };

  const toggleSession = (id: string) => {
    setSelectedSessions(prev =>
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
    );
  };

  const selectAllSessions = () => {
    setSelectedSessions(sessions.map(s => s.id));
  };

  const clearSessions = () => {
    setSelectedSessions([]);
  };

  const nextStep = () => {
    if (step === 1 && !selectedSubject) {
      toast(t('generateAlertSelectSubject'), 'warning'); return;
    }
    if (step === 2 && selectedSessions.length === 0) {
      toast(t('generateAlertSelectSession'), 'warning'); return;
    }
    setStep(s => s + 1);
  };

  const prevStep = () => setStep(s => s - 1);

  const handleGenerate = async () => {
    if (!selectedSubject) { toast(t('generateAlertSelectSubject'), 'warning'); return; }
    if (selectedSessions.length === 0) { toast(t('generateAlertSelectSession'), 'warning'); return; }
    if (questionCount <= 0) { toast(t('generateAlertQuestionCount'), 'warning'); return; }

    setGenerating(true);

    const { data, error } = await supabase
      .from('questions')
      .select('*')
      .in('session_id', selectedSessions);

    setGenerating(false);

    if (error) {
      toast(t('generateFetchError', { message: error.message }), 'error'); return;
    }

    if (!data || data.length === 0) {
      toast(t('generateNoQuestions'), 'warning'); return;
    }

    // Filter out duplicate questions
    const uniqueQuestionsMap = new Map<string, typeof data[0]>();
    data.forEach(q => {
      const normalizedText = (q.question_text || '').trim().toLowerCase().replace(/\s+/g, ' ');
      if (!uniqueQuestionsMap.has(normalizedText)) {
        uniqueQuestionsMap.set(normalizedText, q);
      }
    });

    const uniqueQuestions = Array.from(uniqueQuestionsMap.values());
    const orderedQuestions = shuffleQuestions
      ? [...uniqueQuestions].sort(() => Math.random() - 0.5)
      : uniqueQuestions;
    const selectedQuestions = orderedQuestions.slice(0, questionCount);

    const processedQuestions = selectedQuestions.map(q => {
      const options = (q.options || []).map((text: string, idx: number) => ({
        label: String.fromCharCode(65 + idx),
        text
      }));
      if (shuffleOptions) {
        options.sort(() => Math.random() - 0.5);
      }
      return {
        ...q,
        shuffled_options: options,
      };
    });

    navigate('/exam', { state: { questions: processedQuestions, subjectId: selectedSubject, timeLimit } });
  };

  const steps = [
    { num: 1, title: t('generateSubject'), icon: <BookOpen size={20} /> },
    { num: 2, title: t('generateSessions'), icon: <Layers size={20} /> },
    { num: 3, title: 'Configuration', icon: <Settings size={20} /> }
  ];

  return (
    <div className="wizard-container animate-fade-in">
      <div className="wizard-card">
        {/* PROGRESS HEADER */}
        <div className="wizard-progress">
          {steps.map((s, idx) => (
            <div key={s.num} className={`wizard-step ${step === s.num ? 'active' : ''} ${step > s.num ? 'completed' : ''}`}>
              <div className="wizard-step-icon">{s.icon}</div>
              <div className="wizard-step-label">{s.title}</div>
              {idx < steps.length - 1 && <div className="wizard-connector" />}
            </div>
          ))}
        </div>

        <div className="wizard-content">
          <h2 className="wizard-title text-center" style={{ marginBottom: '2rem' }}>
            {step === 1 && t('generateTitle')}
            {step === 2 && t('generateSessions')}
            {step === 3 && 'Final Configuration'}
          </h2>

          {/* STEP 1 */}
          {step === 1 && (
            <div className="wizard-step-content animate-fade-in">
              <div className="subject-grid">
                {subjects.map(subj => (
                  <button
                    key={subj.id}
                    className={`subject-card ${selectedSubject === subj.id ? 'selected' : ''}`}
                    onClick={() => handleSubjectSelect(subj.id)}
                  >
                    <div className="subject-code">{subj.code}</div>
                    <div className="subject-name">{subj.name}</div>
                  </button>
                ))}
                {subjects.length === 0 && <p className="text-center text-muted" style={{ padding: '2rem' }}>No subjects found. Please add subjects in Admin.</p>}
              </div>
            </div>
          )}

          {/* STEP 2 */}
          {step === 2 && (
            <div className="wizard-step-content animate-fade-in">
              <div className="flex justify-between items-center mb-4">
                <span className="font-bold text-muted">{sessions.length} sessions available</span>
                <div className="flex gap-2">
                  <button className="btn btn-secondary text-sm" onClick={selectAllSessions} style={{ padding: '0.4rem 0.8rem', borderRadius: '999px' }}>Select All</button>
                  <button className="btn btn-secondary text-sm" onClick={clearSessions} style={{ padding: '0.4rem 0.8rem', borderRadius: '999px' }}>Clear</button>
                </div>
              </div>
              
              <div className="session-grid">
                {sessions.map(s => (
                  <label key={s.id} className={`session-card ${selectedSessions.includes(s.id) ? 'selected' : ''}`}>
                    <input
                      type="checkbox"
                      checked={selectedSessions.includes(s.id)}
                      onChange={() => toggleSession(s.id)}
                      style={{ display: 'none' }}
                    />
                    <div className="session-code">{s.code}</div>
                    <div className="session-name" style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</div>
                    <div className="session-checkbox">
                       {selectedSessions.includes(s.id) && <div className="session-checkmark"></div>}
                    </div>
                  </label>
                ))}
                {sessions.length === 0 && <p className="text-center text-muted col-span-full" style={{ padding: '2rem' }}>{t('generateNoSessions')}</p>}
              </div>
            </div>
          )}

          {/* STEP 3 */}
          {step === 3 && (
            <div className="wizard-step-content animate-fade-in">
              <div className="config-grid">
                <div className="config-card">
                  <label>{t('generateQuestionCount')}</label>
                  <div className="config-input-wrapper">
                    <input
                      type="number"
                      value={questionCount}
                      onChange={(e) => setQuestionCount(parseInt(e.target.value))}
                      min={1}
                      max={200}
                    />
                    <span className="config-suffix">questions</span>
                  </div>
                </div>
                
                <div className="config-card">
                  <label>{t('generateTimeLimit')}</label>
                  <div className="config-input-wrapper">
                    <input
                      type="number"
                      value={timeLimit}
                      onChange={(e) => setTimeLimit(parseInt(e.target.value))}
                      min={1}
                      max={300}
                    />
                    <span className="config-suffix">minutes</span>
                  </div>
                </div>

                <div className="config-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
                  <div>
                    <label style={{ margin: 0, fontWeight: 700 }}>{t('practiceShuffleQuestions')}</label>
                    <div className="text-muted" style={{ fontSize: '0.85rem', marginTop: '0.25rem', lineHeight: '1.25' }}>{t('practiceShuffleQuestionsHint')}</div>
                  </div>
                  <button
                    type="button"
                    className={`btn ${shuffleQuestions ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setShuffleQuestions(prev => !prev)}
                    style={{ borderRadius: '999px', minWidth: '110px', padding: '0.5rem 1rem' }}
                  >
                    {shuffleQuestions ? t('practiceShuffleEnabled') : t('practiceShuffleDisabled')}
                  </button>
                </div>

                <div className="config-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
                  <div>
                    <label style={{ margin: 0, fontWeight: 700 }}>{t('practiceShuffleOptions')}</label>
                    <div className="text-muted" style={{ fontSize: '0.85rem', marginTop: '0.25rem', lineHeight: '1.25' }}>{t('practiceShuffleOptionsHint')}</div>
                  </div>
                  <button
                    type="button"
                    className={`btn ${shuffleOptions ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setShuffleOptions(prev => !prev)}
                    style={{ borderRadius: '999px', minWidth: '110px', padding: '0.5rem 1rem' }}
                  >
                    {shuffleOptions ? t('practiceShuffleEnabled') : t('practiceShuffleDisabled')}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* CONTROLS */}
        <div className="wizard-footer">
          {step > 1 ? (
             <button className="btn btn-secondary flex items-center gap-2" onClick={prevStep} style={{ borderRadius: '999px', padding: '0.8rem 1.5rem' }}>
               <ChevronLeft size={18} /> Back
             </button>
          ) : <div></div>}

          {step < 3 ? (
             <button className="btn btn-primary flex items-center gap-2" onClick={nextStep} style={{ borderRadius: '999px', padding: '0.8rem 1.5rem' }}>
               Next <ChevronRight size={18} />
             </button>
          ) : (
             <button className="btn btn-primary flex items-center gap-2" onClick={handleGenerate} disabled={generating} style={{ borderRadius: '999px', padding: '0.8rem 1.75rem', background: 'var(--success-color)' }}>
               {generating ? 'Processing...' : (
                 <>
                   <Rocket size={18} /> {t('generateStart')}
                 </>
               )}
             </button>
          )}
        </div>
      </div>
    </div>
  );
}
