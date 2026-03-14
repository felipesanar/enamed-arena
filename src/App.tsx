import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { UserProvider } from "@/contexts/UserContext";
import Index from "./pages/Index.tsx";
import SimuladosPage from "./pages/SimuladosPage.tsx";
import SimuladoDetailPage from "./pages/SimuladoDetailPage.tsx";
import SimuladoExamPage from "./pages/SimuladoExamPage.tsx";
import DesempenhoPage from "./pages/DesempenhoPage.tsx";
import RankingPage from "./pages/RankingPage.tsx";
import CorrecaoPage from "./pages/CorrecaoPage.tsx";
import ComparativoPage from "./pages/ComparativoPage.tsx";
import CadernoErrosPage from "./pages/CadernoErrosPage.tsx";
import ConfiguracoesPage from "./pages/ConfiguracoesPage.tsx";
import OnboardingPage from "./pages/OnboardingPage.tsx";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <UserProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/simulados" element={<SimuladosPage />} />
            <Route path="/simulados/:id" element={<SimuladoDetailPage />} />
            <Route path="/desempenho" element={<DesempenhoPage />} />
            <Route path="/ranking" element={<RankingPage />} />
            <Route path="/correcao" element={<CorrecaoPage />} />
            <Route path="/comparativo" element={<ComparativoPage />} />
            <Route path="/caderno-erros" element={<CadernoErrosPage />} />
            <Route path="/configuracoes" element={<ConfiguracoesPage />} />
            <Route path="/onboarding" element={<OnboardingPage />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </UserProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
