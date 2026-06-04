import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import type { Question } from '../types/database.types';
import { MOCK_SIZE } from './LearnMap';
import { ArrowLeft, CheckCircle, XCircle, RotateCcw, Eye, ChevronRight } from 'lucide-react';

export default function LearnStudy() {
  const { sessionId, mockIndex } = useParams();
  const navigate = useNavigate();
  const idx = parseInt(mockIndex ?? '0');

  const [questions, setQuestions] = useState<Question[]>([]);
  const [queue, setQueue] = useState<Question[]>([]);
  const [cardIdx, setCardIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [knownIds, setKnownIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [finished, setFinished] = useState(false);

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

  if (finished || cardIdx >= queue.length) {
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
                setFlipped(false);
                setKnownIds(new Set());
                setFinished(false);
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
    setFlipped(false);
    setCardIdx(i => i + 1);
  };

  const handleReview = () => {
    // Move current card to end of queue for review later
    setQueue(prev => [...prev, current]);
    setFlipped(false);
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
      <div className="progress-track" style={{ marginBottom: '1.5rem' }}>
        <div
          className="progress-fill"
          style={{ width: `${(knownIds.size / questions.length) * 100}%`, background: 'var(--success-color)' }}
        />
      </div>
      <div className="text-muted" style={{ fontSize: '0.82rem', marginBottom: '1rem', textAlign: 'center' }}>
        ✅ Nhớ rồi: {knownIds.size}/{questions.length}
      </div>

      {/* Flashcard */}
      <div
        className="card"
        onClick={() => !flipped && setFlipped(true)}
        style={{
          minHeight: '260px',
          cursor: flipped ? 'default' : 'pointer',
          padding: '2rem',
          userSelect: 'none',
          transition: 'box-shadow 0.15s',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
        }}
      >
        {!flipped ? (
          <div style={{ textAlign: 'center' }}>
            <div className="text-muted" style={{ fontSize: '0.82rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
              <Eye size={14} /> Nhấn để xem đáp án
            </div>
            <div style={{ fontSize: '1.1rem', fontWeight: 600, lineHeight: 1.7 }}>
              {current.question_text}
            </div>
          </div>
        ) : (
          <div>
            <div style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1rem', lineHeight: 1.65, color: 'var(--text-secondary)' }}>
              {current.question_text}
            </div>
            <div style={{ display: 'grid', gap: '0.5rem' }}>
              {current.options.map((opt, i) => {
                const label = String.fromCharCode(65 + i);
                const isCorrect = current.correct_options.includes(label);
                return (
                  <div
                    key={i}
                    style={{
                      padding: '0.6rem 1rem',
                      borderRadius: 'var(--radius-md)',
                      background: isCorrect ? 'rgba(34,197,94,0.14)' : 'var(--bg-secondary)',
                      border: isCorrect ? '1.5px solid var(--success-color)' : '1.5px solid var(--border-color)',
                      color: isCorrect ? 'var(--success-color)' : 'var(--text-primary)',
                      fontWeight: isCorrect ? 700 : 400,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                    }}
                  >
                    {isCorrect && <CheckCircle size={15} />}
                    <span style={{ fontWeight: 700, opacity: 0.65, marginRight: 2 }}>{label}.</span>
                    {opt}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Action buttons */}
      {flipped && (
        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', marginTop: '1.5rem' }}>
          <button
            onClick={handleReview}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '0.65rem 1.6rem', borderRadius: '999px',
              background: 'rgba(239,68,68,0.1)', color: '#ef4444',
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
              background: 'rgba(34,197,94,0.1)', color: '#22c55e',
              border: '1.5px solid #22c55e', fontWeight: 700, cursor: 'pointer', fontSize: '0.95rem',
            }}
          >
            <CheckCircle size={18} /> Nhớ rồi
          </button>
        </div>
      )}
    </div>
  );
}
