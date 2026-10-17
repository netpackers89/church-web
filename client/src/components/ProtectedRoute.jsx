import { Navigate, useLocation, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import LoadingScreen from './feedback/LoadingScreen.jsx';
import { getPostLoginPath } from '../app/authNavigation.js';

/**
 * Route guard. Requires an authenticated session and (optionally) a permission
 * predicate derived from the user's role. Unauthenticated users are redirected
 * to /login with a return path. Frontend checks are UX only — the server is the
 * source of truth for authorization.
 */
export default function ProtectedRoute({ children, require }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  const params = useParams();

  if (loading) return <LoadingScreen message="Checking your session…" />;
  if (!user) {
    return <Navigate to="/login" state={{ from: location.pathname + location.search }} replace />;
  }
  if (require && !require(user, location, params)) {
    return <Forbidden />;
  }
  return children;
}

export function GuestOnlyRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen message="Checking your session…" />;
  if (user) return <Navigate to={getPostLoginPath(user)} replace />;
  return children;
}

export function Forbidden() {
  return (
    <div className="loading-block" style={{ minHeight: '70vh', padding: '2rem', textAlign: 'center' }}>
      <div>
        <h2 className="display" style={{ fontSize: '1.6rem', marginBottom: '0.5rem' }}>Access restricted</h2>
        <p className="muted" style={{ maxWidth: '28rem' }}>
          Your account doesn't have permission to view this area. If you believe this is a
          mistake, please contact an administrator.
        </p>
      </div>
    </div>
  );
}
