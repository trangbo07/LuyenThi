import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, NavLink, Navigate, Outlet, useLocation } from 'react-router-dom';
import { BookOpen, LayoutDashboard, PlayCircle, History as HistoryIcon, Swords, LogOut, Menu, X, GraduationCap, Layers } from 'lucide-react';
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
import LearnMap from './pages/LearnMap';
import LearnStudy from './pages/LearnStudy';
import LearnQuiz from './pages/LearnQuiz';
import LanguageSwitcher from './components/LanguageSwitcher';
import { useI18n } from './i18n/I18nProvider';

type NavProps = { mobileMenuOpen: boolean; setMobileMenuOpen: (v: boolean) => void };

function Nav({ mobileMenuOpen, setMobileMenuOpen }: NavProps) {
  const { user, profile, role, signOut } = useAuth();
  const { t } = useI18n();
  const location = useLocation();
  const [loggingOut, setLoggingOut] = useState(false);

  const handleSignOut = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    let fallbackNavigated = false;
    const timer = window.setTimeout(() => {
      fallbackNavigated = true;
      clearSupabaseAuthStorage();
      window.location.replace('/login');
    }, 10_000);
    try {
      await signOut();
    } finally {
      window.clearTimeout(timer);
      if (!fallbackNavigated) window.location.replace('/login');
    }
  };

  const closeMenu = () => setMobileMenuOpen(false);
  const p = location.pathname;

  // Active helpers
  const isExam     = p.startsWith('/generate') || p.startsWith('/exam') || p.startsWith('/result');
  const isHistory  = p.startsWith('/history') || p.startsWith('/attempt');
  const isBattle   = p.startsWith('/battle');
  const isPractice = p.startsWith('/practice');
  const isLearn    = p.startsWith('/learn');

  // NavLink className helpers
  const desktopCls = (active: boolean) =>
    `nav-item nav-item--desktop flex items-center gap-2${active ? ' nav-item--active' : ''}`;
  const sheetCls = (active: boolean) =>
    `nav-item nav-item--sheet flex items-center gap-2${active ? ' nav-item--sheet-active' : ''}`;

  const signOutText = loggingOut ? t('navSigningOut') : t('navSignOut');
  const displayName = profile?.full_name || user?.email?.split('@')[0] || t('navSignedIn');

  return (
    <nav className="navbar">
      <div className="container navbar-inner">
        <div className="navbar-row">

          {/* Logo — trái */}
          <Link to="/" className="logo" onClick={closeMenu}>
            <BookOpen size={22} className="shrink-0" />
            <span className="logo-full">{t('navBrandFull')}</span>
            <span className="logo-short" aria-hidden="true">{t('navBrandShort')}</span>
          </Link>

          {/* Desktop links (ẩn trên mobile) */}
          <div className="navbar-links-desktop">
            {role === 'admin' && (
              <NavLink to="/admin" className={({ isActive }) => desktopCls(isActive)}>
                <LayoutDashboard size={17} /> {t('navDashboard')}
              </NavLink>
            )}
            {user && (
              <>
                <NavLink to="/generate" className={() => desktopCls(isExam)}><PlayCircle size={17} /> {t('navExam')}</NavLink>
                <NavLink to="/practice" className={() => desktopCls(isPractice)}><GraduationCap size={17} /> {t('navPractice')}</NavLink>
                <NavLink to="/learn" className={() => desktopCls(isLearn)}><Layers size={17} /> Học Mock</NavLink>
                <NavLink to="/history" className={() => desktopCls(isHistory)}><HistoryIcon size={17} /> {t('navHistory')}</NavLink>
                <NavLink to="/battle/join" className={() => desktopCls(isBattle)}><Swords size={17} /> {t('navJoinBattle')}</NavLink>
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
                <Link to="/profile" className="navbar-avatar-btn" title={displayName}>
                  <span className="navbar-avatar-circle">{displayName.charAt(0).toUpperCase()}</span>
                  <span className="navbar-avatar-name">{displayName}</span>
                </Link>
                <button type="button" className="navbar-signout-btn" onClick={handleSignOut} disabled={loggingOut} title={signOutText}>
                  <LogOut size={17} />
                </button>
              </div>
            )}
          </div>

          {/* Hamburger — phải, chỉ mobile */}
          <button
            type="button"
            className="navbar-menu-trigger"
            aria-expanded={mobileMenuOpen}
            aria-label={mobileMenuOpen ? t('navCloseMenu') : t('navOpenMenu')}
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      {/* Sheet — mở từ hamburger */}
      <div className={`navbar-sheet ${mobileMenuOpen ? 'open' : ''}`} id="mobile-nav">
        <div className="navbar-sheet-header">
          <Link to="/" className="logo" style={{ fontSize: '1rem' }} onClick={closeMenu}>
            <BookOpen size={20} /> {t('navBrandFull')}
          </Link>
          <button type="button" className="navbar-sheet-close" aria-label={t('navCloseMenu')} onClick={closeMenu}>
            <X size={22} />
          </button>
        </div>

        <div className="navbar-sheet-links">
          {role === 'admin' && (
            <NavLink to="/admin" className={({ isActive }) => sheetCls(isActive)} onClick={closeMenu}>
              <LayoutDashboard size={20} /> {t('navDashboard')}
            </NavLink>
          )}
          {user ? (
            <>
              <p className="navbar-sheet-section-label">Học tập</p>
              <NavLink to="/generate"   className={() => sheetCls(isExam)}     onClick={closeMenu}><PlayCircle size={20} />   {t('navExam')}</NavLink>
              <NavLink to="/practice"   className={() => sheetCls(isPractice)} onClick={closeMenu}><GraduationCap size={20} /> {t('navPractice')}</NavLink>
              <NavLink to="/learn"      className={() => sheetCls(isLearn)}    onClick={closeMenu}><Layers size={20} />        Học Mock</NavLink>
              <p className="navbar-sheet-section-label">Tiện ích</p>
              <NavLink to="/history"    className={() => sheetCls(isHistory)}  onClick={closeMenu}><HistoryIcon size={20} />   {t('navHistory')}</NavLink>
              <NavLink to="/battle/join" className={() => sheetCls(isBattle)}  onClick={closeMenu}><Swords size={20} />        {t('navJoinBattle')}</NavLink>
              <div style={{ padding: '0.5rem 0.5rem 0' }}><LanguageSwitcher compact /></div>
            </>
          ) : (
            <>
              <NavLink to="/login" className={() => sheetCls(p === '/login')} onClick={closeMenu}>{t('navLogIn')}</NavLink>
              <div style={{ padding: '0.5rem 0.5rem 0' }}><LanguageSwitcher compact /></div>
            </>
          )}
        </div>

        {user && (
          <div className="navbar-sheet-footer">
            <Link to="/profile" className="navbar-sheet-profile" onClick={closeMenu}>
              <span className="navbar-avatar-circle">{displayName.charAt(0).toUpperCase()}</span>
              <div className="navbar-sheet-profile-info">
                <span className="navbar-sheet-profile-name">{displayName}</span>
                <span className="navbar-sheet-profile-sub">{t('navProfile')}</span>
              </div>
            </Link>
            <button type="button" className="navbar-sheet-signout-btn" onClick={() => { closeMenu(); void handleSignOut(); }} disabled={loggingOut} title={signOutText}>
              <LogOut size={18} />
            </button>
          </div>
        )}
      </div>
    </nav>
  );
}

