import { NavLink, Outlet, Link } from 'react-router-dom';
import { useState } from 'react';
import {
  BookOpen,
  LayoutDashboard,
  Upload,
  Database,
  Swords,
  ClipboardList,
  LogOut,
  Menu,
  X,
  ArrowLeft
} from 'lucide-react';
import { useAuth } from '../auth/useAuth';
import { clearSupabaseAuthStorage } from '../lib/clearSupabaseAuthStorage';

const navItems = [
  { to: '/admin', end: true, label: 'Overview', icon: LayoutDashboard },
  { to: '/admin/import', label: 'Import', icon: Upload },
  { to: '/admin/bank', label: 'Question bank', icon: Database },
  { to: '/admin/battle/create', label: 'Create battle room', icon: Swords },
  { to: '/admin/battle/manage', label: 'Manage rooms', icon: ClipboardList }
];

export default function AdminLayout() {
  const { profile, user, signOut } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

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

  return (
    <div className="admin-dashboard">
      <aside className={`admin-dashboard-sidebar ${mobileOpen ? 'open' : ''}`}>
        <div className="admin-dashboard-brand">
          <Link to="/admin" className="admin-dashboard-logo" onClick={() => setMobileOpen(false)}>
            <BookOpen size={22} />
            <span>Admin</span>
          </Link>
          <button
            type="button"
            className="admin-dashboard-sidebar-close"
            aria-label="Close menu"
            onClick={() => setMobileOpen(false)}
          >
            <X size={22} />
          </button>
        </div>

        <nav className="admin-dashboard-nav">
          {navItems.map(({ to, end, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) => `admin-dashboard-nav-item ${isActive ? 'active' : ''}`}
              onClick={() => setMobileOpen(false)}
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="admin-dashboard-sidebar-footer">
          <Link to="/" className="admin-dashboard-back" onClick={() => setMobileOpen(false)}>
            <ArrowLeft size={18} /> Student view
          </Link>
        </div>
      </aside>

      {mobileOpen && (
        <button
          type="button"
          className="admin-dashboard-backdrop"
          aria-label="Close menu"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <div className="admin-dashboard-main">
        <header className="admin-dashboard-header">
          <div className="admin-dashboard-header-left">
            <button
              type="button"
              className="admin-dashboard-menu-btn"
              aria-label="Open menu"
              onClick={() => setMobileOpen(true)}
            >
              <Menu size={22} />
            </button>
            <h1 className="admin-dashboard-title">Dashboard</h1>
          </div>
          <div className="admin-dashboard-header-right">
            <span className="admin-dashboard-user" title={profile?.full_name || user?.email || ''}>
              {profile?.full_name || user?.email || 'Admin'}
            </span>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ padding: '0.45rem 0.95rem', borderRadius: '999px', gap: '0.4rem' }}
              onClick={handleSignOut}
              disabled={loggingOut}
            >
              <LogOut size={18} />
              {loggingOut ? 'Signing out…' : 'Sign out'}
            </button>
          </div>
        </header>

        <div className="admin-dashboard-content">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
