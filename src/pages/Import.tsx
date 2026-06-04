import { useState, useEffect, useMemo } from 'react';
import { UploadCloud, Save, Plus, Trash2 } from 'lucide-react';
import Tesseract from 'tesseract.js';
import { supabase } from '../lib/supabase';
import type { Subject, ExamSession } from '../types/database.types';
import PaginationControls from '../components/PaginationControls';
import { useI18n } from '../i18n/I18nProvider';
import { useToast } from '../components/Toast';

type ParsedQuestion = {
  id: string; // temp id for UI
  question_text: string;
  options: string[];
  correct_options: string[];
};

const QUESTION_LIMIT_PER_PARSE = 50;

const NOISE_LINE_PATTERNS = [
  /^\(?\s*choose\s+\d+\s+answer(?:s)?\s*\)?$/i,
  /^fureview\.com$/i,
  /^fuoverflow\.com$/i,
  /^page\s*\d+$/i,
  /^(next|prev|previous|back|submit|close|open)\b/i,
  /^question\s*:\s*\d+$/i,
  /^\(?\s*chọn\s+\d+\s+đáp\s+án\s*\)?$/i,
];

const SHORT_NOISE_TOKENS = new Set(['ll', 'mm']);
const QUESTION_BOUNDARY_TOKENS = new Set(['re', 'pe', 'pa', 'pr']);
const BLANK_LINE_SENTINEL = '__BLANK_LINE__';

function fixCommonOcrTypos(input: string): string {
  return input
    .replace(/\bTh1s\b/g, 'This')
    .replace(/\bth1s\b/g, 'this')
    .replace(/\b1s\b/g, 'is')
    .replace(/\b0f\b/g, 'of')
    .replace(/([A-Za-z])1([A-Za-z])/g, '$1i$2');
}

function normalizeLine(input: string): string {
  return fixCommonOcrTypos(input)
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isNoiseLine(line: string): boolean {
  if (!line) return true;
  if (/^q\s*:\s*\d+\]?$/i.test(line)) return true;
  if (SHORT_NOISE_TOKENS.has(line.toLowerCase())) return true;
  return NOISE_LINE_PATTERNS.some((pattern) => pattern.test(line));
}

function isQuestionBoundaryLine(line: string): boolean {
  return QUESTION_BOUNDARY_TOKENS.has(normalizeLine(line).toLowerCase());
}

function cleanQuestionPrefix(line: string): { isQuestionStart: boolean; content: string } {
  const normalized = normalizeLine(line);
  let match = normalized.match(/^(?:question|câu)\s*\d+\s*[:.)-]?\s*(.*)$/i);
  if (match) return { isQuestionStart: true, content: (match[1] ?? '').trim() };

  match = normalized.match(/^\d{1,3}\s*[.)-]\s*(.*)$/);
  if (match) return { isQuestionStart: true, content: (match[1] ?? '').trim() };

  return { isQuestionStart: false, content: normalized };
}

function parseOptionLine(line: string): { label: string; content: string } | null {
  const normalized = normalizeLine(line);
  const match = normalized.match(/^[\[\](){}<>|\\/\-_*\u25A1\u25A0\u2022\u00B7O0]*\s*([A-H])\s*[.)\]:-]\s*(.+)$/i);
  if (!match) return null;
  return {
    label: match[1].toUpperCase(),
    content: normalizeLine(match[2]),
  };
}

function parseLooseOptionLine(line: string): { label: string; content: string } | null {
  const normalized = normalizeLine(line);
  const match = normalized.match(/^[\[\](){}<>|\\/\-_*\u25A1\u25A0\u2022\u00B7O0]*\s*([A-H])\s+(.+)$/i);
  if (!match) return null;
  return {
    label: match[1].toUpperCase(),
    content: normalizeLine(match[2]),
  };
}

function parseMergedOptionLine(line: string): { label: string; content: string } | null {
  const normalized = normalizeLine(line);
  const match = normalized.match(/^([A-H])([A-H])\s+(.+)$/i);
  if (!match) return null;
  return {
    label: match[1].toUpperCase(),
    content: normalizeLine(`${match[2]} ${match[3]}`),
  };
}

function optionLabelToIndex(label: string): number {
  return label.toUpperCase().charCodeAt(0) - 65;
}

