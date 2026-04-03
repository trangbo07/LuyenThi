import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import type { Subject } from '../types/database.types';
import { Trash2, Plus } from 'lucide-react';
import PaginationControls from './PaginationControls';
import { useI18n } from '../i18n/I18nProvider';

export default function SubjectManager() {
  const { t } = useI18n();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    fetchSubjects();
  }, []);

  const fetchSubjects = async () => {
    const { data, error } = await supabase.from('subjects').select('*').order('created_at', { ascending: false });
    if (!error && data) {
      setSubjects(data);
    }
  };

  const pagedSubjects = subjects.slice((page - 1) * pageSize, page * pageSize);

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
      alert(t('subjectAddError', { message: error.message }));
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t('subjectDeleteConfirm'))) return;
    const { error } = await supabase.from('subjects').delete().eq('id', id);
    if (!error) {
      fetchSubjects();
    } else {
      alert(t('subjectDeleteError', { message: error.message }));
    }
  };

  return (
    <div className="card mb-4 animate-fade-in">
      <h3 className="mb-4">{t('subjectManageTitle')}</h3>
      
      <form onSubmit={handleAdd} className="flex gap-4 mb-4 items-center">
        <input 
          placeholder={t('subjectCodePlaceholder')} 
          value={code} 
          onChange={(e) => setCode(e.target.value)} 
          className="flex-1"
          required
        />
        <input 
          placeholder={t('subjectNamePlaceholder')} 
          value={name} 
          onChange={(e) => setName(e.target.value)} 
          className="flex-1"
          required
        />
        <button type="submit" className="btn btn-primary" disabled={loading} style={{ whiteSpace: 'nowrap' }}>
          <Plus size={18} /> {t('subjectAdd')}
        </button>
      </form>

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>{t('subjectCode')}</th>
              <th>{t('subjectName')}</th>
              <th style={{ width: '100px', textAlign: 'right' }}>{t('subjectActions')}</th>
            </tr>
          </thead>
          <tbody>
            {subjects.length === 0 ? (
              <tr>
                <td colSpan={3} className="text-center text-muted" style={{ padding: '2rem' }}>{t('subjectEmpty')}</td>
              </tr>
            ) : pagedSubjects.map(s => (
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

      <PaginationControls
        page={page}
        pageSize={pageSize}
        totalItems={subjects.length}
        onPageChange={setPage}
        onPageSizeChange={(size) => {
          setPageSize(size);
          setPage(1);
        }}
      />
    </div>
  );
}
