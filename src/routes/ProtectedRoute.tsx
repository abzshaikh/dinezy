import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { LoadingIndicator } from '../components/common/LoadingIndicator';

/** Blocks access to child routes unless the user is signed in. */
export function ProtectedRoute() {
  const { firebaseUser, loading } = useAuth();
  const location = useLocation();

  if (loading) return <LoadingIndicator fullScreen label="Loading…" />;

  if (!firebaseUser) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <Outlet />;
}