function parseOptionLabelOnly(line: string): string | null {
  const normalized = normalizeLine(line);
  const match = normalized.match(/^[\[\](){}<>|\\/\-_*\u25A1\u25A0\u2022\u00B7O0]*\s*([A-H])\s*[.)\]:-]?$/i);
  if (!match) return null;
  return match[1].toUpperCase();
}

function isLikelyQuestionLine(line: string): boolean {
  const normalized = normalizeLine(line);
  if (normalized.length < 14) return false;
  if (/[?:]$/.test(normalized)) return true;
  return /^(true or false|which|what|who|when|where|why|how|you\b|your\b|as you|the scope management|in project management|the process improvement plan|an output of|all the following)/i.test(normalized);
}

function splitOptionContentAndQuestionTail(content: string): { optionText: string; questionTail: string | null } {
  const normalized = normalizeLine(content);
  if (!normalized) return { optionText: '', questionTail: null };

  const marker = /\b(true or false|which|what|who|when|where|why|how|you\b|your\b|as you|the scope management|in project management|the process improvement plan)\b/i;
  const match = marker.exec(normalized);
  if (!match || typeof match.index !== 'number' || match.index <= 0) {
    return { optionText: normalized, questionTail: null };
  }

  const optionText = normalized.slice(0, match.index).trim();
  const questionTail = normalized.slice(match.index).trim();
  if (!optionText || !questionTail || !isLikelyQuestionLine(questionTail)) {
    return { optionText: normalized, questionTail: null };
  }

  const optionWordCount = optionText.split(/\s+/).filter(Boolean).length;
  const looksLikeShortOption = optionWordCount <= 4 || /^(true|false)$/i.test(optionText);
  if (!looksLikeShortOption) {
    return { optionText: normalized, questionTail: null };
  }

  return { optionText, questionTail };
}

function splitInlineOptions(line: string): string[] {
  if (!line.trim()) return [BLANK_LINE_SENTINEL];
  const normalized = normalizeLine(line);
  if (!normalized) return [];

  // Split lines that contain inline choices: "... A. ... B. ... C. ..."
  const withOptionBreaks = normalized.replace(/\s+(?=[\[\](){}<>|\\/\-_*\u25A1\u25A0\u2022\u00B7O0]*\s*[A-H]\s*[.)\]:-]\s*[A-Za-z])/g, '\n');
  return withOptionBreaks
    .split('\n')
    .map((part) => part.trim())
    .filter(Boolean);
}

function appendText(base: string, next: string): string {
  if (!next) return base;
  if (!base) return next;
  return `${base} ${next}`;
}

async function preprocessExamScreenshot(file: File): Promise<string | File> {
  const bitmap = await createImageBitmap(file);
  try {
    const baseCanvas = document.createElement('canvas');
    baseCanvas.width = bitmap.width;
    baseCanvas.height = bitmap.height;
    const baseCtx = baseCanvas.getContext('2d');
    if (!baseCtx) {
      return file;
    }

    baseCtx.drawImage(bitmap, 0, 0);
    const { width, height } = baseCanvas;
    const pixels = baseCtx.getImageData(0, 0, width, height).data;

    let dividerX = Math.floor(width * 0.38);
    let bestScore = 0;

    // Find the vertical red divider that usually separates sidebar and question panel.
    for (let x = Math.floor(width * 0.2); x < Math.floor(width * 0.8); x++) {
      let score = 0;
      for (let y = Math.floor(height * 0.08); y < Math.floor(height * 0.95); y += 2) {
        const idx = (y * width + x) * 4;
        const r = pixels[idx];
        const g = pixels[idx + 1];
        const b = pixels[idx + 2];
        if (r > 170 && g < 90 && b < 90) score++;
      }
      if (score > bestScore) {
        bestScore = score;
        dividerX = x;
      }
    }

    const xStart = Math.min(width - 80, Math.max(0, dividerX + 6));
    const yStart = Math.max(0, Math.floor(height * 0.08));
    const cropWidth = Math.max(80, width - xStart - Math.floor(width * 0.015));
    const cropHeight = Math.max(80, height - yStart - Math.floor(height * 0.03));

    const scale = 2;
    const outputCanvas = document.createElement('canvas');
    outputCanvas.width = Math.max(1, cropWidth * scale);
    outputCanvas.height = Math.max(1, cropHeight * scale);
    const outputCtx = outputCanvas.getContext('2d');
    if (!outputCtx) {
      return file;
    }

    outputCtx.imageSmoothingEnabled = true;
    outputCtx.imageSmoothingQuality = 'high';
    outputCtx.drawImage(
      baseCanvas,
      xStart,
      yStart,
      cropWidth,
      cropHeight,
      0,
      0,
      outputCanvas.width,
      outputCanvas.height,
    );

    const imgData = outputCtx.getImageData(0, 0, outputCanvas.width, outputCanvas.height);
    const data = imgData.data;

    for (let i = 0; i < data.length; i += 4) {
      const gray = Math.round(data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114);
      const boosted = Math.max(0, Math.min(255, (gray - 128) * 1.6 + 128));
      const normalized = boosted > 242 ? 255 : boosted;
      data[i] = normalized;
      data[i + 1] = normalized;
      data[i + 2] = normalized;
    }

    outputCtx.putImageData(imgData, 0, 0);
    return outputCanvas.toDataURL('image/png');
  } finally {
    bitmap.close();
  }
}

