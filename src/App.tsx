import { Suspense, lazy } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { UserProvider } from "@/contexts/UserContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { DashboardLayout } from "@/components/premium/DashboardLayout";
import { FloatingOfflineTimer } from "@/components/FloatingOfflineTimer";

// Page lazy imports — default exports
const LoginPage = lazy(() => import("./pages/LoginPage"));
const ForgotPasswordPage = lazy(() => import("./pages/ForgotPasswordPage"));
const ResetPasswordPage = lazy(() => import("./pages/ResetPasswordPage"));
const AuthCallbackPage = lazy(() => import("./pages/AuthCallbackPage"));
const AuthSSOPage = lazy(() => import("./pages/AuthSSOPage"));
const LandingPage = lazy(() => import("./pages/LandingPage"));
const NotFound = lazy(() => import("./pages/NotFound"));
const OnboardingPage = lazy(() => import("./pages/OnboardingPage"));
const SimuladosPage = lazy(() => import("./pages/SimuladosPage"));
const SimuladoDetailPage = lazy(() => import("./pages/SimuladoDetailPage"));
const SimuladoExamPage = lazy(() => import("./pages/SimuladoExamPage"));
const ResultadoPage = lazy(() => import("./pages/ResultadoPage"));
const AnswerSheetPage = lazy(() => import("./pages/AnswerSheetPage"));
const CorrecaoPage = lazy(() => import("./pages/CorrecaoPage"));
const DesempenhoPage = lazy(() => import("./pages/DesempenhoPage"));
const RankingPage = lazy(() => import("./pages/RankingPage"));
const ComparativoPage = lazy(() => import("./pages/ComparativoPage"));
const CadernoErrosPage = lazy(() => import("./pages/CadernoErrosPage"));
const ConfiguracoesPage = lazy(() => import("./pages/ConfiguracoesPage"));

// Page lazy imports — named exports
const HomePagePremium = lazy(() =>
  import("@/components/premium/home/HomePagePremium").then((m) => ({
    default: m.HomePagePremium,
  }))
);

// Admin lazy imports — default exports
const AdminLoginPage = lazy(() => import("./admin/AdminLoginPage"));
const AdminDashboard = lazy(() => import("./admin/pages/AdminDashboard"));
const AdminSimulados = lazy(() => import("./admin/pages/AdminSimulados"));
const AdminSimuladoForm = lazy(() => import("./admin/pages/AdminSimuladoForm"));
const AdminUploadQuestions = lazy(() => import("./admin/pages/AdminUploadQuestions"));

// Admin lazy imports — named exports
const AdminGuard = lazy(() =>
  import("./admin/AdminGuard").then((m) => ({ default: m.AdminGuard }))
);
const AdminApp = lazy(() =>
  import("./admin/AdminApp").then((m) => ({ default: m.AdminApp }))
);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000,
    },
  },
});

function PageShell() {
  return <div className="min-h-screen bg-background" aria-hidden="true" />;
}

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <UserProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
            <FloatingOfflineTimer />
            <Suspense fallback={<PageShell />}>
            <Routes>
              {/* Public */}
              <Route path="/landing" element={<LandingPage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/forgot-password" element={<ForgotPasswordPage />} />
              <Route path="/reset-password" element={<ResetPasswordPage />} />
              <Route path="/auth/callback" element={<AuthCallbackPage />} />
              <Route path="/auth/sso" element={<AuthSSOPage />} />

              {/* Admin — isolated */}
              <Route path="/admin/login" element={<AdminLoginPage />} />
              <Route path="/admin" element={<AdminGuard />}>
                <Route element={<AdminApp />}>
                  <Route index element={<AdminDashboard />} />
                  <Route path="simulados" element={<AdminSimulados />} />
                  <Route path="simulados/novo" element={<AdminSimuladoForm />} />
                  <Route path="simulados/:id" element={<AdminSimuladoForm />} />
                  <Route path="simulados/:id/questoes" element={<AdminUploadQuestions />} />
                </Route>
              </Route>

              {/* Protected — premium shell */}
              <Route element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>}>
                <Route index element={<HomePagePremium />} />
                <Route path="simulados" element={<SimuladosPage />} />
                <Route path="simulados/:id/start" element={<SimuladoDetailPage />} />
                <Route path="simulados/:id" element={<SimuladoDetailPage />} />
                <Route path="simulados/:id/prova" element={<SimuladoExamPage />} />
                <Route path="simulados/:id/resultado" element={<ResultadoPage />} />
                <Route path="simulados/:id/gabarito" element={<AnswerSheetPage />} />
                <Route path="simulados/:id/correcao" element={<CorrecaoPage />} />
                <Route path="desempenho" element={<DesempenhoPage />} />
                <Route path="ranking" element={<RankingPage />} />
                <Route path="comparativo" element={<ComparativoPage />} />
                <Route path="caderno-erros" element={<CadernoErrosPage />} />
                <Route path="configuracoes" element={<ConfiguracoesPage />} />
              </Route>
              <Route path="/onboarding" element={<ProtectedRoute skipOnboardingCheck><OnboardingPage /></ProtectedRoute>} />
              <Route path="*" element={<NotFound />} />
            </Routes>
            </Suspense>
            </BrowserRouter>
          </UserProvider>
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
