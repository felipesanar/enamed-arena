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
import { PageLoadingSkeleton } from "@/components/premium/PageLoadingSkeleton";

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
const AdminUsuarios    = lazy(() => import('./admin/pages/stubs/AdminUsuarios'))
const AdminSupporte    = lazy(() => import('./admin/pages/stubs/AdminSupporte'))
const AdminTentativas  = lazy(() => import('./admin/pages/stubs/AdminTentativas'))
const AdminAnalytics   = lazy(() => import('./admin/pages/stubs/AdminAnalytics'))
const AdminMarketing   = lazy(() => import('./admin/pages/stubs/AdminMarketing'))
const AdminProduto     = lazy(() => import('./admin/pages/stubs/AdminProduto'))
const AdminTecnologia  = lazy(() => import('./admin/pages/stubs/AdminTecnologia'))
const AdminAuditoria   = lazy(() => import('./admin/pages/stubs/AdminAuditoria'))

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

/** Lightweight shell shown while public/admin route chunks load */
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
            <Routes>
              {/* Public — own Suspense boundary */}
              <Route path="/landing" element={<Suspense fallback={<PageShell />}><LandingPage /></Suspense>} />
              <Route path="/login" element={<Suspense fallback={<PageShell />}><LoginPage /></Suspense>} />
              <Route path="/forgot-password" element={<Suspense fallback={<PageShell />}><ForgotPasswordPage /></Suspense>} />
              <Route path="/reset-password" element={<Suspense fallback={<PageShell />}><ResetPasswordPage /></Suspense>} />
              <Route path="/auth/callback" element={<Suspense fallback={<PageShell />}><AuthCallbackPage /></Suspense>} />
              <Route path="/auth/sso" element={<Suspense fallback={<PageShell />}><AuthSSOPage /></Suspense>} />

              {/* Admin — own Suspense boundary */}
              <Route path="/admin/login" element={<Suspense fallback={<PageShell />}><AdminLoginPage /></Suspense>} />
              <Route path="/admin" element={<Suspense fallback={<PageShell />}><AdminGuard /></Suspense>}>
                <Route element={<Suspense fallback={<PageLoadingSkeleton />}><AdminApp /></Suspense>}>
                  <Route index element={<Suspense fallback={<PageLoadingSkeleton />}><AdminDashboard /></Suspense>} />
                  <Route path="simulados" element={<Suspense fallback={<PageLoadingSkeleton />}><AdminSimulados /></Suspense>} />
                  <Route path="simulados/novo" element={<Suspense fallback={<PageLoadingSkeleton />}><AdminSimuladoForm /></Suspense>} />
                  <Route path="simulados/:id" element={<Suspense fallback={<PageLoadingSkeleton />}><AdminSimuladoForm /></Suspense>} />
                  <Route path="simulados/:id/questoes" element={<Suspense fallback={<PageLoadingSkeleton />}><AdminUploadQuestions /></Suspense>} />
                  <Route path="usuarios"   element={<Suspense fallback={<PageLoadingSkeleton />}><AdminUsuarios /></Suspense>} />
                  <Route path="suporte"    element={<Suspense fallback={<PageLoadingSkeleton />}><AdminSupporte /></Suspense>} />
                  <Route path="tentativas" element={<Suspense fallback={<PageLoadingSkeleton />}><AdminTentativas /></Suspense>} />
                  <Route path="analytics"  element={<Suspense fallback={<PageLoadingSkeleton />}><AdminAnalytics /></Suspense>} />
                  <Route path="marketing"  element={<Suspense fallback={<PageLoadingSkeleton />}><AdminMarketing /></Suspense>} />
                  <Route path="produto"    element={<Suspense fallback={<PageLoadingSkeleton />}><AdminProduto /></Suspense>} />
                  <Route path="tecnologia" element={<Suspense fallback={<PageLoadingSkeleton />}><AdminTecnologia /></Suspense>} />
                  <Route path="auditoria"  element={<Suspense fallback={<PageLoadingSkeleton />}><AdminAuditoria /></Suspense>} />
                </Route>
              </Route>

              {/* Protected — DashboardLayout stays mounted, Suspense is inside DashboardOutlet */}
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
              <Route path="/onboarding" element={<Suspense fallback={<PageShell />}><ProtectedRoute skipOnboardingCheck><OnboardingPage /></ProtectedRoute></Suspense>} />
              <Route path="*" element={<Suspense fallback={<PageShell />}><NotFound /></Suspense>} />
            </Routes>
            </BrowserRouter>
          </UserProvider>
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
