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
          scrolled && "pt-5 px-4 sm:px-5 md:px-6 lg:px-8 xl:px-10 2xl:px-12"
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
              "w-full mx-auto box-border min-w-0",
              "max-w-[1600px]",
              "px-3 sm:px-4 md:px-5 lg:px-6 xl:px-8 2xl:px-10"
            )}
          >
            {/*
              Header definitivo (sem scroll horizontal na nav):
              - Abaixo de xl (~1280px), 5 rótulos longos + logo + CTA excedem a largura útil sem
                remendo; a nav inline colapsa para hamburger (comportamento limpo).
              - A partir de xl: grid de 3 colunas [auto | 1fr | auto] — centro recebe o espaço
                real entre marca e ações; links centralizados com nowrap, sem overflow-x.
              - Escalonamento xl → 2xl: altura, logo, gaps/paddings dos links e CTA (mais ar no xl).
            */}
            <div
              className={cn(
                "flex w-full min-w-0 items-center gap-3",
                "min-h-[64px] py-2 sm:min-h-[68px] sm:py-2",
                "xl:grid xl:min-h-[70px] xl:grid-cols-[auto_minmax(0,1fr)_auto] xl:items-center xl:gap-x-4 xl:py-2.5",
                "2xl:min-h-[76px] 2xl:gap-x-6 2xl:py-2.5"
              )}
            >
              <Link
                to="/landing"
                className="flex min-w-0 shrink-0 items-center gap-2 sm:gap-2.5 xl:gap-3"
                aria-label="SanarFlix Simulados — início"
              >
                <motion.div
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.98 }}
                  className={cn(
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-primary/40 bg-primary shadow-[0_4px_20px_hsl(var(--primary)_/_0.35)]",
                    "2xl:h-10 2xl:w-10"
                  )}
                >
                  <span className="text-xs font-bold text-primary-foreground xl:text-sm">S</span>
                </motion.div>
                <span className="hidden min-w-0 truncate font-semibold tracking-tight text-foreground sm:inline sm:max-w-[9.5rem] md:max-w-[12rem] xl:max-w-none xl:text-body">
                  SanarFlix Simulados
                </span>
              </Link>

              <nav
                className="hidden min-w-0 justify-center xl:flex"
                aria-label="Seções da página"
              >
                <div
                  className={cn(
                    "flex flex-nowrap items-center justify-center",
                    "gap-1 py-0.5 xl:gap-1 2xl:gap-2"
                  )}
                >
                  {NAV_SECTIONS.slice(0, 5).map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => scrollTo(item.id)}
                      className={cn(
                        "relative shrink-0 whitespace-nowrap rounded-lg font-medium transition-colors duration-200",
                        "px-2 py-2 text-[0.8125rem] leading-tight xl:px-2.5 xl:py-2 xl:text-body-sm",
                        "2xl:px-3 2xl:py-2.5 2xl:text-[0.9375rem]",
                        activeId === item.id
                          ? "text-primary"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {item.label}
                      {activeId === item.id && (
                        <motion.span
                          layoutId="nav-active"
                          className="absolute inset-0 -z-10 rounded-lg bg-primary/10"
                          transition={{ type: "spring", bounce: 0.2, duration: 0.4 }}
                        />
                      )}
                    </button>
                  ))}
                </div>
              </nav>

              <div
                className={cn(
                  "flex min-w-0 shrink-0 items-center gap-1.5 sm:gap-2",
                  "ml-auto xl:ml-0 2xl:gap-2.5"
                )}
              >
                <Button
                  variant="ghost"
                  size="default"
                  className={cn(
                    "hidden rounded-xl border-0 text-foreground hover:bg-primary/10 hover:text-primary sm:inline-flex",
                    "h-9 min-h-0 px-3 text-[0.8125rem] xl:h-9 xl:px-3.5 xl:text-body-sm",
                    "2xl:h-10 2xl:px-4"
                  )}
                  asChild
                >
                  <Link to="/login">Entrar</Link>
                </Button>
                <Button
                  size="default"
                  className={cn(
                    "min-h-0 whitespace-nowrap rounded-xl font-semibold bg-primary text-primary-foreground shadow-[0_4px_20px_hsl(var(--primary)_/_0.35)] transition-all duration-300 hover:bg-wine-hover hover:shadow-[0_8px_28px_hsl(var(--primary)_/_0.4)] hover:-translate-y-0.5 active:translate-y-0",
                    "h-9 px-3.5 text-body-sm sm:px-4",
                    "xl:h-9 xl:px-4 xl:text-body-sm",
                    "2xl:h-10 2xl:px-5 2xl:text-body"
                  )}
                  asChild
                >
                  <Link to="/login">Participar do simulado</Link>
                </Button>

                <button
                  type="button"
                  onClick={() => setMobileOpen((o) => !o)}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-foreground transition-colors duration-200 hover:bg-muted/50 xl:hidden"
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
            className="fixed inset-0 z-40 bg-foreground/20 backdrop-blur-sm xl:hidden"
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
            className="fixed top-[5.25rem] left-4 right-4 z-50 max-w-[calc(100vw-2rem)] rounded-2xl border border-border bg-card p-4 shadow-2xl xl:hidden"
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
