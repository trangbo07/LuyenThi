import { useState, useEffect, useMemo } from 'react';
import { UploadCloud, Save, Plus, Trash2 } from 'lucide-react';
import Tesseract from 'tesseract.js';
import { supabase } from '../lib/supabase';
import type { Subject, ExamSession } from '../types/database.types';
import PaginationControls from '../components/PaginationControls';
import { useI18n } from '../i18n/I18nProvider';

type ParsedQuestion = {
  id: string; // temp id for UI
  question_text: string;
  options: string[];
  correct_options: string[];
};

export default function ImportQuestions() {
  const { t } = useI18n();
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [parsed, setParsed] = useState<ParsedQuestion[]>([]);
  
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [sessions, setSessions] = useState<ExamSession[]>([]);
  const [subjectId, setSubjectId] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [saving, setSaving] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchSubjects();

    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.type.indexOf('image') === 0) {
          const file = item.getAsFile();
          if (file) {
            processImage(file);
          }
          break;
        }
      }
    };

    window.addEventListener('paste', handlePaste as EventListener);
    return () => window.removeEventListener('paste', handlePaste as EventListener);
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
    setSubjectId(id);
    setSessionId('');
    if (id) fetchSessions(id);
    else setSessions([]);
  };

  const processImage = async (file: File) => {
    setLoading(true);
    setProgress(0);
    
    try {
      const result = await Tesseract.recognize(file, 'vie+eng', {
        logger: m => {
          if (m.status === 'recognizing text') setProgress(Math.round(m.progress * 100));
        }
      });
      setText(prev => prev + (prev ? '\n\n' : '') + result.data.text);
    } catch (err) {
      alert(t('importOcrError', { message: JSON.stringify(err) }));
    } finally {
      setLoading(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await processImage(file);
  };

  const handleParse = () => {
    const blocks = text.split(/(?=[0-9]+\.\s*|(?:Question|C\u00e2u)\s+[0-9]+:)/i).filter(b => b.trim().length > 10);
    const parsedData: ParsedQuestion[] = [];
    
    for (const block of blocks.length > 0 ? blocks : [text]) {
      const optionIndices: {label: string, index: number}[] = [];
      const regex = /\b([A-H])\.\s/g;
      let match;
      
      while ((match = regex.exec(block)) !== null) {
        optionIndices.push({ label: match[1], index: match.index });
      }
      
      let question_text = block;
      let options: string[] = [];

      if (optionIndices.length > 0) {
        question_text = block.substring(0, optionIndices[0].index).trim();
        for (let i = 0; i < optionIndices.length; i++) {
           const start = optionIndices[i].index + optionIndices[i].label.length + 1;
           const end = i < optionIndices.length - 1 ? optionIndices[i+1].index : block.length;
           options.push(block.substring(start, end).trim());
        }
      } else {
        // Fallback or empty options if no A. B. C. pattern was found
        options = [];
      }

      parsedData.push({
        id: Math.random().toString(),
        question_text,
        options,
        correct_options: []
      });
    }
    
    setParsed(parsedData);
    setPage(1);
  };

  const updateQuestionText = (id: string, text: string) => {
    setParsed(prev => prev.map(p => p.id === id ? { ...p, question_text: text } : p));
  };

  const updateOption = (id: string, optIndex: number, text: string) => {
    setParsed(prev => prev.map(p => {
      if (p.id !== id) return p;
      const newOpts = [...p.options];
      newOpts[optIndex] = text;
      return { ...p, options: newOpts };
    }));
  };

  const addOption = (id: string) => {
    setParsed(prev => prev.map(p => {
      if (p.id !== id) return p;
      return { ...p, options: [...p.options, ''] };
    }));
  };

  const removeOption = (id: string, optIndex: number) => {
    setParsed(prev => prev.map(p => {
      if (p.id !== id) return p;
      const newOpts = [...p.options];
      newOpts.splice(optIndex, 1);
      return { ...p, options: newOpts, correct_options: [] };
    }));
  };

  const toggleCorrectOption = (id: string, optLabel: string) => {
    setParsed(prev => prev.map(p => {
      if (p.id !== id) return p;
      const opts = p.correct_options;
      const newOpts = opts.includes(optLabel) ? opts.filter(o => o !== optLabel) : [...opts, optLabel];
      return { ...p, correct_options: newOpts };
    }));
  };

  const handleSave = async () => {
    if (!sessionId) return alert(t('importSelectSessionFirst'));
    if (parsed.length === 0) return alert(t('importNoQuestionsSave'));
    
    // Validation
    const invalid = parsed.find(p => !p.question_text || p.options.length < 2 || p.options.some(o => !o.trim()) || p.correct_options.length === 0);
    if (invalid) return alert(t('importValidationError'));

    setSaving(true);
    const inserts = parsed.map(p => ({
      session_id: sessionId,
      question_text: p.question_text,
      options: p.options,
      correct_options: p.correct_options
    }));

    const { error } = await supabase.from('questions').insert(inserts);
    setSaving(false);
    
    if (!error) {
      alert(t('importSaveSuccess'));
      setParsed([]);
      setText('');
      setPage(1);
    } else {
      alert(t('importSaveError', { message: error.message }));
    }
  };

  const pagedParsed = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const filtered = !q
      ? parsed
      : parsed.filter((item) => item.question_text.toLowerCase().includes(q));
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [parsed, page, pageSize, searchQuery]);

  const filteredCount = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return parsed.length;
    return parsed.filter((item) => item.question_text.toLowerCase().includes(q)).length;
  }, [parsed, searchQuery]);

  return (
    <div className="animate-fade-in">
      <h2 className="mb-4">{t('importTitle')}</h2>
      
      <div className="grid gap-4" style={{ gridTemplateColumns: 'minmax(300px, 1fr) 2fr' }}>
        
        <div className="card" style={{ alignSelf: 'start' }}>
          <h3 className="mb-4">{t('importInputSource')}</h3>
          
          <div className="mb-4 border-2 border-dashed border-gray-300 rounded p-6 text-center" style={{ border: '2px dashed var(--border-color)', borderRadius: 'var(--radius-lg)' }}>
            <UploadCloud size={48} className="text-muted mx-auto mb-2" />
            <p className="mb-4 text-sm text-muted">{t('importUploadImage')}</p>
            <input type="file" accept="image/*" onChange={handleImageUpload} style={{ width: '100%' }} />
            {loading && <p className="mt-2 text-primary" style={{ fontWeight: 600 }}>{t('importScanning', { progress })}</p>}
          </div>

          <div className="mt-6">
            <h4 className="mb-2">{t('importRawText')}</h4>
            <textarea 
              rows={12} 
              value={text} 
              onChange={(e) => setText(e.target.value)} 
              placeholder={t('importRawPlaceholder')}
              style={{ fontFamily: 'monospace' }}
            />
            <button className="btn btn-secondary mt-2 w-full" onClick={handleParse} style={{ width: '100%' }}>
              {t('importParse')} →
            </button>
          </div>
        </div>

        <div className="card">
           <div className="flex justify-between items-center mb-4">
             <h3>{t('importParsedOutput', { count: parsed.length })}</h3>
             
             <div className="flex gap-2">
                <select value={subjectId} onChange={handleSubjectChange}>
                  <option value="">{t('importSubject')}</option>
                  {subjects.map(s => <option key={s.id} value={s.id}>{s.code}</option>)}
                </select>
                <select value={sessionId} onChange={(e) => setSessionId(e.target.value)} disabled={!subjectId}>
                  <option value="">{t('importSession')}</option>
                  {sessions.map(s => <option key={s.id} value={s.id}>{s.code}</option>)}
                </select>

                <button className="btn btn-primary" onClick={handleSave} disabled={saving || parsed.length === 0}>
                  <Save size={16} /> {t('importSaveBank')}
                </button>
             </div>
           </div>

           {parsed.length > 0 && (
             <div className="mb-4" style={{ maxWidth: '520px' }}>
               <input
                 value={searchQuery}
                 onChange={(e) => {
                   setSearchQuery(e.target.value);
                   setPage(1);
                 }}
                 placeholder={t('importSearchQuestion')}
               />
             </div>
           )}

           {parsed.length === 0 ? (
             <p className="text-muted text-center" style={{ padding: '2rem' }}>{t('importEmpty')}</p>
           ) : (
             <div className="grid gap-6">
               {pagedParsed.map((q, i) => (
                 <div key={q.id} style={{ border: '1px solid var(--border-color)', padding: '1rem', borderRadius: 'var(--radius-md)' }}>
                   <div className="mb-2 text-muted" style={{ fontWeight: 600 }}>{t('importQuestion', { index: (page - 1) * pageSize + i + 1 })}</div>
                   <textarea value={q.question_text} onChange={e => updateQuestionText(q.id, e.target.value)} rows={2} className="mb-2" />
                   
                   <div className="grid gap-2 mb-2">
                     {q.options.map((optText, oIdx) => {
                       const optLabel = String.fromCharCode(65 + oIdx);
                       return (
                         <div key={oIdx} className="flex gap-2 items-center">
                           <label className="flex items-center gap-1" style={{ cursor: 'pointer' }} title={t('importCorrect')}>
                             <input type="checkbox" style={{ width: 'auto' }} checked={q.correct_options.includes(optLabel)} onChange={() => toggleCorrectOption(q.id, optLabel)} />
                             <span style={{ fontSize: '0.8rem', fontWeight: 600, color: q.correct_options.includes(optLabel) ? 'var(--success-color)' : 'var(--text-secondary)' }}>{t('importCorrect')}</span>
                           </label>
                           <span style={{ fontWeight: 600, width: '20px' }}>{optLabel}.</span>
                           <input 
                             value={optText} 
                             onChange={e => updateOption(q.id, oIdx, e.target.value)} 
                           />
                           <button onClick={() => removeOption(q.id, oIdx)} title={t('importRemoveOption')} style={{ color: 'var(--danger-color)', padding: '0.5rem', background: 'none' }}><Trash2 size={16}/></button>
                         </div>
                       );
                     })}
                   </div>
                   <button onClick={() => addOption(q.id)} className="btn btn-secondary text-sm" style={{ padding: '0.3rem 0.6rem' }}><Plus size={14} /> {t('importAddOption')}</button>
                 </div>
               ))}
               <PaginationControls
                 page={page}
                 pageSize={pageSize}
                 totalItems={filteredCount}
                 onPageChange={setPage}
                 onPageSizeChange={(size) => {
                   setPageSize(size);
                   setPage(1);
                 }}
                 pageSizeOptions={[3, 5, 10, 20]}
               />
             </div>
           )}
        </div>
      </div>
    </div>
  );
}
