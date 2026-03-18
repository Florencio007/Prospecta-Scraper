import { useAuth } from "@/hooks/useAuth";
import { LoadingLogo } from "./LoadingLogo";
import { Navigate, useLocation } from "react-router-dom";

const ProtectedRoute = ({ children, showOnboarding = true, requireAdmin = false }: { children: React.ReactNode, showOnboarding?: boolean, requireAdmin?: boolean }) => {
  const { session, profile, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <LoadingLogo size="lg" message="Initialisation..." />
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  if (requireAdmin && profile?.role !== 'admin') {
    return <Navigate to="/dashboard" replace />;
  }

  // Redirect to onboarding if not completed and required for this route
  if (showOnboarding && profile && !profile.onboarding_completed) {
    if (location.pathname !== '/onboarding') {
      return <Navigate to="/onboarding" replace />;
    }
  }

  return <>{children}</>;
};

export default ProtectedRoute;
