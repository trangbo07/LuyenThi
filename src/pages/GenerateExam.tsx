import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import type { Subject, ExamSession } from '../types/database.types';

export default function GenerateExam() {
  const navigate = useNavigate();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [sessions, setSessions] = useState<ExamSession[]>([]);
  const [selectedSubject, setSelectedSubject] = useState('');
  const [selectedSessions, setSelectedSessions] = useState<string[]>([]);
  const [questionCount, setQuestionCount] = useState<number>(50);
  const [timeLimit, setTimeLimit] = useState<number>(60);
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

  const handleSubjectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = e.target.value;
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

  const handleGenerate = async () => {
    if (!selectedSubject) return alert('Select a subject.');
    if (selectedSessions.length === 0) return alert('Select at least one session.');
    if (questionCount <= 0) return alert('Question count must be > 0');

    setGenerating(true);

    // Fetch questions from selected sessions
    const { data, error } = await supabase
      .from('questions')
      .select('*')
      .in('session_id', selectedSessions);

    setGenerating(false);

    if (error) {
      return alert('Error fetching questions: ' + error.message);
    }

    if (!data || data.length === 0) {
      return alert('No questions found in selected sessions.');
    }

    // Filter out duplicate questions by question text to prevent identical questions
    const uniqueQuestionsMap = new Map<string, typeof data[0]>();
    data.forEach(q => {
      // Normalize the text (lowercase, collapse whitespace) to improve duplicate detection
      const normalizedText = (q.question_text || '').trim().toLowerCase().replace(/\s+/g, ' ');
      if (!uniqueQuestionsMap.has(normalizedText)) {
        uniqueQuestionsMap.set(normalizedText, q);
      }
    });

    const uniqueQuestions = Array.from(uniqueQuestionsMap.values());

    // Shuffle unique questions
    const shuffledQuestions = [...uniqueQuestions].sort(() => Math.random() - 0.5).slice(0, questionCount);

    // Shuffle options for each question
    const processedQuestions = shuffledQuestions.map(q => {
      const options = (q.options || []).map((text: string, idx: number) => ({
        label: String.fromCharCode(65 + idx),
        text
      }));

      // Shuffle the options array
      options.sort(() => Math.random() - 0.5);

      // Map back to A, B, C, D in UI, but keep track of WHICH original label it is
      // correct_options are array of original labels ['A', 'C'] etc.
      return {
        ...q,
        shuffled_options: options, // Array of { label: originalLabel, text }
      };
    });

    // Navigate to exam page
    navigate('/exam', { state: { questions: processedQuestions, subjectId: selectedSubject, timeLimit } });
  };

  return (
    <div className="card animate-fade-in" style={{ maxWidth: '600px', margin: '0 auto' }}>
      <h2 className="mb-4 text-center">Generate Exam</h2>

      <div className="mb-4">
        <label className="mb-2" style={{ display: 'block', fontWeight: 600 }}>Subject</label>
        <select value={selectedSubject} onChange={handleSubjectChange}>
          <option value="">-- Choose Subject --</option>
          {subjects.map(s => <option key={s.id} value={s.id}>{s.code} - {s.name}</option>)}
        </select>
      </div>

      {selectedSubject && (
        <div className="mb-4">
          <label className="mb-2" style={{ display: 'block', fontWeight: 600 }}>Select Sessions (Merge multiple)</label>
          {sessions.length === 0 && <p className="text-muted text-sm">No sessions found.</p>}
          <div className="grid gap-2" style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid var(--border-color)', padding: '1rem', borderRadius: 'var(--radius-md)' }}>
            {sessions.map(s => (
              <label key={s.id} className="flex gap-2 items-center" style={{ cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  style={{ width: 'auto' }}
                  checked={selectedSessions.includes(s.id)}
                  onChange={() => toggleSession(s.id)}
                />
                {s.code} - {s.name}
              </label>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-4 mb-6">
        <div className="flex-1">
          <label className="mb-2" style={{ display: 'block', fontWeight: 600 }}>Number of Questions</label>
          <input
            type="number"
            value={questionCount}
            onChange={(e) => setQuestionCount(parseInt(e.target.value))}
            min={1}
            max={200}
            style={{ width: '100%' }}
          />
        </div>
        <div className="flex-1">
          <label className="mb-2" style={{ display: 'block', fontWeight: 600 }}>Time Limit (minutes)</label>
          <input
            type="number"
            value={timeLimit}
            onChange={(e) => setTimeLimit(parseInt(e.target.value))}
            min={1}
            max={300}
            style={{ width: '100%' }}
          />
        </div>
      </div>

      <button className="btn btn-primary w-full" style={{ width: '100%', padding: '1rem' }} onClick={handleGenerate} disabled={generating || !selectedSubject || selectedSessions.length === 0}>
        {generating ? 'Processing...' : 'Generate Exam & Start'}
      </button>

    </div>
  );
}
