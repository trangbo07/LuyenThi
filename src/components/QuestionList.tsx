import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import type { Subject, ExamSession, Question } from '../types/database.types';
import { Trash2, Edit2, Plus } from 'lucide-react';

export default function QuestionList() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [sessions, setSessions] = useState<ExamSession[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  
  const [selectedSubject, setSelectedSubject] = useState('');
  const [selectedSession, setSelectedSession] = useState('');
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editFormData, setEditFormData] = useState<Question | null>(null);

  useEffect(() => {
    fetchSubjects();
  }, []);

  const fetchSubjects = async () => {
    const { data } = await supabase.from('subjects').select('*').order('name');
    if (data) setSubjects(data);
  };

  const fetchSessions = async (subjectId: string) => {
    const { data } = await supabase.from('exam_sessions').select('*').eq('subject_id', subjectId).order('name');
    if (data) setSessions(data);
  };

  const fetchQuestions = async (sessionId: string) => {
    setLoading(true);
    const { data } = await supabase.from('questions').select('*').eq('session_id', sessionId).order('created_at', { ascending: false });
    if (data) setQuestions(data);
    setLoading(false);
  };

  const handleSubjectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const subId = e.target.value;
    setSelectedSubject(subId);
    setSelectedSession('');
    setQuestions([]);
    if (subId) fetchSessions(subId);
    else setSessions([]);
  };

  const handleSessionChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const sessId = e.target.value;
    setSelectedSession(sessId);
    if (sessId) fetchQuestions(sessId);
    else setQuestions([]);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this question?')) return;
    const { error } = await supabase.from('questions').delete().eq('id', id);
    if (!error && selectedSession) {
      fetchQuestions(selectedSession);
    } else {
      alert('Error deleting: ' + error?.message);
    }
  };

  const handleEditClick = (q: Question) => {
    setEditingId(q.id);
    setEditFormData({ ...q });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditFormData(null);
  };

  const handleSaveEdit = async () => {
    if (!editFormData) return;
    if (editFormData.options.length < 2 || editFormData.options.some(o => !o.trim())) {
      return alert('Must have at least 2 non-empty options.');
    }

    const { error } = await supabase.from('questions').update({
      question_text: editFormData.question_text,
      options: editFormData.options,
      correct_options: editFormData.correct_options
    }).eq('id', editFormData.id);
    
    if (!error) {
      setEditingId(null);
      fetchQuestions(selectedSession);
    } else {
      alert('Error updating: ' + error.message);
    }
  };

  const toggleEditCorrectOption = (opt: string) => {
    if (!editFormData) return;
    const opts = editFormData.correct_options;
    const newOpts = opts.includes(opt) ? opts.filter(o => o !== opt) : [...opts, opt];
    setEditFormData({ ...editFormData, correct_options: newOpts });
  };

  return (
    <div className="card animate-fade-in">
      <h3 className="mb-4">Question Repository</h3>

      <div className="flex gap-4 mb-6">
        <select value={selectedSubject} onChange={handleSubjectChange} className="flex-1">
          <option value="">-- Filter by Subject --</option>
          {subjects.map(s => <option key={s.id} value={s.id}>{s.code} - {s.name}</option>)}
        </select>
        <select value={selectedSession} onChange={handleSessionChange} className="flex-1" disabled={!selectedSubject}>
          <option value="">-- Filter by Session --</option>
          {sessions.map(s => <option key={s.id} value={s.id}>{s.code} - {s.name}</option>)}
        </select>
      </div>

      {loading && <p>Loading questions...</p>}

      {!loading && selectedSession && questions.length === 0 && (
        <p className="text-muted text-center" style={{ padding: '2rem' }}>No questions found in this session.</p>
      )}

      {!loading && questions.length > 0 && (
        <div className="grid gap-4">
          {questions.map((q, idx) => {
            if (editingId === q.id && editFormData) {
              return (
                <div key={q.id} className="card" style={{ padding: '1rem', background: '#F8FAFC' }}>
                   <div className="mb-2 text-muted" style={{ fontWeight: 600 }}>Editing Question {idx + 1}</div>
                   <textarea value={editFormData.question_text} onChange={e => setEditFormData({...editFormData, question_text: e.target.value})} rows={2} className="mb-2" />
                   
                   <div className="grid gap-2 mb-2">
                     {editFormData.options.map((optText, oIdx) => {
                       const optLabel = String.fromCharCode(65 + oIdx);
                       return (
                         <div key={oIdx} className="flex gap-2 items-center">
                           <label className="flex items-center gap-1" style={{ cursor: 'pointer' }} title="Mark as correct">
                             <input type="checkbox" style={{ width: 'auto' }} checked={editFormData.correct_options.includes(optLabel)} onChange={() => toggleEditCorrectOption(optLabel)} />
                             <span style={{ fontSize: '0.8rem', fontWeight: 600, color: editFormData.correct_options.includes(optLabel) ? 'var(--success-color)' : 'var(--text-secondary)' }}>Correct</span>
                           </label>
                           <span style={{ fontWeight: 600, width: '20px' }}>{optLabel}.</span>
                           <input 
                             value={optText} 
                             onChange={e => {
                               const newOpts = [...editFormData.options];
                               newOpts[oIdx] = e.target.value;
                               setEditFormData({ ...editFormData, options: newOpts });
                             }} 
                           />
                           <button onClick={() => {
                               const newOpts = [...editFormData.options];
                               newOpts.splice(oIdx, 1);
                               setEditFormData({...editFormData, options: newOpts, correct_options: []});
                           }} style={{ color: 'var(--danger-color)', padding: '0.5rem', background: 'none' }}><Trash2 size={16}/></button>
                         </div>
                       );
                     })}
                   </div>
                   <button onClick={() => setEditFormData({...editFormData, options: [...editFormData.options, '']})} className="btn btn-secondary text-sm mb-4" style={{ padding: '0.3rem 0.6rem' }}><Plus size={14} /> Add Option</button>

                   <div className="flex justify-end gap-2 mt-4">
                     <button className="btn btn-secondary" onClick={handleCancelEdit}>Cancel</button>
                     <button className="btn btn-primary" onClick={handleSaveEdit}>Save Changes</button>
                   </div>
                </div>
              );
            }

            return (
              <div key={q.id} className="card" style={{ padding: '1rem', background: '#F8FAFC' }}>
                <div className="flex justify-between items-start mb-2">
                  <p style={{ fontWeight: 600 }}>Q{idx + 1}. {q.question_text}</p>
                  <div className="flex gap-2">
                    <button onClick={() => handleEditClick(q)} className="btn btn-secondary" style={{ padding: '0.4rem' }} title="Edit"><Edit2 size={14} /></button>
                    <button onClick={() => handleDelete(q.id)} className="btn btn-danger" style={{ padding: '0.4rem' }}><Trash2 size={14} /></button>
                  </div>
                </div>
                <div className="grid gap-2" style={{ gridTemplateColumns: '1fr 1fr' }}>
                  {q.options.map((o, oIdx) => {
                    const label = String.fromCharCode(65 + oIdx);
                    const isCorrect = q.correct_options.includes(label);
                    return (
                        <div key={oIdx} style={{ padding: '0.5rem', border: '1px solid var(--border-color)', borderRadius: '4px', background: isCorrect ? 'var(--success-color)' : '#fff', color: isCorrect ? '#fff' : 'inherit' }}>{label}. {o}</div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
