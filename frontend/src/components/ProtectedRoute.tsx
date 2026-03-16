import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

interface ProtectedRouteProps {
  adminOnly?: boolean;
}

export function ProtectedRoute({ adminOnly = false }: ProtectedRouteProps) {
  const location = useLocation();
  const initialized = useAuthStore((state) => state.initialized);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const staffRole = useAuthStore((state) => state.user?.staffRole);

  if (!initialized) {
    return <p className="muted-text">Loading session...</p>;
  }

  if (!isAuthenticated) {
    const redirectTo = `${location.pathname}${location.search}`;
    return <Navigate to={`/login?redirect=${encodeURIComponent(redirectTo)}`} replace />;
  }

  const canAccessAdmin = staffRole === 'ADMIN' || staffRole === 'MODERATOR';
  if (adminOnly && !canAccessAdmin) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
