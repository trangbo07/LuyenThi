import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import type { Subject, ExamSession, Question } from '../types/database.types';
import { Trash2, Edit2, Plus } from 'lucide-react';
import PaginationControls from './PaginationControls';
import { useI18n } from '../i18n/I18nProvider';
import { useToast } from './Toast';

export default function QuestionList() {
  const { t } = useI18n();
  const { toast } = useToast();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [sessions, setSessions] = useState<ExamSession[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  
  const [selectedSubject, setSelectedSubject] = useState('');
  const [selectedSession, setSelectedSession] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editFormData, setEditFormData] = useState<Question | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalItems, setTotalItems] = useState(0);

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


  const fetchQuestions = async (
    sessionId?: string,
    pageToLoad = page,
    sizeToLoad = pageSize,
    keyword = searchQuery
  ) => {
    setLoading(true);
    const from = (pageToLoad - 1) * sizeToLoad;
    const to = from + sizeToLoad - 1;
    const cleanKeyword = keyword.trim();

    let allowedSessionIds: string[] | null = null;
    if (!sessionId && selectedSubject) {
      const { data: sessionRows, error: sessionsError } = await supabase
        .from('exam_sessions')
        .select('id')
        .eq('subject_id', selectedSubject);

      if (sessionsError) {
        toast(t('qlLoadSessionsError', { message: sessionsError.message }), 'error');
        setQuestions([]);
        setTotalItems(0);
        setLoading(false);
        return;
      }

      allowedSessionIds = (sessionRows || []).map((row: { id: string }) => row.id);
      if (allowedSessionIds.length === 0) {
        setQuestions([]);
        setTotalItems(0);
        setLoading(false);
        return;
      }
    }

    let q = supabase
      .from('questions')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false });

    if (sessionId) {
      q = q.eq('session_id', sessionId);
    } else if (allowedSessionIds) {
      q = q.in('session_id', allowedSessionIds);
    }

    if (cleanKeyword) {
      q = q.ilike('question_text', `%${cleanKeyword}%`);
    }

    const { data, count, error } = await q.range(from, to);
    if (error) {
      toast(t('qlLoadQuestionsError', { message: error.message }), 'error');
      setQuestions([]);
      setTotalItems(0);
      setLoading(false);
      return;
    }

    setQuestions(data || []);
    setTotalItems(count || 0);
    setLoading(false);
  };

  const handleSubjectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const subId = e.target.value;
    setSelectedSubject(subId);
    setSelectedSession('');
    setSearchQuery('');
    setPage(1);
    setQuestions([]);
    setTotalItems(0);
    if (subId) fetchSessions(subId);
    else setSessions([]);
  };

  const handleSessionChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const sessId = e.target.value;
    setSelectedSession(sessId);
    setPage(1);
  };

  const hasActiveScope = Boolean(selectedSubject || selectedSession || searchQuery.trim());

  useEffect(() => {
    if (!hasActiveScope) {
      setQuestions([]);
      setTotalItems(0);
      return;
    }
    fetchQuestions(selectedSession || undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSubject, selectedSession, page, pageSize, searchQuery, hasActiveScope]);


  const handleDelete = async (id: string) => {
    if (!confirm(t('qlDeleteConfirm'))) return;
    const { error } = await supabase.from('questions').delete().eq('id', id);
    if (!error) {
      fetchQuestions(selectedSession || undefined);
    } else {
      toast(t('qlDeleteError', { message: error?.message || '' }), 'error');
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
      { toast(t('qlOptionsValidationError'), 'warning'); return; }
    }

    const { error } = await supabase.from('questions').update({
      question_text: editFormData.question_text,
      options: editFormData.options,
      correct_options: editFormData.correct_options
    }).eq('id', editFormData.id);
    
    if (!error) {
      setEditingId(null);
      fetchQuestions(selectedSession || undefined);
    } else {
      toast(t('qlUpdateError', { message: error.message }), 'error');
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
      <h3 className="mb-4">{t('qlTitle')}</h3>

      <div className="flex gap-4 mb-6">
        <select value={selectedSubject} onChange={handleSubjectChange} className="flex-1">
          <option value="">{t('qlFilterSubject')}</option>
          {subjects.map(s => <option key={s.id} value={s.id}>{s.code} - {s.name}</option>)}
        </select>
        <select value={selectedSession} onChange={handleSessionChange} className="flex-1" disabled={!selectedSubject}>
          <option value="">{t('qlFilterSession')}</option>
          {sessions.map(s => <option key={s.id} value={s.id}>{s.code} - {s.name}</option>)}
        </select>
      </div>

      <div className="mb-4" style={{ maxWidth: '520px' }}>
        <input
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setPage(1);
          }}
          placeholder={t('qlSearchAll')}
        />
      </div>

      {!selectedSubject && !selectedSession && !searchQuery.trim() && (
        <p className="text-muted text-center" style={{ padding: '1rem 0 1.5rem' }}>
          {t('qlHintScope')}
        </p>
      )}

      {loading && <p>{t('qlLoading')}</p>}

      {!loading && hasActiveScope && questions.length === 0 && (
        <p className="text-muted text-center" style={{ padding: '2rem' }}>{t('qlNoQuestions')}</p>
      )}

      {!loading && questions.length > 0 && (
        <div className="mb-4" style={{ maxWidth: '520px' }}>
          <div className="text-sm" style={{ color: 'var(--text-secondary)', fontWeight: 700 }}>
            {selectedSession ? t('qlScopeSession') : selectedSubject ? t('qlScopeSubject') : t('qlScopeAll')}
          </div>
        </div>
      )}

      {!loading && questions.length > 0 && (
        <>
        <div className="grid gap-4">
          {questions.map((q, idx) => {
            const qIndex = (page - 1) * pageSize + idx + 1;
            if (editingId === q.id && editFormData) {
              return (
                <div key={q.id} className="card" style={{ padding: '1rem', background: '#F8FAFC' }}>
                   <div className="mb-2 text-muted" style={{ fontWeight: 600 }}>{t('qlEditingQuestion', { index: qIndex })}</div>
                   <textarea value={editFormData.question_text} onChange={e => setEditFormData({...editFormData, question_text: e.target.value})} rows={2} className="mb-2" />
                   
                   <div className="grid gap-2 mb-2">
                     {editFormData.options.map((optText, oIdx) => {
                       const optLabel = String.fromCharCode(65 + oIdx);
                       return (
                         <div key={oIdx} className="flex gap-2 items-center">
                           <label className="flex items-center gap-1" style={{ cursor: 'pointer' }} title={t('qlMarkAsCorrect')}>
                             <input type="checkbox" style={{ width: 'auto' }} checked={editFormData.correct_options.includes(optLabel)} onChange={() => toggleEditCorrectOption(optLabel)} />
                             <span style={{ fontSize: '0.8rem', fontWeight: 600, color: editFormData.correct_options.includes(optLabel) ? 'var(--success-color)' : 'var(--text-secondary)' }}>{t('importCorrect')}</span>
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
                   <button onClick={() => setEditFormData({...editFormData, options: [...editFormData.options, '']})} className="btn btn-secondary text-sm mb-4" style={{ padding: '0.3rem 0.6rem' }}><Plus size={14} /> {t('importAddOption')}</button>

                   <div className="flex justify-end gap-2 mt-4">
                     <button className="btn btn-secondary" onClick={handleCancelEdit}>{t('qlCancel')}</button>
                     <button className="btn btn-primary" onClick={handleSaveEdit}>{t('qlSaveChanges')}</button>
                   </div>
                </div>
              );
            }

            return (
              <div key={q.id} className="card" style={{ padding: '1rem', background: '#F8FAFC' }}>
                <div className="flex justify-between items-start mb-2">
                  <p style={{ fontWeight: 600 }}>Q{qIndex}. {q.question_text}</p>
                  <div className="flex gap-2">
                    <button onClick={() => handleEditClick(q)} className="btn btn-secondary" style={{ padding: '0.4rem' }} title={t('qlEdit')}><Edit2 size={14} /></button>
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
        <PaginationControls
          page={page}
          pageSize={pageSize}
          totalItems={totalItems}
          onPageChange={setPage}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setPage(1);
          }}
        />
        </>
      )}
    </div>
  );
}
