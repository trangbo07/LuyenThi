import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { shuffleSeeded } from '../lib/seedShuffle';
import { Copy, PlayCircle, Trophy } from 'lucide-react';
import { useI18n } from '../i18n/I18nProvider';
import { useToast } from '../components/Toast';

type DbCompetition = {
  id: string;
  code: string;
  subject_id: string | null;
  time_limit_minutes: number;
  status: 'open' | 'closed';
};

type DbQuestion = {
  id: string;
  question_text: string;
  options: string[];
  correct_options: string[];
};

type ProcessedQuestion = {
  id: string;
  question_text: string;
  correct_options: string[];
  shuffled_options: { label: string; text: string }[];
};

export default function BattleRoom() {
  const { code } = useParams();
  const navigate = useNavigate();
  const { t } = useI18n();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [competition, setCompetition] = useState<DbCompetition | null>(null);
  const [questions, setQuestions] = useState<ProcessedQuestion[]>([]);
  const [alreadyPlayed, setAlreadyPlayed] = useState(false);
  const [questionCount, setQuestionCount] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!code) return;
      setLoading(true);
      setLoadError(null);

      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) {
        setLoading(false);
        navigate('/login');
        return;
      }

      const { data: comp, error: compErr } = await supabase
        .from('competitions')
        .select('id, code, subject_id, time_limit_minutes, status')
        .eq('code', code)
        .single();

      if (cancelled) return;
      if (compErr || !comp) {
        setLoading(false);
        toast(t('battleRoomNotFound'), 'error');
        navigate('/battle/join');
        return;
      }

      setCompetition(comp as DbCompetition);

      // Record join for ranking / same-room RLS
      const { error: joinErr } = await supabase
        .from('competition_participants')
        .insert([{ competition_id: comp.id, user_id: userId }]);
      if (joinErr && joinErr.code !== '23505') {
        console.warn('competition_participants:', joinErr);
      }

      // Already attempted this room? (one per user)
      const { data: priorAttempt } = await supabase
        .from('attempts')
        .select('id')
        .eq('competition_id', comp.id)
        .eq('user_id', userId)
        .maybeSingle();

      if (cancelled) return;
      if (priorAttempt) {
        const { count } = await supabase
          .from('competition_questions')
          .select('*', { count: 'exact', head: true })
          .eq('competition_id', comp.id);
        setQuestionCount(count ?? 0);
        setAlreadyPlayed(true);
        setQuestions([]);
        setLoading(false);
        return;
      }

      // Avoid embed questions(...) — split queries for reliable PostgREST
      const { data: cqRows, error: cqErr } = await supabase
        .from('competition_questions')
        .select('question_id, position')
        .eq('competition_id', comp.id)
        .order('position', { ascending: true });

      if (cancelled) return;
      if (cqErr) {
        setLoadError(t('battleLoadError', { message: cqErr.message }));
        setLoading(false);
        return;
      }
      const cqList = cqRows || [];
      if (cqList.length === 0) {
        setLoadError(t('battleCannotStartNoQuestions'));
        setQuestionCount(0);
        setQuestions([]);
        setLoading(false);
        return;
      }

      const qids = cqList.map((r) => r.question_id);
      const { data: qsRows, error: qsErr } = await supabase
        .from('questions')
        .select('id, question_text, options, correct_options')
        .in('id', qids);

      if (cancelled) return;
      if (qsErr || !qsRows?.length) {
          setLoadError(t('battleLoadError', { message: qsErr?.message || t('battleUnknownError') }));
        setLoading(false);
        return;
      }

      const byId = new Map((qsRows as DbQuestion[]).map((q) => [q.id, q]));
      const raw = cqList.map((row) => byId.get(row.question_id)).filter(Boolean) as DbQuestion[];

      const processed = raw.map((q) => {
        const opts = (q.options || []).map((text, idx) => ({ label: String.fromCharCode(65 + idx), text }));
        const shuffled = shuffleSeeded(opts, `battle:${code}:q:${q.id}`);
        return {
          id: q.id,
          question_text: q.question_text,
          correct_options: q.correct_options || [],
          shuffled_options: shuffled
        };
      });

      setQuestions(processed);
      setQuestionCount(processed.length);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [code, navigate, t]);

  const roomClosed = competition?.status === 'closed';

  const canStart = useMemo(
    () => !loading && competition && questions.length > 0 && !alreadyPlayed && !roomClosed,
    [loading, competition, questions.length, alreadyPlayed, roomClosed]
  );

  const copyCode = async () => {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      toast(t('battleRoomCopied', { code }), 'success');
    } catch {
      toast(t('battleCopyFailed', { code }), 'info');
    }
  };

  if (loading) {
    return (
      <div className="card text-center" style={{ padding: '3rem' }}>
        {t('battleLoadingRoom')}
      </div>
    );
  }

  if (!competition) return null;

  return (
    <div className="animate-fade-in" style={{ maxWidth: '900px', margin: '0 auto' }}>
      <div className="glass-card mb-6" style={{ padding: '1.25rem' }}>
        <div className="flex justify-between items-center" style={{ gap: '1rem', flexWrap: 'wrap' }}>
          <div>
            <h2 style={{ margin: 0 }}>{t('battleRoomTitle')}</h2>
            <div className="text-sm" style={{ color: 'var(--text-secondary)', fontWeight: 700, marginTop: '0.25rem' }}>
              {t('battleCode')}: <span style={{ fontWeight: 950, color: 'var(--text-primary)' }}>{competition.code}</span> • {t('battleQuestionCount', { count: questionCount })} • {t('battleMinutes', { count: competition.time_limit_minutes })}
            </div>
          </div>
          <div className="flex gap-3">
            <button className="btn btn-secondary" onClick={copyCode} style={{ borderRadius: '999px' }}>
              <Copy size={18} /> {t('battleCopyCode')}
            </button>
            <button className="btn btn-secondary" onClick={() => navigate(`/battle/${competition.code}/ranking`)} style={{ borderRadius: '999px' }}>
              <Trophy size={18} /> {t('battleRanking')}
            </button>
          </div>
        </div>
      </div>

      <div className="card" style={{ padding: '1.25rem' }}>
        <div style={{ fontWeight: 900, marginBottom: '0.35rem' }}>{t('battleHowItWorks')}</div>
        <div className="text-sm" style={{ color: 'var(--text-secondary)', fontWeight: 650, lineHeight: 1.5 }}>
          {t('battleHowItWorksText')}
        </div>

        {loadError && (
          <div className="mt-4 p-3" style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 'var(--radius-md)', fontWeight: 650, color: '#991b1b', lineHeight: 1.5 }}>
            {loadError}
          </div>
        )}

        {roomClosed && (
          <div className="mt-4 p-3" style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 'var(--radius-md)', fontWeight: 700, color: '#991b1b' }}>
            {t('battleRoomClosed')}
          </div>
        )}

        {alreadyPlayed && !roomClosed && (
          <div className="mt-4 p-3" style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 'var(--radius-md)', fontWeight: 700, color: '#1e40af' }}>
            {t('battleAlreadyPlayed')}
          </div>
        )}

        {alreadyPlayed && (
          <button
            type="button"
            className="btn btn-primary mt-4"
            style={{ width: '100%', padding: '1rem', borderRadius: '999px' }}
            onClick={() => navigate(`/battle/${competition.code}/ranking`)}
          >
            <Trophy size={18} /> {t('battleViewRankingBtn')}
          </button>
        )}

        {!alreadyPlayed && (
          <>
            <button
              className="btn btn-primary mt-6"
              style={{ width: '100%', padding: '1rem', borderRadius: '999px' }}
              disabled={!canStart}
              onClick={() => {
                navigate('/exam', {
                  state: {
                    questions,
                    subjectId: competition.subject_id || '',
                    timeLimit: competition.time_limit_minutes,
                    competitionId: competition.id,
                    battleCode: competition.code
                  }
                });
              }}
            >
              <PlayCircle size={18} /> {t('battleStartExam')}
            </button>
            {!canStart && !roomClosed && (
              <p className="text-sm mt-3 text-center" style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>
                {loadError
                  ? t('battleCannotStartFix')
                  : questions.length === 0
                    ? t('battleCannotStartNoQuestions')
                    : t('battleCannotStartDefault')}
              </p>
            )}
          </>
        )}

      </div>
    </div>
  );
}