function parseQuestionsFromText(rawText: string): ParsedQuestion[] {
  const lines = rawText
    .replace(/\r/g, '')
    .split('\n')
    .flatMap((line) => splitInlineOptions(line));

  const parsedData: ParsedQuestion[] = [];
  let current: ParsedQuestion | null = null;
  let lastOptionIndex = -1;
  let pendingOptionLabel: string | null = null;
  let blankLineCount = 0;

  const flushCurrent = () => {
    if (!current) return;
    const question_text = normalizeLine(current.question_text);
    const options = current.options.map((opt) => normalizeLine(opt)).filter(Boolean);
    const hasEnoughData = question_text.length >= 8 && options.length >= 2;

    if (hasEnoughData) {
      parsedData.push({
        ...current,
        question_text,
        options,
      });
    }

    current = null;
    lastOptionIndex = -1;
    pendingOptionLabel = null;
    blankLineCount = 0;
  };

  const ensureCurrent = (): ParsedQuestion => {
    if (current) return current;
    current = {
      id: Math.random().toString(),
      question_text: '',
      options: [],
      correct_options: [],
    };
    return current;
  };

  const hasCurrentContent = () => {
    if (!current) return false;
    return Boolean(current.question_text || current.options.length > 0);
  };

  const hasCurrentQuestionText = () => {
    if (!current) return false;
    return Boolean(current.question_text);
  };

  const currentOptionCount = () => {
    if (!current) return 0;
    return current.options.length;
  };

  for (const rawLine of lines) {
    if (rawLine === BLANK_LINE_SENTINEL) {
      blankLineCount += 1;
      if (blankLineCount >= 2 && hasCurrentContent()) {
        flushCurrent();
      }
      continue;
    }

    blankLineCount = 0;
    const normalizedLine = normalizeLine(rawLine);
    if (isQuestionBoundaryLine(normalizedLine)) {
      if (hasCurrentContent()) {
        flushCurrent();
      }
      continue;
    }
    if (isNoiseLine(normalizedLine)) continue;

    const option = parseOptionLine(normalizedLine);
    if (option) {
      const active = ensureCurrent();
      const { optionText, questionTail } = splitOptionContentAndQuestionTail(option.content);
      active.options.push(optionText || option.content);
      lastOptionIndex = active.options.length - 1;
      pendingOptionLabel = null;

      if (questionTail) {
        flushCurrent();
        const nextQuestion = ensureCurrent();
        nextQuestion.question_text = appendText(nextQuestion.question_text, questionTail);
      }
      continue;
    }

    const mergedOption = parseMergedOptionLine(normalizedLine);
    if (mergedOption && hasCurrentQuestionText()) {
      const active = ensureCurrent();
      const optionCount = active.options.length;
      const labelIndex = optionLabelToIndex(mergedOption.label);
      const isExpectedLabel = labelIndex === optionCount;
      const alreadyInOptionMode = optionCount > 0 || lastOptionIndex >= 0;

      if (isExpectedLabel && (alreadyInOptionMode || optionCount === 0)) {
        const { optionText, questionTail } = splitOptionContentAndQuestionTail(mergedOption.content);
        active.options.push(optionText || mergedOption.content);
        lastOptionIndex = active.options.length - 1;
        pendingOptionLabel = null;

        if (questionTail) {
          flushCurrent();
          const nextQuestion = ensureCurrent();
          nextQuestion.question_text = appendText(nextQuestion.question_text, questionTail);
        }
        continue;
      }
    }

    const looseOption = parseLooseOptionLine(normalizedLine);
    if (looseOption && hasCurrentQuestionText()) {
      const active = ensureCurrent();
      const optionCount = active.options.length;
      const labelIndex = optionLabelToIndex(looseOption.label);
      const isExpectedLabel = labelIndex === optionCount;
      const alreadyInOptionMode = optionCount > 0 || lastOptionIndex >= 0;

      if (isExpectedLabel && (alreadyInOptionMode || optionCount === 0)) {
        const { optionText, questionTail } = splitOptionContentAndQuestionTail(looseOption.content);
        active.options.push(optionText || looseOption.content);
        lastOptionIndex = active.options.length - 1;
        pendingOptionLabel = null;

        if (questionTail) {
          flushCurrent();
          const nextQuestion = ensureCurrent();
          nextQuestion.question_text = appendText(nextQuestion.question_text, questionTail);
        }
        continue;
      }
    }

    const labelOnly = parseOptionLabelOnly(normalizedLine);
    if (labelOnly) {
      const active = ensureCurrent();
      active.options.push('');
      lastOptionIndex = active.options.length - 1;
      pendingOptionLabel = labelOnly;
      continue;
    }

    const { isQuestionStart, content } = cleanQuestionPrefix(normalizedLine);
    const cleanedContent = normalizeLine(content);
    if (isQuestionStart) {
      if (hasCurrentContent()) {
        flushCurrent();
      }
      const active = ensureCurrent();
      if (cleanedContent && !isNoiseLine(cleanedContent)) {
        active.question_text = appendText(active.question_text, cleanedContent);
      }
      continue;
    }

    if (hasCurrentContent() && lastOptionIndex >= 0 && currentOptionCount() >= 2 && isLikelyQuestionLine(cleanedContent)) {
      flushCurrent();
      const active = ensureCurrent();
      active.question_text = appendText(active.question_text, cleanedContent);
      continue;
    }

    if (!cleanedContent || isNoiseLine(cleanedContent)) {
      continue;
    }

    const active = ensureCurrent();
    if (lastOptionIndex >= 0) {
      active.options[lastOptionIndex] = appendText(active.options[lastOptionIndex], cleanedContent);
      if (pendingOptionLabel) {
        pendingOptionLabel = null;
      }
    } else {
      active.question_text = appendText(active.question_text, cleanedContent);
    }
  }

  flushCurrent();
  return parsedData.slice(0, QUESTION_LIMIT_PER_PARSE);
}

