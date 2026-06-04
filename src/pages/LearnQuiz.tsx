import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../auth/useAuth';
import type { Question } from '../types/database.types';
import { MOCK_SIZE } from './LearnMap';
import confetti from 'canvas-confetti';
import { CheckCircle, XCircle, Star, ArrowLeft, RotateCcw, BookOpen, Map } from 'lucide-react';

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const PASS_PERCENT = 70;

export default function LearnQuiz() {
  const { sessionId, mockIndex } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const idx = parseInt(mockIndex ?? '0');

  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [answered, setAnswered] = useState(false);
  const [streak, setStreak] = useState(0);
  const [maxStreak, setMaxStreak] = useState(0);
  const [loading, setLoading] = useState(true);
  const [done, setDone] = useState(false);
  const [saving, setSaving] = useState(false);

  // Use ref to avoid React batching issues for final score calculation
  const resultsRef = useRef<boolean[]>([]);
  const [displayScore, setDisplayScore] = useState(0); // for live display

  useEffect(() => {
    if (!sessionId) return;
    (async () => {
      const from = idx * MOCK_SIZE;
      const to = from + MOCK_SIZE - 1;
      const { data } = await supabase
        .from('questions')
        .select('id, question_text, options, correct_options')
        .eq('session_id', sessionId)
        .order('created_at')
        .range(from, to);
      setQuestions(shuffle((data as Question[]) || []));
      setLoading(false);
    })();
  }, [sessionId, idx]);

  const total = questions.length;
  const current = questions[currentIdx];

  const handleSelect = (label: string) => {
    if (answered) return;
    setSelected(label);
    setAnswered(true);

    const correct = current.correct_options.includes(label);
    resultsRef.current = [...resultsRef.current, correct];

    if (correct) {
      setDisplayScore(s => s + 1);
      setStreak(prev => {
        const next = prev + 1;
        setMaxStreak(m => Math.max(m, next));
        return next;
      });
    } else {
      setStreak(0);
    }
  };

  const handleNext = async () => {
    const isLast = currentIdx + 1 >= total;

    if (isLast) {
      const correctCount = resultsRef.current.filter(Boolean).length;
      const finalScore = Math.round((correctCount / total) * 100);
      const finalStars = finalScore >= 90 ? 3 : finalScore >= 70 ? 2 : finalScore >= 50 ? 1 : 0;
      const passed = finalScore >= PASS_PERCENT;

      setDone(true);

      if (user?.id && sessionId) {
        setSaving(true);
        // Check existing progress to preserve best score
        const { data: existing } = await supabase
          .from('mock_progress')
          .select('stars, best_score')
          .eq('user_id', user.id)
          .eq('session_id', sessionId)
          .eq('mock_index', idx)
          .maybeSingle();

        const newStars = Math.max(finalStars, existing?.stars ?? 0);
        const newBest = Math.max(finalScore, existing?.best_score ?? 0);

        await supabase.from('mock_progress').upsert(
          {
            user_id: user.id,
            session_id: sessionId,
            mock_index: idx,
            stars: newStars,
            best_score: newBest,
            attempts: (existing as { attempts?: number } | null)?.attempts
              ? ((existing as { attempts: number }).attempts + 1)
              : 1,
          },
          { onConflict: 'user_id,session_id,mock_index' }
        );

        setSaving(false);

        if (passed) {
          confetti({ particleCount: 150, spread: 90, origin: { y: 0.55 } });
        }
      }
    } else {
      setCurrentIdx(i => i + 1);
      setSelected(null);
      setAnswered(false);
    }
  };

  const handleRetry = () => {
    resultsRef.current = [];
    setCurrentIdx(0);
    setSelected(null);
    setAnswered(false);
    setDisplayScore(0);
    setStreak(0);
    setDone(false);
    setQuestions(q => shuffle([...q]));
  };

  if (loading) {
    return <div className="card text-center" style={{ padding: '2rem', maxWidth: 700, margin: '0 auto' }}>Đang tải câu hỏi...</div>;
  }

  // ── DONE SCREEN ──
  if (done) {
    const correctCount = resultsRef.current.filter(Boolean).length;
    const finalScore = Math.round((correctCount / total) * 100);
    const finalStars = finalScore >= 90 ? 3 : finalScore >= 70 ? 2 : finalScore >= 50 ? 1 : 0;
    const passed = finalScore >= PASS_PERCENT;

    return (
      <div className="animate-fade-in" style={{ maxWidth: '620px', margin: '0 auto', textAlign: 'center' }}>
        <div className="card" style={{ padding: '2.5rem' }}>
          <div style={{ fontSize: '3.5rem', marginBottom: '0.25rem' }}>
            {passed ? '🎉' : finalScore >= 50 ? '😅' : '😓'}
          </div>
          <h2 style={{ marginBottom: '0.25rem' }}>
            {passed ? 'Xuất sắc! Mock hoàn thành!' : 'Chưa qua được!'}
          </h2>

          {/* Score */}
          <div style={{ fontSize: '3rem', fontWeight: 900, color: passed ? 'var(--success-color)' : 'var(--danger-color)', margin: '0.5rem 0' }}>
            {correctCount}/{total}
          </div>

          {/* Stars */}
          <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginBottom: '1rem' }}>
            {[1, 2, 3].map(s => (
              <Star
                key={s}
                size={36}
                fill={s <= finalStars ? '#f59e0b' : 'none'}
                color="#f59e0b"
              />
            ))}
          </div>

          {/* Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1.5rem' }}>
            <div style={{ padding: '0.75rem', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)' }}>
              <div style={{ fontWeight: 900, fontSize: '1.4rem', color: 'var(--success-color)' }}>{finalScore}%</div>
              <div className="text-muted" style={{ fontSize: '0.82rem' }}>Điểm đạt</div>
            </div>
            <div style={{ padding: '0.75rem', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)' }}>
              <div style={{ fontWeight: 900, fontSize: '1.4rem', color: '#f59e0b' }}>🔥 {maxStreak}</div>
              <div className="text-muted" style={{ fontSize: '0.82rem' }}>Chuỗi dài nhất</div>
            </div>
          </div>

          {!passed && (
            <p className="text-muted" style={{ marginBottom: '1.5rem', fontSize: '0.9rem' }}>
              Cần ≥ {PASS_PERCENT}% để qua. Hãy xem lại thẻ học rồi thử lại nhé!
            </p>
          )}
          {passed && (
            <p className="text-muted" style={{ marginBottom: '1.5rem', fontSize: '0.9rem' }}>
              Mock {idx + 1} đã được mở khóa! Tiếp tục mock {idx + 2} nào.
            </p>
          )}

          {saving && <p className="text-muted" style={{ fontSize: '0.82rem', marginBottom: '1rem' }}>Đang lưu tiến độ...</p>}

          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button className="btn btn-secondary" onClick={() => navigate(`/learn/${sessionId}/mock/${idx}/study`)}>
              <BookOpen size={15} /> Học lại thẻ
            </button>
            <button className="btn btn-secondary" onClick={handleRetry}>
              <RotateCcw size={15} /> Thử lại quiz
            </button>
            <button className="btn btn-primary" onClick={() => navigate('/learn')}>
              <Map size={15} /> Bản đồ Mock
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── QUIZ SCREEN ──
  const isCorrectOption = (label: string) => current.correct_options.includes(label);

  const getOptionStyle = (label: string): React.CSSProperties => {
    if (!answered) {
      return {
        background: selected === label ? 'rgba(99,102,241,0.1)' : 'var(--bg-secondary)',
        border: selected === label ? '2px solid var(--primary-color)' : '1.5px solid var(--border-color)',
        color: 'var(--text-primary)',
        cursor: 'pointer',
      };
    }
    if (isCorrectOption(label)) {
      return { background: 'rgba(34,197,94,0.14)', border: '2px solid var(--success-color)', color: 'var(--success-color)', cursor: 'default' };
    }
    if (selected === label) {
      return { background: 'rgba(239,68,68,0.1)', border: '2px solid #ef4444', color: '#ef4444', cursor: 'default' };
    }
    return { background: 'var(--bg-secondary)', border: '1.5px solid var(--border-color)', color: 'var(--text-secondary)', opacity: 0.5, cursor: 'default' };
  };

  return (
    <div className="animate-fade-in" style={{ maxWidth: '720px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <button className="btn btn-secondary" onClick={() => navigate(`/learn/${sessionId}/mock/${idx}/study`)}>
          <ArrowLeft size={16} /> Học lại
        </button>
        <div style={{ fontWeight: 700, color: 'var(--text-secondary)', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          Câu {currentIdx + 1}/{total}
          &nbsp;·&nbsp;
          <span style={{ color: 'var(--success-color)' }}>✅ {displayScore}</span>
          {streak >= 3 && (
            <span style={{ color: '#f59e0b', fontWeight: 900 }}>🔥 {streak}</span>
          )}
        </div>
        <div style={{ width: 80 }} />
      </div>

      {/* Progress bar */}
      <div className="progress-track" style={{ marginBottom: '1.5rem' }}>
        <div
          className="progress-fill"
          style={{ width: `${(currentIdx / total) * 100}%`, transition: 'width 0.3s ease' }}
        />
      </div>

      {/* Question card */}
      <div className="card" style={{ marginBottom: '1rem', padding: '1.5rem' }}>
        <div style={{ fontSize: '1.1rem', fontWeight: 600, lineHeight: 1.7 }}>
          {current.question_text}
        </div>
      </div>

      {/* Options */}
      <div style={{ display: 'grid', gap: '0.6rem', marginBottom: '1.25rem' }}>
        {current.options.map((opt, i) => {
          const label = String.fromCharCode(65 + i);
          const style = getOptionStyle(label);
          const isCorrect = answered && isCorrectOption(label);
          const isWrong = answered && selected === label && !isCorrectOption(label);

          return (
            <button
              key={i}
              disabled={answered}
              onClick={() => handleSelect(label)}
              style={{
                textAlign: 'left',
                padding: '0.75rem 1rem',
                borderRadius: 'var(--radius-md)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.6rem',
                fontWeight: isCorrect ? 700 : 400,
                transition: 'all 0.15s',
                ...style,
              }}
            >
              {isCorrect && <CheckCircle size={16} style={{ flexShrink: 0 }} />}
              {isWrong && <XCircle size={16} style={{ flexShrink: 0 }} />}
              {!isCorrect && !isWrong && <span style={{ width: 16, flexShrink: 0 }} />}
              <span style={{ fontWeight: 700, opacity: 0.55, marginRight: 2 }}>{label}.</span>
              {opt}
            </button>
          );
        })}
      </div>

      {/* Feedback + Next */}
      {answered && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontWeight: 700, fontSize: '0.95rem', color: isCorrectOption(selected!) ? 'var(--success-color)' : '#ef4444' }}>
            {isCorrectOption(selected!) ? (
              streak >= 3 ? `🔥 ${streak} câu đúng liên tiếp!` : '✅ Đúng rồi!'
            ) : (
              '❌ Sai mất rồi. Xem lại đáp án nhé.'
            )}
          </div>
          <button className="btn btn-primary" onClick={handleNext}>
            {currentIdx + 1 >= total ? '🏁 Xem kết quả' : 'Tiếp →'}
          </button>
        </div>
      )}
    </div>
  );
}
