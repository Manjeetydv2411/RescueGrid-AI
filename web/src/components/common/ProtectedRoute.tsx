import { Navigate, useLocation } from "react-router-dom";

import { useAuth } from "../../hooks/useAuth";
import Loading from "./Loading";
import type { UserRole } from "../../types/api";

interface ProtectedRouteProps {
  children: React.ReactNode;
  /**
   * Roles permitted to view the route. When omitted, any authenticated user
   * may view it.
   */
  role?: UserRole | UserRole[];
}

/**
 * Guards a route behind authentication and (optionally) a role.
 *
 * This is a UX affordance only — the backend enforces authorization
 * independently on every endpoint.
 */
const ProtectedRoute = ({ children, role }: ProtectedRouteProps) => {
  const { user, isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loading message="Restoring session…" />
      </div>
    );
  }

  if (!isAuthenticated) {
    // Remember where the user was headed so login can return them there.
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  if (role) {
    const allowed = Array.isArray(role) ? role : [role];
    if (!user || !allowed.includes(user.role)) {
      return <Navigate to="/dashboard" replace />;
    }
  }

  return <>{children}</>;
};

export default ProtectedRoute;
