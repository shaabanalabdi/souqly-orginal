import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../store/authStore';

interface ProtectedRouteProps {
  adminOnly?: boolean;
}

export function ProtectedRoute({ adminOnly = false }: ProtectedRouteProps) {
  const location = useLocation();
  const { t } = useTranslation();
  const initialized = useAuthStore((state) => state.initialized);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const staffRole = useAuthStore((state) => state.user?.staffRole);

  if (!initialized) {
    return <p className="muted-text">{t('common.loading')}</p>;
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
