import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ExternalLink, RefreshCw, Trophy, Star, Search, Swords, Clock3, Filter } from 'lucide-react';
import { supabase } from '../lib/supabase';

export default function BattleJoin() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [rooms, setRooms] = useState<Array<{
    id: string;
    code: string;
    time_limit_minutes: number;
    created_at: string;
    subjects?: { code: string; name: string } | { code: string; name: string }[] | null;
  }>>([]);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [favorites, setFavorites] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem('battle_favorite_codes');
      const parsed = JSON.parse(raw || '[]');
      return Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string') : [];
    } catch {
      return [];
    }
  });
  const [showFavOnly, setShowFavOnly] = useState(false);

  useEffect(() => {
    localStorage.setItem('battle_favorite_codes', JSON.stringify(favorites));
  }, [favorites]);

  const subjectLabel = useCallback((r: {
    subjects?: { code: string; name: string } | { code: string; name: string }[] | null;
  }) => {
    const s = r.subjects;
    if (!s) return '—';
    if (Array.isArray(s)) return s[0] ? `${s[0].code} - ${s[0].name}` : '—';
    return `${s.code} - ${s.name}`;
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: e } = await supabase
      .from('competitions')
      .select('id, code, time_limit_minutes, created_at, status, subjects ( code, name )')
      .eq('status', 'open')
      .order('created_at', { ascending: false });

    if (e) {
      setRooms([]);
      setError(e.message);
      setLoading(false);
      return;
    }

    setRooms((data || []) as any);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const latestCode = useMemo(() => (rooms.length > 0 ? rooms[0].code : null), [rooms]);

  const filteredRooms = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rooms.filter((r) => {
      const byFav = !showFavOnly || favorites.includes(r.code);
      if (!byFav) return false;
      if (!q) return true;
      const subject = subjectLabel(r).toLowerCase();
      return r.code.toLowerCase().includes(q) || subject.includes(q);
    });
  }, [rooms, showFavOnly, favorites, query, subjectLabel]);

  const toggleFavorite = (code: string) => {
    setFavorites((prev) => (prev.includes(code) ? prev.filter((c) => c !== code) : [code, ...prev]));
  };

  const favoriteCount = useMemo(() => rooms.filter((r) => favorites.includes(r.code)).length, [rooms, favorites]);

  return (
    <div className="animate-fade-in battle-join-shell">
      <section className="battle-join-hero">
        <div>
          <div className="battle-join-kicker"><Swords size={15} /> Real-time battle practice</div>
          <h2 style={{ marginBottom: '0.35rem' }}>Join a battle room</h2>
          <p className="text-sm" style={{ color: 'var(--text-secondary)', fontWeight: 650, lineHeight: 1.6, margin: 0, maxWidth: '66ch' }}>
            Enter open rooms instantly, pin your favorite codes, and jump to ranking with a cleaner, faster workflow.
          </p>
        </div>

        <div className="battle-join-hero-stats">
          <article className="battle-hero-stat">
            <div className="battle-hero-stat-label">Open rooms</div>
            <div className="battle-hero-stat-value">{rooms.length}</div>
          </article>
          <article className="battle-hero-stat">
            <div className="battle-hero-stat-label">Favorites</div>
            <div className="battle-hero-stat-value">{favoriteCount}</div>
          </article>
          <button
            type="button"
            className="btn btn-secondary battle-refresh-btn"
            onClick={() => void load()}
            disabled={loading}
            title="Refresh room list"
          >
            <RefreshCw size={18} className={loading ? 'spin' : ''} /> Refresh
          </button>
        </div>
      </section>

      <section className="glass-card battle-join-panel">
        <div className="battle-filter-row">
          <label className="battle-search-box" aria-label="Search rooms">
            <Search size={16} color="var(--text-secondary)" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by code or subject"
            />
          </label>

          <button
            type="button"
            className={`btn btn-secondary battle-filter-btn ${showFavOnly ? 'active' : ''}`}
            onClick={() => setShowFavOnly((v) => !v)}
          >
            <Filter size={16} /> {showFavOnly ? 'Showing favorites' : 'Favorites only'}
          </button>
        </div>

        <div className="battle-filter-meta text-sm">
          {!loading && !error && (
            <span>
              Displaying <b>{filteredRooms.length}</b> / {rooms.length} room{rooms.length === 1 ? '' : 's'}
            </span>
          )}
        </div>

        {loading && (
          <div className="card text-center" style={{ padding: '1.5rem 1rem' }}>
            Loading...
          </div>
        )}

        {!loading && error && (
          <div className="mt-4 p-3" style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 'var(--radius-md)', fontWeight: 700, color: '#991b1b', lineHeight: 1.5 }}>
            Could not load rooms: {error}
          </div>
        )}

        {!loading && !error && rooms.length === 0 && (
          <div className="card text-center" style={{ padding: '1.5rem 1rem' }}>
            There are no open rooms right now.
          </div>
        )}

        {!loading && rooms.length > 0 && filteredRooms.length === 0 && (
          <div className="card text-center" style={{ padding: '1.5rem 1rem' }}>
            No rooms match your current filter.
          </div>
        )}

        {!loading && filteredRooms.length > 0 && (
          <div className="battle-room-grid">
            {filteredRooms.map((r) => (
              <div
                key={r.id}
                className="battle-room-card"
              >
                <div style={{ minWidth: 0, flex: '1 1 300px' }}>
                  <div className="flex items-center gap-2" style={{ flexWrap: 'wrap', marginBottom: '0.35rem' }}>
                    <div className="battle-room-code">{r.code}</div>
                    {favorites.includes(r.code) && (
                      <span className="battle-tag favorite">
                        Favorite
                      </span>
                    )}
                    <span className="battle-tag">
                      <Clock3 size={13} /> {r.time_limit_minutes} min
                    </span>
                  </div>
                  <div className="text-sm" style={{ color: 'var(--text-secondary)', fontWeight: 700, lineHeight: 1.4 }}>
                    Subject: <span style={{ color: 'var(--text-primary)' }}>{subjectLabel(r)}</span>
                  </div>
                </div>

                <div className="battle-room-actions">
                  <button
                    type="button"
                    className="btn btn-primary battle-enter-btn"
                    onClick={() => navigate(`/battle/${r.code}`)}
                    title="Enter room"
                  >
                    <ExternalLink size={16} /> Enter room
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary battle-icon-btn"
                    onClick={() => toggleFavorite(r.code)}
                    title={favorites.includes(r.code) ? 'Remove favorite' : 'Add favorite'}
                  >
                    <Star size={16} fill={favorites.includes(r.code) ? 'currentColor' : 'none'} />
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => navigate(`/battle/${r.code}/ranking`)}
                    title="View ranking"
                  >
                    <Trophy size={16} /> Ranking
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {latestCode && !loading && (
          <div className="text-sm" style={{ color: 'var(--text-secondary)', fontWeight: 700, marginTop: '1rem', lineHeight: 1.5 }}>
            Latest room: <b>{latestCode}</b>.
          </div>
        )}
      </section>
    </div>
  );
}

