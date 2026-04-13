import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, Navigate, Outlet, useLocation } from 'react-router-dom';
import { BookOpen, LayoutDashboard, PlayCircle, History as HistoryIcon, Swords, LogOut, Menu, X, UserRound, House, GraduationCap, ChevronRight } from 'lucide-react';
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
import PracticeSetup from './pages/PracticeSetup';
import PracticeSession from './pages/PracticeSession';
import PracticeProgress from './pages/PracticeProgress';
import LanguageSwitcher from './components/LanguageSwitcher';
import { useI18n } from './i18n/I18nProvider';

function Nav() {
  const { user, profile, role, signOut } = useAuth();
  const { t } = useI18n();
  const location = useLocation();
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
  const pathname = location.pathname;
  const showMobileDock = Boolean(user) && !pathname.startsWith('/admin') && !pathname.startsWith('/exam') && !pathname.startsWith('/result') && !pathname.startsWith('/practice/session');

  const dockActive = (key: 'home' | 'exam' | 'history' | 'battle' | 'practice' | 'profile') => {
    if (key === 'home') return pathname === '/';
    if (key === 'exam') return pathname.startsWith('/generate') || pathname.startsWith('/exam') || pathname.startsWith('/result');
    if (key === 'history') return pathname.startsWith('/history') || pathname.startsWith('/attempt');
    if (key === 'battle') return pathname.startsWith('/battle');
    if (key === 'practice') return pathname.startsWith('/practice');
    return pathname.startsWith('/profile');
  };

  const navLinkClass = 'nav-item nav-item--sheet flex items-center gap-2';
  const signOutText = loggingOut ? t('navSigningOut') : t('navSignOut');

  return (
    <nav className="navbar">
      <div className="container navbar-inner">
        <div className="navbar-row">
          <button
            type="button"
            className="navbar-menu-trigger"
            aria-expanded={mobileMenuOpen}
            aria-label={mobileMenuOpen ? t('navCloseMenu') : t('navOpenMenu')}
            onClick={() => setMobileMenuOpen((o) => !o)}
          >
            {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>

          <Link to="/" className="logo" onClick={closeMenu}>
            <BookOpen size={24} className="shrink-0" />
            <span className="logo-full">{t('navBrandFull')}</span>
            <span className="logo-short" aria-hidden="true">{t('navBrandShort')}</span>
          </Link>

          <div className="navbar-links-desktop">
            {role === 'admin' && (
              <Link to="/admin" className="nav-item flex items-center gap-2">
                <LayoutDashboard size={18} /> {t('navDashboard')}
              </Link>
            )}
            {user && (
              <>
                <Link to="/generate" className="nav-item flex items-center gap-2"><PlayCircle size={18} /> {t('navExam')}</Link>
                <Link to="/practice" className="nav-item flex items-center gap-2"><GraduationCap size={18} /> {t('navPractice')}</Link>
                <Link to="/history" className="nav-item flex items-center gap-2"><HistoryIcon size={18} /> {t('navHistory')}</Link>
                <Link to="/battle/join" className="nav-item flex items-center gap-2"><Swords size={18} /> {t('navJoinBattle')}</Link>
              </>
            )}

            <div className="navbar-divider" />

            {!user ? (
              <div className="flex items-center gap-3">
                <LanguageSwitcher compact />
                <Link to="/login" className="btn btn-primary">{t('navLogIn')}</Link>
              </div>
            ) : (
              <div className="flex items-center gap-2 navbar-user-actions">
                <LanguageSwitcher compact />
                <Link to="/profile" className="text-sm navbar-user-pill navbar-profile-link" title={profile?.full_name || user.email || ''}>
                  <UserRound size={16} />
                  <span>{profile?.full_name || user.email || t('navSignedIn')}</span>
                  <ChevronRight size={15} className="navbar-profile-link-arrow" />
                </Link>
                <button
                  type="button"
                  className="btn btn-secondary flex items-center gap-2 navbar-signout-btn"
                  onClick={handleSignOut}
                  disabled={loggingOut}
                  title={t('navSignOut')}
                >
                  <LogOut size={18} />
                  <span className="navbar-signout-text">{signOutText}</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {mobileMenuOpen && (
        <button type="button" className="navbar-backdrop" aria-label={t('navCloseMenu')} onClick={closeMenu} />
      )}

      <div className={`navbar-sheet ${mobileMenuOpen ? 'open' : ''}`} id="mobile-nav">
        <div className="navbar-sheet-header">
          <span className="navbar-sheet-title">{t('navMenu')}</span>
          <button type="button" className="navbar-sheet-close" aria-label={t('examClose')} onClick={closeMenu}>
            <X size={22} />
          </button>
        </div>
        <div className="navbar-sheet-links">
          {role === 'admin' && (
            <Link to="/admin" className={navLinkClass} onClick={closeMenu}>
              <LayoutDashboard size={20} /> {t('navDashboard')}
            </Link>
          )}
          {user && (
            <>
              <Link to="/generate" className={navLinkClass} onClick={closeMenu}><PlayCircle size={20} /> {t('navExam')}</Link>
              <Link to="/practice" className={navLinkClass} onClick={closeMenu}><GraduationCap size={20} /> {t('navPractice')}</Link>
              <Link to="/history" className={navLinkClass} onClick={closeMenu}><HistoryIcon size={20} /> {t('navHistory')}</Link>
              <Link to="/battle/join" className={navLinkClass} onClick={closeMenu}><Swords size={20} /> {t('navJoinBattle')}</Link>
              <LanguageSwitcher compact />
            </>
          )}
          {!user ? (
            <>
              <LanguageSwitcher compact />
              <Link to="/login" className={navLinkClass} onClick={closeMenu}>{t('navLogIn')}</Link>
            </>
          ) : (
            <>
              <Link to="/profile" className="navbar-sheet-user" onClick={closeMenu}>
                <span className="inline-flex items-center gap-2"><UserRound size={16} /> {profile?.full_name || user.email}</span>
                <span>{t('navProfile')}</span>
              </Link>
              <button
                type="button"
                className={`${navLinkClass} navbar-sheet-signout`}
                onClick={() => {
                  closeMenu();
                  void handleSignOut();
                }}
                disabled={loggingOut}
              >
                <LogOut size={20} /> {signOutText}
              </button>
            </>
          )}
        </div>
      </div>

      {showMobileDock && (
        <div className="mobile-dock" aria-label="Mobile navigation">
          <Link to="/" className={`mobile-dock-item ${dockActive('home') ? 'active' : ''}`}>
            <House size={18} />
            <span>{t('navHome')}</span>
          </Link>
          <Link to="/practice" className={`mobile-dock-item ${dockActive('practice') ? 'active' : ''}`}>
            <GraduationCap size={18} />
            <span>{t('navPractice')}</span>
          </Link>
          <Link to="/generate" className={`mobile-dock-item ${dockActive('exam') ? 'active' : ''}`}>
            <PlayCircle size={18} />
            <span>{t('navExam')}</span>
          </Link>
          <Link to="/history" className={`mobile-dock-item ${dockActive('history') ? 'active' : ''}`}>
            <HistoryIcon size={18} />
            <span>{t('navHistory')}</span>
          </Link>
          <Link to="/battle/join" className={`mobile-dock-item ${dockActive('battle') ? 'active' : ''}`}>
            <Swords size={18} />
            <span>{t('navJoinBattle')}</span>
          </Link>
        </div>
      )}
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
          <Route path="/practice" element={<RequireAuth allowRoles={['admin', 'user']}><PracticeSetup /></RequireAuth>} />
          <Route path="/practice/session" element={<RequireAuth allowRoles={['admin', 'user']}><PracticeSession /></RequireAuth>} />
          <Route path="/practice/progress" element={<RequireAuth allowRoles={['admin', 'user']}><PracticeProgress /></RequireAuth>} />
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
