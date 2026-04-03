import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, Navigate, Outlet, useLocation } from 'react-router-dom';
import { BookOpen, LayoutDashboard, PlayCircle, History as HistoryIcon, Swords, LogOut, Menu, X, UserRound } from 'lucide-react';
import Home from './pages/Home';
import QuestionBank from './pages/QuestionBank';
import ImportQuestions from './pages/Import';
import GenerateExam from './pages/GenerateExam';
import ExamSession from './pages/ExamSession';
import Result from './pages/Result';
import History from './pages/History';
import AttemptReview from './pages/AttemptReview';
import Login from './pages/Login';
import Register from './pages/Register';
import RequireAuth from './auth/RequireAuth';
import { useAuth } from './auth/useAuth';
import { clearSupabaseAuthStorage } from './lib/clearSupabaseAuthStorage';
import BattleCreate from './pages/BattleCreate';
import BattleJoin from './pages/BattleJoin';
import BattleRoom from './pages/BattleRoom';
import BattleRanking from './pages/BattleRanking';
import BattleManage from './pages/BattleManage';
import AdminLayout from './layouts/AdminLayout';
import AdminHome from './pages/AdminHome';
import Profile from './pages/Profile';

function Nav() {
  const { user, profile, role, signOut } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (!mobileMenuOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mobileMenuOpen]);

  const handleSignOut = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    let fallbackNavigated = false;
    const t = window.setTimeout(() => {
      fallbackNavigated = true;
      clearSupabaseAuthStorage();
      window.location.replace('/login');
    }, 10_000);
    try {
      await signOut();
    } finally {
      window.clearTimeout(t);
      if (!fallbackNavigated) {
        window.location.replace('/login');
      }
    }
  };

  const closeMenu = () => setMobileMenuOpen(false);

  const navLinkClass = 'nav-item nav-item--sheet flex items-center gap-2';

  return (
    <nav className="navbar">
      <div className="container navbar-inner">
        <div className="navbar-row">
          <button
            type="button"
            className="navbar-menu-trigger"
            aria-expanded={mobileMenuOpen}
            aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
            onClick={() => setMobileMenuOpen((o) => !o)}
          >
            {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>

          <Link to="/" className="logo" onClick={closeMenu}>
            <BookOpen size={24} className="shrink-0" />
            <span className="logo-full">Exam System Pro By TrangBo07</span>
            <span className="logo-short" aria-hidden="true">Exam Pro</span>
          </Link>

          <div className="navbar-links-desktop">
            {role === 'admin' && (
              <Link to="/admin" className="nav-item flex items-center gap-2">
                <LayoutDashboard size={18} /> Dashboard
              </Link>
            )}
            {user && (
              <>
                <Link to="/generate" className="nav-item flex items-center gap-2"><PlayCircle size={18} /> Exam</Link>
                <Link to="/history" className="nav-item flex items-center gap-2"><HistoryIcon size={18} /> History</Link>
                <Link to="/battle/join" className="nav-item flex items-center gap-2"><Swords size={18} /> Join battle</Link>
                <Link to="/profile" className="nav-item flex items-center gap-2"><UserRound size={18} /> Profile</Link>
              </>
            )}
            {!user ? (
              <Link to="/login" className="nav-item flex items-center gap-2">Log in</Link>
            ) : (
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-sm navbar-user-pill" title={profile?.full_name || user.email || ''}>
                  {profile?.full_name || user.email || 'Signed in'}
                </span>
                <button
                  type="button"
                  className="btn btn-secondary flex items-center gap-2 navbar-signout-btn"
                  onClick={handleSignOut}
                  disabled={loggingOut}
                  title="Sign out"
                >
                  <LogOut size={18} />
                  <span className="navbar-signout-text">{loggingOut ? 'Signing out…' : 'Sign out'}</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {mobileMenuOpen && (
        <button type="button" className="navbar-backdrop" aria-label="Close menu" onClick={closeMenu} />
      )}

      <div className={`navbar-sheet ${mobileMenuOpen ? 'open' : ''}`} id="mobile-nav">
        <div className="navbar-sheet-header">
          <span className="navbar-sheet-title">Menu</span>
          <button type="button" className="navbar-sheet-close" aria-label="Close" onClick={closeMenu}>
            <X size={22} />
          </button>
        </div>
        <div className="navbar-sheet-links">
          {role === 'admin' && (
            <Link to="/admin" className={navLinkClass} onClick={closeMenu}>
              <LayoutDashboard size={20} /> Dashboard
            </Link>
          )}
          {user && (
            <>
              <Link to="/generate" className={navLinkClass} onClick={closeMenu}><PlayCircle size={20} /> Exam</Link>
              <Link to="/history" className={navLinkClass} onClick={closeMenu}><HistoryIcon size={20} /> History</Link>
              <Link to="/battle/join" className={navLinkClass} onClick={closeMenu}><Swords size={20} /> Join battle</Link>
              <Link to="/profile" className={navLinkClass} onClick={closeMenu}><UserRound size={20} /> Profile</Link>
            </>
          )}
          {!user ? (
            <Link to="/login" className={navLinkClass} onClick={closeMenu}>Log in</Link>
          ) : (
            <>
              <div className="navbar-sheet-user">{profile?.full_name || user.email}</div>
              <button
                type="button"
                className={`${navLinkClass} navbar-sheet-signout`}
                onClick={() => {
                  closeMenu();
                  void handleSignOut();
                }}
                disabled={loggingOut}
              >
                <LogOut size={20} /> {loggingOut ? 'Signing out…' : 'Sign out'}
              </button>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}

function LayoutMain() {
  return (
    <main className="container main-app-content mt-4 animate-fade-in">
      <Outlet />
    </main>
  );
}

function AppShell() {
  const location = useLocation();
  const hideMainNav = location.pathname.startsWith('/admin');

  return (
    <>
      {!hideMainNav && <Nav />}
      <Routes>
        <Route
          path="/admin"
          element={
            <RequireAuth allowRoles={['admin']}>
              <AdminLayout />
            </RequireAuth>
          }
        >
          <Route index element={<AdminHome />} />
          <Route path="import" element={<ImportQuestions />} />
          <Route path="bank" element={<QuestionBank />} />
          <Route path="battle/create" element={<BattleCreate />} />
          <Route path="battle/manage" element={<BattleManage />} />
        </Route>

        <Route element={<LayoutMain />}>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          <Route path="/generate" element={<RequireAuth allowRoles={['admin', 'user']}><GenerateExam /></RequireAuth>} />
          <Route path="/exam" element={<RequireAuth allowRoles={['admin', 'user']}><ExamSession /></RequireAuth>} />
          <Route path="/result" element={<RequireAuth allowRoles={['admin', 'user']}><Result /></RequireAuth>} />
          <Route path="/history" element={<RequireAuth allowRoles={['admin', 'user']}><History /></RequireAuth>} />
          <Route path="/profile" element={<RequireAuth allowRoles={['admin', 'user']}><Profile /></RequireAuth>} />
          <Route path="/attempt/:id" element={<RequireAuth allowRoles={['admin', 'user']}><AttemptReview /></RequireAuth>} />
          <Route path="/battle/join" element={<RequireAuth allowRoles={['admin', 'user']}><BattleJoin /></RequireAuth>} />
          <Route path="/import" element={<Navigate to="/admin/import" replace />} />
          <Route path="/bank" element={<Navigate to="/admin/bank" replace />} />
          <Route path="/battle/create" element={<Navigate to="/admin/battle/create" replace />} />
          <Route path="/battle/manage" element={<Navigate to="/admin/battle/manage" replace />} />
          <Route path="/battle/:code/ranking" element={<RequireAuth allowRoles={['admin', 'user']}><BattleRanking /></RequireAuth>} />
          <Route path="/battle/:code" element={<RequireAuth allowRoles={['admin', 'user']}><BattleRoom /></RequireAuth>} />
        </Route>
      </Routes>
    </>
  );
}

function App() {
  return (
    <Router>
      <AppShell />
    </Router>
  );
}

export default App;
