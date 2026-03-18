import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { UserProvider } from "@/contexts/UserContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import LoginPage from "./pages/LoginPage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import AuthCallbackPage from "./pages/AuthCallbackPage";
import { DashboardLayout } from "@/components/premium/DashboardLayout";
import { HomePagePremium } from "@/components/premium/home/HomePagePremium";
import SimuladosPage from "./pages/SimuladosPage";
import SimuladoDetailPage from "./pages/SimuladoDetailPage";
import SimuladoExamPage from "./pages/SimuladoExamPage";
import ResultadoPage from "./pages/ResultadoPage";
import DesempenhoPage from "./pages/DesempenhoPage";
import RankingPage from "./pages/RankingPage";
import CorrecaoPage from "./pages/CorrecaoPage";
import ComparativoPage from "./pages/ComparativoPage";
import CadernoErrosPage from "./pages/CadernoErrosPage";
import ConfiguracoesPage from "./pages/ConfiguracoesPage";
import OnboardingPage from "./pages/OnboardingPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000, // 5 min — avoid unnecessary refetches on tab return
    },
  },
});

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <UserProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
            <Routes>
              {/* Public */}
              <Route path="/login" element={<LoginPage />} />
              <Route path="/auth/callback" element={<AuthCallbackPage />} />

              {/* Protected — premium shell */}
              <Route element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>}>
                <Route index element={<HomePagePremium />} />
                <Route path="simulados" element={<SimuladosPage />} />
                <Route path="simulados/:id" element={<SimuladoDetailPage />} />
                <Route path="simulados/:id/prova" element={<SimuladoExamPage />} />
                <Route path="simulados/:id/resultado" element={<ResultadoPage />} />
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
            </BrowserRouter>
          </UserProvider>
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