async function parseQuestionsFromDocx(file: File): Promise<ParsedQuestion[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mammoth = await import('mammoth') as any;
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.convertToHtml({ arrayBuffer });

  const parser = new DOMParser();
  const doc = parser.parseFromString(result.value as string, 'text/html');
  const paragraphs = Array.from(doc.querySelectorAll('p'));

  const questions: ParsedQuestion[] = [];
  let current: ParsedQuestion | null = null;

  const flush = () => {
    if (current && current.question_text.trim() && current.options.length >= 2) {
      questions.push(current);
    }
    current = null;
  };

  for (const para of paragraphs) {
    const rawText = (para.textContent ?? '').trim();
    if (!rawText) continue;

    // Question line: "1." "2." ... or "Câu 1:"
    const qMatch = rawText.match(/^(?:câu\s*)?\d+[.)]\s*(.+)/i);
    if (qMatch) {
      flush();
      current = {
        id: Math.random().toString(),
        question_text: qMatch[1].trim(),
        options: [],
        correct_options: [],
      };
      continue;
    }

    // Option line: "a." "b." ... (lower or upper)
    const optMatch = rawText.match(/^([a-dA-D])[.)]\s*(.+)/);
    if (optMatch && current) {
      const label = optMatch[1].toUpperCase();
      current.options.push(optMatch[2].trim());
      // Bold text anywhere in this paragraph = correct answer
      if (para.querySelector('strong') !== null || para.querySelector('b') !== null) {
        current.correct_options.push(label);
      }
      continue;
    }

    // Continuation of question text before any options
    if (current && current.options.length === 0) {
      current.question_text += ' ' + rawText;
    }
  }

  flush();
  return questions.slice(0, QUESTION_LIMIT_PER_PARSE);
}