function LayoutMain({ onOverlayClick }: { onOverlayClick?: () => void }) {
  return (
    <main
      className="container main-app-content mt-4 animate-fade-in"
      onClick={onOverlayClick}
    >
      <Outlet />
    </main>
  );
}

function AppShell() {
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const hideMainNav = location.pathname.startsWith('/admin');

  // Đóng sheet khi đổi trang + lock scroll body
  useEffect(() => { setMobileMenuOpen(false); }, [location.pathname]);
  useEffect(() => {
    if (!mobileMenuOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [mobileMenuOpen]);

  const closeMenu = () => setMobileMenuOpen(false);

  return (
    <>
      {!hideMainNav && <Nav mobileMenuOpen={mobileMenuOpen} setMobileMenuOpen={setMobileMenuOpen} />}

      {/* Backdrop ở ROOT LEVEL — overlay toàn bộ kể cả main content */}
      {mobileMenuOpen && !hideMainNav && (
        <button
          type="button"
          className="navbar-backdrop"
          aria-label="Đóng menu"
          onClick={closeMenu}
        />
      )}

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

        <Route element={<LayoutMain onOverlayClick={mobileMenuOpen ? closeMenu : undefined} />}>
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
          <Route path="/learn" element={<RequireAuth allowRoles={['admin', 'user']}><LearnMap /></RequireAuth>} />
          <Route path="/learn/:sessionId/mock/:mockIndex/study" element={<RequireAuth allowRoles={['admin', 'user']}><LearnStudy /></RequireAuth>} />
          <Route path="/learn/:sessionId/mock/:mockIndex/quiz" element={<RequireAuth allowRoles={['admin', 'user']}><LearnQuiz /></RequireAuth>} />
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
