import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { VIEWPORT_REVEAL, DURATION_NORMAL, EASE } from "@/lib/landingMotion";

const FOOTER_LINKS = [
  { id: "diferenciais", label: "Diferenciais", href: "#diferenciais" },
  { id: "como-funciona", label: "Como funciona", href: "#como-funciona" },
  { id: "experiencia", label: "Experiência", href: "#experiencia" },
  { id: "performance", label: "Performance", href: "#performance" },
  { id: "pro", label: "SanarFlix PRO", href: "#pro" },
];

export function LandingFooter() {
  return (
    <motion.footer
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      viewport={VIEWPORT_REVEAL}
      transition={{ duration: DURATION_NORMAL, ease: EASE }}
      className="border-t border-border py-10 px-4 md:px-6"
    >
      <div className="max-w-[1280px] mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
        <Link
          to="/landing"
          className="flex items-center gap-2 shrink-0"
          aria-label="SanarFlix Simulados"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
            <span className="text-primary-foreground font-bold text-sm">S</span>
          </div>
          <span className="font-semibold text-foreground text-body-sm">SanarFlix Simulados</span>
        </Link>
        <nav className="flex flex-wrap items-center justify-center gap-4 md:gap-6" aria-label="Links do rodapé">
          {FOOTER_LINKS.map((link) => (
            <a
              key={link.id}
              href={link.href}
              className="text-body-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              {link.label}
            </a>
          ))}
          <Link to="/login" className="text-body-sm text-muted-foreground hover:text-foreground transition-colors">
            Entrar
          </Link>
        </nav>
        <p className="text-body-sm text-muted-foreground shrink-0">
          Plataforma premium do ecossistema Sanar · 2026
        </p>
      </div>
    </motion.footer>
  );
}