export default function ImportQuestions() {
  const { t } = useI18n();
  const { toast } = useToast();
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [parsed, setParsed] = useState<ParsedQuestion[]>([]);
  
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [sessions, setSessions] = useState<ExamSession[]>([]);
  const [subjectId, setSubjectId] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [saving, setSaving] = useState(false);
  const [docxLoading, setDocxLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);
  const [searchQuery, setSearchQuery] = useState('');
  const [useLayoutFilter, setUseLayoutFilter] = useState(true);

  useEffect(() => {
    fetchSubjects();

    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.type.indexOf('image') === 0) {
          const file = item.getAsFile();
          if (file) {
            processImages([file]);
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

  const processImages = async (files: File[]) => {
    if (files.length === 0) return;
    setLoading(true);
    setProgress(0);
    
    try {
      const extracted: string[] = [];
      for (let i = 0; i < files.length; i++) {
        const imageSource = useLayoutFilter
          ? await preprocessExamScreenshot(files[i])
          : files[i];
        const result = await Tesseract.recognize(imageSource, 'eng', {
          logger: m => {
            if (m.status === 'recognizing text') {
              const overall = ((i + m.progress) / files.length) * 100;
              setProgress(Math.round(overall));
            }
          }
        });
        extracted.push(result.data.text);
      }

      const merged = extracted.join('\n\n');
      setText(prev => prev + (prev ? '\n\n' : '') + merged);
    } catch (err) {
      toast(t('importOcrError', { message: JSON.stringify(err) }), 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDocxUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setDocxLoading(true);
    try {
      const questions = await parseQuestionsFromDocx(file);
      if (questions.length === 0) {
        toast('Không tìm thấy câu hỏi trong file. Kiểm tra định dạng: số thứ tự + chữ cái a/b/c/d.', 'warning');
      } else {
        setParsed(questions);
        setPage(1);
        toast(`Đã đọc ${questions.length} câu hỏi từ file .docx`, 'success');
      }
    } catch (err) {
      toast(`Lỗi đọc file .docx: ${err instanceof Error ? err.message : String(err)}`, 'error');
    } finally {
      setDocxLoading(false);
      e.target.value = '';
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    await processImages(files);
    e.target.value = '';
  };

  const handleParse = () => {
    const parsedData = parseQuestionsFromText(text);
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
    if (!sessionId) { toast(t('importSelectSessionFirst'), 'warning'); return; }
    if (parsed.length === 0) { toast(t('importNoQuestionsSave'), 'warning'); return; }
    
    // Validation
    const invalid = parsed.find(p => !p.question_text || p.options.length < 2 || p.options.some(o => !o.trim()) || p.correct_options.length === 0);
    if (invalid) { toast(t('importValidationError'), 'warning'); return; }

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
      toast(t('importSaveSuccess'), 'success');
      setParsed([]);
      setText('');
      setPage(1);
    } else {
      toast(t('importSaveError', { message: error.message }), 'error');
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
            <label className="mb-3" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={useLayoutFilter}
                onChange={(e) => setUseLayoutFilter(e.target.checked)}
                style={{ width: 'auto' }}
              />
              <span className="text-sm text-muted">OCR ảnh đề thi bố cục cố định (khuyên dùng)</span>
            </label>
            <input type="file" accept="image/*" multiple onChange={handleImageUpload} style={{ width: '100%' }} />
            {loading && <p className="mt-2 text-primary" style={{ fontWeight: 600 }}>{t('importScanning', { progress })}</p>}
          </div>

          <div className="mt-4 border-2 border-dashed rounded p-4 text-center" style={{ border: '2px dashed var(--border-color)', borderRadius: 'var(--radius-lg)' }}>
            <p className="mb-2 text-sm text-muted" style={{ fontWeight: 600 }}>Import từ file Word (.docx)</p>
            <p className="mb-3 text-sm text-muted">Đáp án đúng phải được <strong>bôi đậm (bold)</strong> trong Word</p>
            <label style={{ display: 'inline-block', cursor: 'pointer' }}>
              <span className="btn btn-secondary" style={{ pointerEvents: 'none' }}>
                {docxLoading ? '⏳ Đang đọc...' : '📄 Chọn file .docx'}
              </span>
              <input
                type="file"
                accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                onChange={handleDocxUpload}
                disabled={docxLoading}
                style={{ display: 'none' }}
              />
            </label>
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
