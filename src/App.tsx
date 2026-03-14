import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Index from "./pages/Index.tsx";
import SimuladosPage from "./pages/SimuladosPage.tsx";
import DesempenhoPage from "./pages/DesempenhoPage.tsx";
import RankingPage from "./pages/RankingPage.tsx";
import CorrecaoPage from "./pages/CorrecaoPage.tsx";
import CadernoErrosPage from "./pages/CadernoErrosPage.tsx";
import ConfiguracoesPage from "./pages/ConfiguracoesPage.tsx";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/simulados" element={<SimuladosPage />} />
          <Route path="/desempenho" element={<DesempenhoPage />} />
          <Route path="/ranking" element={<RankingPage />} />
          <Route path="/correcao" element={<CorrecaoPage />} />
          <Route path="/caderno-erros" element={<CadernoErrosPage />} />
          <Route path="/configuracoes" element={<ConfiguracoesPage />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
