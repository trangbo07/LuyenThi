import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { Subject, ExamSession, Question } from '../types/database.types';
import PaginationControls from './PaginationControls';
import { useI18n } from '../i18n/I18nProvider';

type ConfusionAlert = {
  id: string;
  kind:
    | 'same-options-different-correct'
    | 'similar-question-different-correct'
    | 'partial-options-overlap-different-correct';
  sessionA: string;
  sessionB: string;
  questionA: string;
  questionB: string;
  optionsA: string[];
  optionsB: string[];
  overlapOptions: string[];
  overlapCount: number;
  correctA: string;
  correctB: string;
  similarity: number;
};

function normalizeText(input: string) {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function optionSignature(options: string[]) {
  return [...options].map((o) => normalizeText(o)).sort().join('||');
}

function correctSignature(correct: string[]) {
  return [...correct].sort().join(',');
}

function textSimilarity(a: string, b: string) {
  const ta = new Set(normalizeText(a).split(' ').filter(Boolean));
  const tb = new Set(normalizeText(b).split(' ').filter(Boolean));
  if (ta.size === 0 || tb.size === 0) return 0;
  let intersection = 0;
  for (const t of ta) {
    if (tb.has(t)) intersection += 1;
  }
  const union = new Set([...ta, ...tb]).size;
  return union ? intersection / union : 0;
}

export default function QuestionConfusionChecker() {
  const { t } = useI18n();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [selectedSubject, setSelectedSubject] = useState('all');
  const [loading, setLoading] = useState(false);
  const [alerts, setAlerts] = useState<ConfusionAlert[]>([]);
  const [keyword, setKeyword] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [expandedIds, setExpandedIds] = useState<string[]>([]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('subjects').select('*').order('name');
      if (data) setSubjects(data);
    })();
  }, []);

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      let sessionQuery = supabase
        .from('exam_sessions')
        .select('id, code, name, subject_id, subjects(code, name)');

      if (selectedSubject !== 'all') {
        sessionQuery = sessionQuery.eq('subject_id', selectedSubject);
      }

      const { data: subjectSessions, error: sessionError } = await sessionQuery;

      if (sessionError) {
        alert(t('qcLoadSessionsError', { message: sessionError.message }));
        setAlerts([]);
        setLoading(false);
        return;
      }

      const sessionRows = (subjectSessions || []) as Array<
        Pick<ExamSession, 'id' | 'code' | 'name' | 'subject_id'> & {
          subjects?: { code: string; name: string } | { code: string; name: string }[] | null;
        }
      >;
      const sessionIds = sessionRows.map((s) => s.id);
      const sessionLabelMap = new Map(
        sessionRows.map((s) => {
          const subj = Array.isArray(s.subjects) ? s.subjects[0] : s.subjects;
          const subjectPart = subj ? `${subj.code} - ${subj.name}` : s.subject_id;
          return [s.id, `${subjectPart} | ${s.code} - ${s.name}`];
        })
      );

      if (sessionIds.length === 0) {
        setAlerts([]);
        setLoading(false);
        return;
      }

      const { data: subjectQuestions, error: questionError } = await supabase
        .from('questions')
        .select('id, session_id, question_text, options, correct_options')
        .in('session_id', sessionIds);

      if (questionError || !subjectQuestions) {
        alert(t('qcLoadQuestionsError'));
        setAlerts([]);
        setLoading(false);
        return;
      }

      const rows = (subjectQuestions as Question[]).map((q) => {
        const normalizedOptions = (q.options || []).map((o) => normalizeText(o)).filter(Boolean);
        return {
          ...q,
          normalizedText: normalizeText(q.question_text || ''),
          optionSet: new Set(normalizedOptions),
          optionSig: optionSignature(q.options || []),
          correctSig: correctSignature(q.correct_options || [])
        };
      });

      const optionTokenIndex = new Map<string, number[]>();
      rows.forEach((row, idx) => {
        for (const token of row.optionSet) {
          if (!optionTokenIndex.has(token)) optionTokenIndex.set(token, []);
          optionTokenIndex.get(token)!.push(idx);
        }
      });

      const found: ConfusionAlert[] = [];
      const uniquePair = new Set<string>();

      for (let i = 0; i < rows.length; i += 1) {
        const a = rows[i];
        const candidateIdx = new Set<number>();
        for (const token of a.optionSet) {
          const idxList = optionTokenIndex.get(token) || [];
          for (const j of idxList) {
            if (j > i) candidateIdx.add(j);
          }
        }

        for (const j of candidateIdx) {
          const b = rows[j];
          if (a.session_id === b.session_id) continue;
          if (!a.correctSig || !b.correctSig || a.correctSig === b.correctSig) continue;

          const overlapTokens: string[] = [];
          for (const token of a.optionSet) {
            if (b.optionSet.has(token)) overlapTokens.push(token);
          }

          const overlapCount = overlapTokens.length;
          if (overlapCount < 2) continue;

          const similarity = textSimilarity(a.question_text || '', b.question_text || '');
          const textClose = a.normalizedText === b.normalizedText || similarity >= 0.35;
          if (!textClose) continue;

          const key = [a.id, b.id].sort().join('|');
          if (uniquePair.has(key)) continue;
          uniquePair.add(key);

          const kind: ConfusionAlert['kind'] =
            a.optionSig === b.optionSig && a.normalizedText === b.normalizedText
              ? 'same-options-different-correct'
              : a.optionSig === b.optionSig
                ? 'similar-question-different-correct'
                : 'partial-options-overlap-different-correct';

          found.push({
            id: key,
            kind,
            sessionA: sessionLabelMap.get(a.session_id) || a.session_id,
            sessionB: sessionLabelMap.get(b.session_id) || b.session_id,
            questionA: a.question_text,
            questionB: b.question_text,
            optionsA: a.options || [],
            optionsB: b.options || [],
            overlapOptions: overlapTokens,
            overlapCount,
            correctA: a.correctSig,
            correctB: b.correctSig,
            similarity
          });
        }
      }

      found.sort((x, y) => {
        const rank = (k: ConfusionAlert['kind']) => {
          if (k === 'same-options-different-correct') return 0;
          if (k === 'similar-question-different-correct') return 1;
          return 2;
        };
        if (x.kind !== y.kind) return rank(x.kind) - rank(y.kind);
        if (x.overlapCount !== y.overlapCount) return y.overlapCount - x.overlapCount;
        return y.similarity - x.similarity;
      });

      setAlerts(found);
      setExpandedIds([]);
      setLoading(false);
      setPage(1);
    };

    void run();
  }, [selectedSubject]);

  const filtered = useMemo(() => {
    const q = keyword.trim().toLowerCase();
    if (!q) return alerts;
    return alerts.filter((a) => {
      return (
        a.sessionA.toLowerCase().includes(q) ||
        a.sessionB.toLowerCase().includes(q) ||
        a.questionA.toLowerCase().includes(q) ||
        a.questionB.toLowerCase().includes(q) ||
        a.overlapOptions.join(' ').toLowerCase().includes(q) ||
        a.correctA.toLowerCase().includes(q) ||
        a.correctB.toLowerCase().includes(q)
      );
    });
  }, [alerts, keyword]);

  const paged = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);

  return (
    <div className="card animate-fade-in">
      <h3 className="mb-4">{t('qcTitle')}</h3>

      <div className="flex gap-4 mb-4" style={{ flexWrap: 'wrap' }}>
        <select
          value={selectedSubject}
          onChange={(e) => {
            setSelectedSubject(e.target.value);
            setKeyword('');
            setPage(1);
          }}
          style={{ maxWidth: '420px' }}
        >
          <option value="all">{t('qcSelectScope')}</option>
          {subjects.map((s) => (
            <option key={s.id} value={s.id}>
              {s.code} - {s.name}
            </option>
          ))}
        </select>

        <input
          value={keyword}
          onChange={(e) => {
            setKeyword(e.target.value);
            setPage(1);
          }}
          placeholder={t('qcFilterPlaceholder')}
          style={{ maxWidth: '520px' }}
        />
      </div>

      <p className="text-sm text-muted" style={{ fontWeight: 700 }}>
        {t('qcHint')}
      </p>

      {loading && <p>{t('qcLoading')}</p>}

      {!loading && filtered.length === 0 && (
        <p className="text-muted">{t('qcNoConflict')}</p>
      )}

      {!loading && filtered.length > 0 && (
        <>
          <div className="grid gap-3">
            {paged.map((a, idx) => (
              <div key={a.id} className="card" style={{ marginTop: 0, background: '#fff9eb', borderColor: '#fcd34d' }}>
                <div style={{ fontWeight: 850, color: '#92400e', marginBottom: '0.35rem' }}>
                  #{(page - 1) * pageSize + idx + 1}{' '}
                  {a.kind === 'same-options-different-correct'
                    ? 'Same text/options but different correct answer'
                    : a.kind === 'similar-question-different-correct'
                      ? 'Very similar text, same options, different correct answer'
                      : 'Slightly changed text with 2+ overlapping options and different correct answer'}
                </div>
                <div className="text-sm" style={{ color: '#78350f', fontWeight: 700, marginBottom: '0.4rem' }}>
                  {a.sessionA} ({a.correctA}) vs {a.sessionB} ({a.correctB})
                </div>
                <div className="text-sm" style={{ color: '#451a03', lineHeight: 1.6 }}>
                  A: {a.questionA}
                </div>
                <div className="text-sm" style={{ color: '#451a03', lineHeight: 1.6 }}>
                  B: {a.questionB}
                </div>
                <div className="text-sm" style={{ color: '#92400e', marginTop: '0.35rem', fontWeight: 700 }}>
                  {t('qcSimilarity', { percent: (a.similarity * 100).toFixed(0), count: a.overlapCount })}
                </div>
                <div className="text-sm" style={{ color: '#92400e', marginTop: '0.2rem', fontWeight: 700 }}>
                  {t('qcSharedOptionText', { text: a.overlapOptions.slice(0, 4).join(' | ') || t('qcNotAvailable') })}
                </div>

                <button
                  type="button"
                  className="btn btn-secondary mt-4"
                  style={{ padding: '0.45rem 0.8rem' }}
                  onClick={() => {
                    setExpandedIds((prev) =>
                      prev.includes(a.id) ? prev.filter((id) => id !== a.id) : [...prev, a.id]
                    );
                  }}
                >
                  {expandedIds.includes(a.id) ? t('qcHideOptions') : t('qcShowOptions')}
                </button>

                {expandedIds.includes(a.id) && (
                  <div className="grid gap-3 mt-4">
                    <div>
                      <div style={{ fontWeight: 800, color: '#78350f', marginBottom: '0.3rem' }}>{t('qcQuestionAOptions')}</div>
                      <div className="grid gap-2">
                        {a.optionsA.map((opt, oIdx) => {
                          const label = String.fromCharCode(65 + oIdx);
                          const isCorrect = a.correctA.split(',').includes(label);
                          return (
                            <div key={`${a.id}-a-${oIdx}`} className="text-sm" style={{ padding: '0.4rem 0.55rem', borderRadius: '0.4rem', border: '1px solid #fcd34d', background: isCorrect ? '#dcfce7' : '#fff' }}>
                              <b>{label}.</b> {opt}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div>
                      <div style={{ fontWeight: 800, color: '#78350f', marginBottom: '0.3rem' }}>{t('qcQuestionBOptions')}</div>
                      <div className="grid gap-2">
                        {a.optionsB.map((opt, oIdx) => {
                          const label = String.fromCharCode(65 + oIdx);
                          const isCorrect = a.correctB.split(',').includes(label);
                          return (
                            <div key={`${a.id}-b-${oIdx}`} className="text-sm" style={{ padding: '0.4rem 0.55rem', borderRadius: '0.4rem', border: '1px solid #fcd34d', background: isCorrect ? '#dcfce7' : '#fff' }}>
                              <b>{label}.</b> {opt}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          <PaginationControls
            page={page}
            pageSize={pageSize}
            totalItems={filtered.length}
            onPageChange={setPage}
            onPageSizeChange={(size) => {
              setPageSize(size);
              setPage(1);
            }}
            pageSizeOptions={[5, 10, 20, 30]}
          />
        </>
      )}
    </div>
  );
}
