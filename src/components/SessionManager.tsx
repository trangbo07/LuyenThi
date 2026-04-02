import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import type { ExamSession, Subject } from '../types/database.types';
import { Trash2, Plus } from 'lucide-react';

export default function SessionManager() {
  const [sessions, setSessions] = useState<(ExamSession & { subjects?: Subject })[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [subjectId, setSubjectId] = useState('');
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchSubjects();
    fetchSessions();
  }, []);

  const fetchSubjects = async () => {
    const { data } = await supabase.from('subjects').select('*').order('name');
    if (data) setSubjects(data);
  };

  const fetchSessions = async () => {
    // using a join to get subject code/name
    const { data } = await supabase
      .from('exam_sessions')
      .select('*, subjects(id, code, name)')
      .order('created_at', { ascending: false });
    if (data) setSessions(data as any);
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subjectId || !code || !name) return;
    setLoading(true);
    const { error } = await supabase.from('exam_sessions').insert([{ subject_id: subjectId, code, name }]);
    setLoading(false);
    if (!error) {
      setCode('');
      setName('');
      fetchSessions();
    } else {
      alert('Error adding session: ' + error.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure? This will delete all questions in this session.')) return;
    const { error } = await supabase.from('exam_sessions').delete().eq('id', id);
    if (!error) {
      fetchSessions();
    } else {
      alert('Error deleting session: ' + error.message);
    }
  };

  return (
    <div className="card animate-fade-in">
      <h3 className="mb-4">Manage Exam Sessions</h3>
      
      <form onSubmit={handleAdd} className="flex gap-4 mb-4 items-center">
        <select value={subjectId} onChange={(e) => setSubjectId(e.target.value)} required className="flex-1">
          <option value="">Select Subject...</option>
          {subjects.map(s => <option key={s.id} value={s.id}>{s.code} - {s.name}</option>)}
        </select>
        <input 
          placeholder="Session Code (e.g. SP24)" 
          value={code} 
          onChange={(e) => setCode(e.target.value)} 
          className="flex-1"
          required
        />
        <input 
          placeholder="Session Name (e.g. Spring 2024)" 
          value={name} 
          onChange={(e) => setName(e.target.value)} 
          className="flex-1"
          required
        />
        <button type="submit" className="btn btn-primary" disabled={loading} style={{ whiteSpace: 'nowrap' }}>
          <Plus size={18} /> Add Session
        </button>
      </form>

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Subject</th>
              <th>Code</th>
              <th>Name</th>
              <th style={{ width: '100px', textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {sessions.length === 0 ? (
              <tr>
                <td colSpan={4} className="text-center text-muted" style={{ padding: '2rem' }}>No sessions found. Add one above.</td>
              </tr>
            ) : sessions.map(s => (
              <tr key={s.id}>
                <td><span className="text-muted" style={{ fontSize: '0.85em', background: '#e2e8f0', padding: '0.2rem 0.5rem', borderRadius: '4px' }}>{s.subjects?.code}</span></td>
                <td style={{ fontWeight: 500 }}>{s.code}</td>
                <td>{s.name}</td>
                <td style={{ textAlign: 'right' }}>
                  <button onClick={() => handleDelete(s.id)} className="btn btn-danger" style={{ padding: '0.5rem' }}>
                    <Trash2 size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
