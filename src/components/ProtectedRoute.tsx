import { useAuth } from "@/hooks/useAuth";
import { LoadingLogo } from "./LoadingLogo";
import { Navigate, useLocation } from "react-router-dom";

const ProtectedRoute = ({ children, showOnboarding = true }: { children: React.ReactNode, showOnboarding?: boolean }) => {
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

  // Force redirect to onboarding if not completed
  /*
  if (showOnboarding && (!profile || !profile.onboarding_completed) && location.pathname !== "/onboarding") {
    return <Navigate to="/onboarding" replace />;
  }
  */

  return <>{children}</>;
};

export default ProtectedRoute;
