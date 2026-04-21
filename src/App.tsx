import { Suspense, lazy } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { UserProvider } from "@/contexts/UserContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { DashboardLayout } from "@/components/premium/DashboardLayout";
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
// Sandbox pages are only bundled in dev builds.
const SandboxCadernoPage = import.meta.env.DEV
  ? lazy(() => import("./pages/SandboxCadernoPage"))
  : null;

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
const AdminUsuarios    = lazy(() => import('./admin/pages/AdminUsuarios'))
const AdminUsuarioDetail = lazy(() => import('./admin/pages/AdminUsuarioDetail'))
const AdminSimuladoAnalytics = lazy(() => import('./admin/pages/AdminSimuladoAnalytics'))
const AdminSupporte    = lazy(() => import('./admin/pages/stubs/AdminSupporte'))
const AdminTentativas  = lazy(() => import('./admin/pages/AdminTentativas'))
const AdminRankingPreview = lazy(() => import('./admin/pages/AdminRankingPreviewPage'))
const AdminDesempenhoPreview = lazy(() => import('./admin/pages/AdminDesempenhoPreviewPage'))
const AdminAnalytics   = lazy(() => import('./admin/pages/AdminAnalytics'))
const AdminMarketing   = lazy(() => import('./admin/pages/AdminMarketing'))
const AdminProduto     = lazy(() => import('./admin/pages/AdminProduto'))
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
      // Avoid retrying on client errors (4xx) — those won't succeed on retry
      // and just delay the error reaching the UI.
      retry: (failureCount, error) => {
        const status = (error as { status?: number })?.status
          ?? Number((error as { code?: string })?.code);
        if (typeof status === "number" && status >= 400 && status < 500) return false;
        return failureCount < 2;
      },
    },
    mutations: {
      retry: false,
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
      <ThemeProvider
        attribute="class"
        defaultTheme="light"
        enableSystem
        storageKey="ea-ui-theme"
        disableTransitionOnChange
      >
      <TooltipProvider>
        <AuthProvider>
          <UserProvider>
            <Toaster />
            <BrowserRouter>
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
                  <Route path="usuarios/:id" element={<Suspense fallback={<PageLoadingSkeleton />}><AdminUsuarioDetail /></Suspense>} />
                  <Route path="simulados/:id/analytics" element={<Suspense fallback={<PageLoadingSkeleton />}><AdminSimuladoAnalytics /></Suspense>} />
                  <Route path="suporte"    element={<Suspense fallback={<PageLoadingSkeleton />}><AdminSupporte /></Suspense>} />
                  <Route path="tentativas" element={<Suspense fallback={<PageLoadingSkeleton />}><AdminTentativas /></Suspense>} />
                  <Route path="ranking-preview" element={<Suspense fallback={<PageLoadingSkeleton />}><AdminRankingPreview /></Suspense>} />
                  <Route path="preview/simulados/:id/resultado" element={<Suspense fallback={<PageLoadingSkeleton />}><ResultadoPage adminPreview /></Suspense>} />
                  <Route path="preview/simulados/:id/correcao" element={<Suspense fallback={<PageLoadingSkeleton />}><CorrecaoPage adminPreview /></Suspense>} />
                  <Route path="preview/simulados/:id/desempenho" element={<Suspense fallback={<PageLoadingSkeleton />}><AdminDesempenhoPreview /></Suspense>} />
                  <Route path="analytics"  element={<Suspense fallback={<PageLoadingSkeleton />}><AdminAnalytics /></Suspense>} />
                  <Route path="marketing"  element={<Suspense fallback={<PageLoadingSkeleton />}><AdminMarketing /></Suspense>} />
                  <Route path="produto"    element={<Suspense fallback={<PageLoadingSkeleton />}><AdminProduto /></Suspense>} />
                  <Route path="tecnologia" element={<Suspense fallback={<PageLoadingSkeleton />}><AdminTecnologia /></Suspense>} />
                  <Route path="auditoria"  element={<Suspense fallback={<PageLoadingSkeleton />}><AdminAuditoria /></Suspense>} />
                </Route>
              </Route>

              {/* Protected — DashboardLayout stays mounted, Suspense is inside DashboardOutlet */}
              <Route element={<ProtectedRoute><ErrorBoundary fallbackTitle="Algo deu errado nesta seção"><DashboardLayout /></ErrorBoundary></ProtectedRoute>}>
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
              {SandboxCadernoPage ? (
                <Route path="/sandbox/caderno" element={<Suspense fallback={<PageShell />}><SandboxCadernoPage /></Suspense>} />
              ) : null}
              <Route path="*" element={<Suspense fallback={<PageShell />}><NotFound /></Suspense>} />
            </Routes>
            </BrowserRouter>
          </UserProvider>
        </AuthProvider>
      </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
