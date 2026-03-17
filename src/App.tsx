import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { UserProvider } from "@/contexts/UserContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import LoginPage from "./pages/LoginPage";
import Index from "./pages/Index";
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

              {/* Protected */}
              <Route path="/" element={<ProtectedRoute><Index /></ProtectedRoute>} />
              <Route path="/simulados" element={<ProtectedRoute><SimuladosPage /></ProtectedRoute>} />
              <Route path="/simulados/:id" element={<ProtectedRoute><SimuladoDetailPage /></ProtectedRoute>} />
              <Route path="/simulados/:id/prova" element={<ProtectedRoute><SimuladoExamPage /></ProtectedRoute>} />
              <Route path="/simulados/:id/resultado" element={<ProtectedRoute><ResultadoPage /></ProtectedRoute>} />
              <Route path="/simulados/:id/correcao" element={<ProtectedRoute><CorrecaoPage /></ProtectedRoute>} />
              <Route path="/desempenho" element={<ProtectedRoute><DesempenhoPage /></ProtectedRoute>} />
              <Route path="/ranking" element={<ProtectedRoute><RankingPage /></ProtectedRoute>} />
              <Route path="/comparativo" element={<ProtectedRoute><ComparativoPage /></ProtectedRoute>} />
              <Route path="/caderno-erros" element={<ProtectedRoute><CadernoErrosPage /></ProtectedRoute>} />
              <Route path="/configuracoes" element={<ProtectedRoute><ConfiguracoesPage /></ProtectedRoute>} />
              <Route path="/onboarding" element={<ProtectedRoute skipOnboardingCheck><OnboardingPage /></ProtectedRoute>} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </UserProvider>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
