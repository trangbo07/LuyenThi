import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './useAuth';

export default function RequireAuth({
  children,
  allowRoles
}: {
  children: React.ReactNode;
  allowRoles?: Array<'admin' | 'user'>;
}) {
  const { user, role, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="card text-center" style={{ padding: '3rem' }}>
        Checking sign-in...
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (allowRoles && allowRoles.length > 0) {
    if (!role) {
      return (
        <div className="card text-center" style={{ padding: '3rem' }}>
          No access (profile missing). Please sign out and sign in again, or contact an admin.
        </div>
      );
    }
    if (!allowRoles.includes(role)) {
      return <Navigate to="/generate" replace />;
    }
  }

  return <>{children}</>;
}

