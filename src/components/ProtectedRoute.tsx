import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useUser } from '@/contexts/UserContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
  skipOnboardingCheck?: boolean;
}

export function ProtectedRoute({ children, skipOnboardingCheck = false }: ProtectedRouteProps) {
  const { user, loading } = useAuth();
  const { isOnboardingComplete, isLoading: userLoading } = useUser();
  const location = useLocation();

  if (loading || userLoading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center bg-background"
        role="status"
        aria-live="polite"
      >
        <div className="flex flex-col items-center gap-4">
          <div
            className="h-10 w-10 border-3 border-primary/30 border-t-primary rounded-full animate-spin"
            aria-hidden="true"
          />
          <p className="text-body text-muted-foreground">Carregando...</p>
          <span className="sr-only">Carregando sua sessão, aguarde.</span>
        </div>
      </div>
    );
  }

  if (!user) {
    // SSO handoff: if root has email param, redirect to /auth/sso preserving query params
    if (location.pathname === "/") {
      const params = new URLSearchParams(location.search);
      if (params.get("email")) {
        // Translate isFromSanarflix/isFromPro to segment param
        let segment = "";
        if (params.get("isFromPro") === "true") segment = "pro";
        else if (params.get("isFromSanarflix") === "true") segment = "standard";

        const ssoParams = new URLSearchParams();
        ssoParams.set("email", params.get("email")!);
        if (params.get("name")) ssoParams.set("name", params.get("name")!);
        if (segment) ssoParams.set("segment", segment);
        // Forward HMAC signature/timestamp if SanarFlix signed the redirect, so
        // the hardened (signed) trust mode in sso-magic-link can verify it.
        // Accept both signature/sig and timestamp/ts param spellings.
        const signature = params.get("signature") ?? params.get("sig");
        const timestamp = params.get("timestamp") ?? params.get("ts");
        if (signature) ssoParams.set("signature", signature);
        if (timestamp) ssoParams.set("timestamp", timestamp);
        return <Navigate to={`/auth/sso?${ssoParams.toString()}`} replace />;
      }
      return <Navigate to="/landing" replace />;
    }
    return <Navigate to="/login" replace />;
  }

  // Redirect to onboarding if not completed (unless we're already there)
  if (!skipOnboardingCheck && !isOnboardingComplete && location.pathname !== '/onboarding') {
    return <Navigate to="/onboarding" replace />;
  }

  return <>{children}</>;
}
