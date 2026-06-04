import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import type { Question } from '../types/database.types';
import { MOCK_SIZE } from './LearnMap';
import { ArrowLeft, CheckCircle, XCircle, RotateCcw, ChevronRight } from 'lucide-react';

export default function LearnStudy() {
  const { sessionId, mockIndex } = useParams();
  const navigate = useNavigate();
  const idx = parseInt(mockIndex ?? '0');

  const [questions, setQuestions] = useState<Question[]>([]);
  const [queue, setQueue] = useState<Question[]>([]);
  const [cardIdx, setCardIdx] = useState(0);
  const [knownIds, setKnownIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

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
      const qs = (data as Question[]) || [];
      setQuestions(qs);
      setQueue(qs);
      setLoading(false);
    })();
  }, [sessionId, idx]);

  if (loading) {
    return <div className="card text-center" style={{ padding: '2rem', maxWidth: 700, margin: '0 auto' }}>Đang tải thẻ học...</div>;
  }

  if (cardIdx >= queue.length) {
    const knownCount = knownIds.size;
    const total = questions.length;
    return (
      <div className="animate-fade-in" style={{ maxWidth: '620px', margin: '0 auto', textAlign: 'center' }}>
        <div className="card" style={{ padding: '2.5rem' }}>
          <div style={{ fontSize: '3.5rem', marginBottom: '0.5rem' }}>🎓</div>
          <h2 style={{ marginBottom: '0.5rem' }}>Xem xong rồi!</h2>
          <p className="text-muted" style={{ marginBottom: '1.5rem' }}>
            Nhớ <strong>{knownCount}/{total}</strong> thẻ. Sẵn sàng kiểm tra chưa?
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
            <button
              className="btn btn-secondary"
              onClick={() => {
                setQueue(questions);
                setCardIdx(0);
                setKnownIds(new Set());
              }}
            >
              <RotateCcw size={16} /> Học lại từ đầu
            </button>
            <button
              className="btn btn-primary"
              onClick={() => navigate(`/learn/${sessionId}/mock/${idx}/quiz`)}
            >
              Vào kiểm tra <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  const current = queue[cardIdx];
  const remaining = queue.length - cardIdx;

  const handleKnow = () => {
    setKnownIds(prev => new Set([...prev, current.id]));
    setCardIdx(i => i + 1);
  };

  const handleReview = () => {
    setQueue(prev => [...prev, current]); // đưa về cuối hàng đợi
    setCardIdx(i => i + 1);
  };

  return (
    <div className="animate-fade-in" style={{ maxWidth: '720px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <button className="btn btn-secondary" onClick={() => navigate('/learn')}>
          <ArrowLeft size={16} /> Bản đồ
        </button>
        <div style={{ fontWeight: 700, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
          Mock {idx + 1} · Học thẻ · Còn {remaining} thẻ
        </div>
        <button
          className="btn btn-primary"
          style={{ fontSize: '0.85rem', padding: '0.4rem 0.9rem' }}
          onClick={() => navigate(`/learn/${sessionId}/mock/${idx}/quiz`)}
        >
          Kiểm tra ngay →
        </button>
      </div>

      {/* Progress bar */}
      <div className="progress-track" style={{ marginBottom: '0.5rem' }}>
        <div
          className="progress-fill"
          style={{ width: `${(knownIds.size / questions.length) * 100}%`, background: 'var(--success-color)' }}
        />
      </div>
      <div className="text-muted" style={{ fontSize: '0.82rem', marginBottom: '1.25rem', textAlign: 'center' }}>
        ✅ Nhớ rồi: {knownIds.size}/{questions.length}
      </div>

      {/* Câu hỏi */}
      <div className="card" style={{ padding: '1.5rem', marginBottom: '0.85rem' }}>
        <div style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-secondary)', marginBottom: '0.6rem', opacity: 0.7 }}>
          Câu hỏi
        </div>
        <div style={{ fontSize: '1.1rem', fontWeight: 600, lineHeight: 1.7 }}>
          {current.question_text}
        </div>
      </div>

      {/* Đáp án — luôn hiển thị, đúng tô xanh */}
      <div className="card" style={{ padding: '1.25rem', marginBottom: '1.25rem' }}>
        <div style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-secondary)', marginBottom: '0.75rem', opacity: 0.7 }}>
          Các đáp án
        </div>
        <div style={{ display: 'grid', gap: '0.5rem' }}>
          {current.options.map((opt, i) => {
            const label = String.fromCharCode(65 + i);
            const isCorrect = current.correct_options.includes(label);
            return (
              <div
                key={i}
                style={{
                  padding: '0.65rem 1rem',
                  borderRadius: 'var(--radius-md)',
                  background: isCorrect ? 'rgba(34,197,94,0.12)' : 'var(--bg-secondary)',
                  border: isCorrect ? '2px solid var(--success-color)' : '1.5px solid var(--border-color)',
                  color: isCorrect ? '#15803d' : 'var(--text-primary)',
                  fontWeight: isCorrect ? 700 : 400,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.6rem',
                }}
              >
                {isCorrect
                  ? <CheckCircle size={16} style={{ flexShrink: 0, color: 'var(--success-color)' }} />
                  : <span style={{ width: 16, flexShrink: 0 }} />
                }
                <span style={{ fontWeight: 700, opacity: 0.55, marginRight: 2 }}>{label}.</span>
                {opt}
                {isCorrect && (
                  <span style={{ marginLeft: 'auto', fontSize: '0.72rem', fontWeight: 800, color: 'var(--success-color)', background: 'rgba(34,197,94,0.12)', padding: '0.15rem 0.5rem', borderRadius: '999px', whiteSpace: 'nowrap' }}>
                    Đáp án đúng
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Nút hành động */}
      <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
        <button
          onClick={handleReview}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '0.65rem 1.6rem', borderRadius: '999px',
            background: 'rgba(239,68,68,0.08)', color: '#ef4444',
            border: '1.5px solid #ef4444', fontWeight: 700, cursor: 'pointer', fontSize: '0.95rem',
          }}
        >
          <XCircle size={18} /> Ôn thêm
        </button>
        <button
          onClick={handleKnow}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '0.65rem 1.6rem', borderRadius: '999px',
            background: 'rgba(34,197,94,0.1)', color: '#16a34a',
            border: '1.5px solid #16a34a', fontWeight: 700, cursor: 'pointer', fontSize: '0.95rem',
          }}
        >
          <CheckCircle size={18} /> Nhớ rồi
        </button>
      </div>
    </div>
  );
}
