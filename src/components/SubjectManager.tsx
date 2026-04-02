import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import type { Subject } from '../types/database.types';
import { Trash2, Plus } from 'lucide-react';

export default function SubjectManager() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchSubjects();
  }, []);

  const fetchSubjects = async () => {
    const { data, error } = await supabase.from('subjects').select('*').order('created_at', { ascending: false });
    if (!error && data) {
      setSubjects(data);
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code || !name) return;
    setLoading(true);
    const { error } = await supabase.from('subjects').insert([{ code, name }]);
    setLoading(false);
    if (!error) {
      setCode('');
      setName('');
      fetchSubjects();
    } else {
      alert('Error adding subject: ' + error.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure? This will delete all related sessions and questions.')) return;
    const { error } = await supabase.from('subjects').delete().eq('id', id);
    if (!error) {
      fetchSubjects();
    } else {
      alert('Error deleting subject: ' + error.message);
    }
  };

  return (
    <div className="card mb-4 animate-fade-in">
      <h3 className="mb-4">Manage Subjects</h3>
      
      <form onSubmit={handleAdd} className="flex gap-4 mb-4 items-center">
        <input 
          placeholder="Subject Code (e.g. PRJ301)" 
          value={code} 
          onChange={(e) => setCode(e.target.value)} 
          className="flex-1"
          required
        />
        <input 
          placeholder="Subject Name (e.g. Java Web)" 
          value={name} 
          onChange={(e) => setName(e.target.value)} 
          className="flex-1"
          required
        />
        <button type="submit" className="btn btn-primary" disabled={loading} style={{ whiteSpace: 'nowrap' }}>
          <Plus size={18} /> Add Subject
        </button>
      </form>

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Code</th>
              <th>Name</th>
              <th style={{ width: '100px', textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {subjects.length === 0 ? (
              <tr>
                <td colSpan={3} className="text-center text-muted" style={{ padding: '2rem' }}>No subjects found. Add one above.</td>
              </tr>
            ) : subjects.map(s => (
              <tr key={s.id}>
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
