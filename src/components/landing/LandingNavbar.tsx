import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const NAV_SECTIONS = [
  { id: "diferenciais", label: "Diferenciais" },
  { id: "como-funciona", label: "Como funciona" },
  { id: "experiencia", label: "Experiência" },
  { id: "performance", label: "Performance" },
  { id: "pro", label: "SanarFlix PRO" },
  { id: "prova-social", label: "Prova social" },
  { id: "cta-final", label: "Participar" },
] as const;

const EASE = [0.32, 0.72, 0.2, 1] as const;
const NAV_HEIGHT = 80;

export function LandingNavbar() {
  const [activeId, setActiveId] = useState<string>("");
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 20);
      const sections = NAV_SECTIONS.map((s) => s.id);
      for (let i = sections.length - 1; i >= 0; i--) {
        const el = document.getElementById(sections[i]);
        if (el) {
          const rect = el.getBoundingClientRect();
          if (rect.top <= 140) {
            setActiveId(sections[i]);
            return;
          }
        }
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const scrollTo = (id: string) => {
    setMobileOpen(false);
    const el = document.getElementById(id);
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <>
      {/* Wrapper: padding quando flutuando contém a barra dentro da viewport (sem margin no nav = sem overflow) */}
      <motion.header
        initial={{ y: -24, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6, ease: EASE }}
        className={cn(
          "fixed top-0 left-0 right-0 z-50 overflow-x-hidden box-border transition-[padding] duration-500 ease-[cubic-bezier(0.32,0.72,0.2,1)]",
          scrolled && "pt-5 px-5 sm:px-6 md:px-8 lg:px-10 xl:px-12"
        )}
      >
        <motion.nav
          animate={{
            borderRadius: scrolled ? 20 : 0,
            backgroundColor: scrolled ? "hsl(var(--card) / 0.94)" : "hsl(var(--card) / 0.04)",
            backdropFilter: scrolled ? "blur(24px) saturate(1.15)" : "blur(0px)",
            borderWidth: 1,
            borderColor: scrolled ? "hsl(var(--border))" : "transparent",
            boxShadow: scrolled
              ? "0 0 0 1px hsl(var(--border)), 0 24px 60px -12px rgba(0,0,0,0.45), 0 12px 24px -8px rgba(0,0,0,0.25)"
              : "none",
          }}
          transition={{ duration: 0.5, ease: EASE }}
          className="w-full border border-transparent min-w-0"
          style={{ boxSizing: "border-box" }}
        >
          <div
            className={cn(
              "w-full mx-auto min-h-[80px] box-border",
              "max-w-[1600px]",
              "px-4 sm:px-6 md:px-8 lg:px-10 xl:px-14"
            )}
          >
            <div className="flex items-center justify-between gap-4 sm:gap-6 h-full min-h-[80px]">
              <Link
                to="/landing"
                className="flex items-center gap-3 shrink-0 py-4 min-w-0"
                aria-label="SanarFlix Simulados — início"
              >
                <motion.div
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.98 }}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary border border-primary/40 shadow-[0_4px_20px_hsl(var(--primary)_/_0.35)]"
                >
                  <span className="text-primary-foreground font-bold text-sm">S</span>
                </motion.div>
                <span className="font-semibold text-foreground tracking-tight hidden sm:inline text-body truncate">
                  SanarFlix Simulados
                </span>
              </Link>

              <div className="hidden lg:flex items-center gap-1 shrink-0">
                {NAV_SECTIONS.slice(0, 5).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => scrollTo(item.id)}
                    className={cn(
                      "relative px-3 xl:px-4 py-2.5 rounded-lg text-body-sm font-medium transition-colors duration-200 whitespace-nowrap",
                      activeId === item.id
                        ? "text-primary"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {item.label}
                    {activeId === item.id && (
                      <motion.span
                        layoutId="nav-active"
                        className="absolute inset-0 rounded-lg bg-primary/10 -z-10"
                        transition={{ type: "spring", bounce: 0.2, duration: 0.4 }}
                      />
                    )}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                <Button
                  variant="ghost"
                  size="default"
                  className="hidden sm:inline-flex min-h-[44px] px-4 rounded-xl text-foreground hover:bg-primary/10 hover:text-primary border-0"
                  asChild
                >
                  <Link to="/login">Entrar</Link>
                </Button>
                <Button
                  size="default"
                  className="min-h-[44px] px-4 sm:px-5 rounded-xl font-semibold text-body-sm sm:text-body bg-primary text-primary-foreground hover:bg-wine-hover shadow-[0_4px_20px_hsl(var(--primary)_/_0.35)] hover:shadow-[0_8px_28px_hsl(var(--primary)_/_0.4)] transition-all duration-300 hover:-translate-y-0.5 active:translate-y-0 whitespace-nowrap"
                  asChild
                >
                  <Link to="/login">Participar do simulado</Link>
                </Button>

                <button
                  type="button"
                  onClick={() => setMobileOpen((o) => !o)}
                  className="lg:hidden flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-foreground hover:bg-muted/50 transition-colors duration-200"
                  aria-label={mobileOpen ? "Fechar menu" : "Abrir menu"}
                >
                  {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
                </button>
              </div>
            </div>
          </div>
        </motion.nav>
      </motion.header>

      {/* data-scrolled para CSS responsivo do padding — aplicar via useEffect ou classe condicional */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 bg-foreground/20 backdrop-blur-sm lg:hidden"
            onClick={() => setMobileOpen(false)}
            aria-hidden
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.25, ease: EASE }}
            className="fixed top-[80px] left-4 right-4 z-50 rounded-2xl border border-border bg-card shadow-2xl p-4 lg:hidden max-w-[calc(100vw-2rem)]"
          >
            <div className="flex flex-col gap-0.5">
              {NAV_SECTIONS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => scrollTo(item.id)}
                  className={cn(
                    "px-4 py-3 rounded-xl text-left text-body font-medium transition-colors duration-200",
                    activeId === item.id ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                  )}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
