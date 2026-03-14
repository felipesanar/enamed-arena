import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";
import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("[NotFound] 404 — Rota não encontrada:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-center max-w-md"
      >
        <div className="text-display text-gradient-wine mb-4">404</div>
        <h1 className="text-heading-1 text-foreground mb-3">Página não encontrada</h1>
        <p className="text-body-lg text-muted-foreground mb-10 leading-relaxed">
          A página que você procura não existe ou foi removida da plataforma.
        </p>
        <Link
          to="/"
          className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl bg-primary text-primary-foreground text-body font-semibold hover:bg-wine-hover transition-colors shadow-sm"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar ao início
        </Link>
      </motion.div>
    </div>
  );
};

export default NotFound;