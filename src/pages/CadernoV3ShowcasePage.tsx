/**
 * CadernoV3ShowcasePage — galeria de QA visual dos primitivos do Caderno v3.
 * Rota DEV-only: /sandbox/caderno-v3 (sem ProtectedRoute).
 * Toggles no topo: Light/Dark + Desktop/Mobile (container 390px).
 * Seletor de seção: Primitivos | Shell/Lista | Recall | Triagem | Insights | Flashcards.
 */
import "@/components/caderno/ui/caderno-theme.css";
import { useState } from "react";
import { BookOpen, Star, Zap, Brain, Eye, Target } from "lucide-react";
import { ShellSection } from "@/components/caderno/showcase/ShellSection";
import { RecallSection } from "@/components/caderno/showcase/RecallSection";
import { TriagemSection } from "@/components/caderno/showcase/TriagemSection";
import { InsightsSection } from "@/components/caderno/showcase/InsightsSection";
import { FlashcardsSection } from "@/components/caderno/showcase/FlashcardsSection";
import { TreinoSection } from "@/components/caderno/showcase/TreinoSection";
import { FavoritosSection } from "@/components/caderno/showcase/FavoritosSection";
import { AnotacoesSection } from "@/components/caderno/showcase/AnotacoesSection";
import { RetaFinalSection } from "@/components/caderno/showcase/RetaFinalSection";
import {
  CadernoCard,
  CauseBadge,
  CauseBar,
  FilterChip,
  StatTile,
  ProgressRing,
  ProgressBar,
  SectionHeader,
  CadernoEmptyState,
  CadernoSkeleton,
  AdaptiveModal,
  MobileAppBar,
  BottomActionBar,
  SegmentedTabs,
  PageHeaderPremium,
} from "@/components/caderno/ui";

// ── Mock data ────────────────────────────────────────────────────────────────

const REASONS = [
  "did_not_know",
  "did_not_remember",
  "reading_error",
  "confused_alternatives",
  "guessed_correctly",
  "did_not_understand",
] as const;

const FILTER_CHIPS = [
  { label: "Todos", count: 42 },
  { label: "Lacuna", count: 18 },
  { label: "Memória", count: 12 },
  { label: "Atenção", count: 8 },
  { label: "Diferencial", count: 4 },
];

const TAB_ITEMS = [
  { value: "erros", label: "Erros", count: 42 },
  { value: "favoritos", label: "Favoritos", count: 8 },
  { value: "flashcards", label: "Flashcards", count: 15 },
  { value: "insights", label: "Insights" },
];

const STATS = [
  { label: "Total", value: 42, suffix: "q" },
  { label: "Pendentes", value: 18, suffix: "q", color: "var(--c-wine-600)" },
  { label: "Revisadas", value: 24, suffix: "q", color: "#16A34A" },
  { label: "Taxa de acerto", value: 72, suffix: "%" },
];

// ── Section types ────────────────────────────────────────────────────────────

type ShowcaseSection = "primitivos" | "shell" | "recall" | "triagem" | "insights" | "flashcards" | "treino" | "favoritos" | "anotacoes" | "retafinal";

const SECTION_OPTIONS: { value: ShowcaseSection; label: string }[] = [
  { value: "primitivos", label: "Primitivos" },
  { value: "shell", label: "Shell/Lista" },
  { value: "recall", label: "Recall" },
  { value: "triagem", label: "Triagem" },
  { value: "insights", label: "Insights" },
  { value: "flashcards", label: "Flashcards" },
  { value: "treino", label: "Treino" },
  { value: "favoritos", label: "Favoritos" },
  { value: "anotacoes", label: "Anotações" },
  { value: "retafinal", label: "Reta Final" },
];

// ── Showcase Page ────────────────────────────────────────────────────────────

export default function CadernoV3ShowcasePage() {
  const [isDark, setIsDark] = useState(false);
  const [isMobileView, setIsMobileView] = useState(false);
  const [activeSection, setActiveSection] = useState<ShowcaseSection>("primitivos");
  const [activeFilter, setActiveFilter] = useState("Todos");
  const [activeTab, setActiveTab] = useState("erros");
  const [modalOpen, setModalOpen] = useState(false);
  const [showSkeleton, setShowSkeleton] = useState(false);

  return (
    <div className={isDark ? "dark" : ""} style={{ minHeight: "100vh", background: isDark ? "#0F0D11" : "#FAF8F7" }}>
      {/* ── Barra de controles de QA ─────────────────────────────────── */}
      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 100,
          background: isDark ? "#16131A" : "#fff",
          borderBottom: `1px solid ${isDark ? "#2A2531" : "#ECE5E3"}`,
          padding: "10px 20px",
          display: "flex",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <span style={{ fontWeight: 700, fontSize: 13, color: isDark ? "#F4EFF2" : "#1A1518" }}>
          Caderno v3 Showcase
        </span>
        <button
          onClick={() => setIsDark(!isDark)}
          style={{
            padding: "5px 14px",
            borderRadius: 999,
            border: `1px solid ${isDark ? "#2A2531" : "#ECE5E3"}`,
            background: isDark ? "#1E1A24" : "#F6F2F1",
            color: isDark ? "#F4EFF2" : "#1A1518",
            fontSize: 12,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          {isDark ? "☀ Light" : "◐ Dark"}
        </button>
        <button
          onClick={() => setIsMobileView(!isMobileView)}
          style={{
            padding: "5px 14px",
            borderRadius: 999,
            border: `1px solid ${isDark ? "#2A2531" : "#ECE5E3"}`,
            background: isMobileView ? "#B0294A" : isDark ? "#1E1A24" : "#F6F2F1",
            color: isMobileView ? "#fff" : isDark ? "#F4EFF2" : "#1A1518",
            fontSize: 12,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          {isMobileView ? "📱 Mobile (390px)" : "🖥 Desktop"}
        </button>
        <button
          onClick={() => setShowSkeleton(!showSkeleton)}
          style={{
            padding: "5px 14px",
            borderRadius: 999,
            border: `1px solid ${isDark ? "#2A2531" : "#ECE5E3"}`,
            background: isDark ? "#1E1A24" : "#F6F2F1",
            color: isDark ? "#F4EFF2" : "#1A1518",
            fontSize: 12,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          {showSkeleton ? "⬛ Skeleton ON" : "⬜ Skeleton OFF"}
        </button>
        <button
          onClick={() => setModalOpen(true)}
          style={{
            padding: "5px 14px",
            borderRadius: 999,
            border: "1px solid #B0294A",
            background: "#B0294A",
            color: "#fff",
            fontSize: 12,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Abrir AdaptiveModal
        </button>
        <span style={{ width: 1, height: 20, background: isDark ? "#2A2531" : "#ECE5E3", flexShrink: 0 }} />
        {SECTION_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setActiveSection(opt.value)}
            style={{
              padding: "5px 14px",
              borderRadius: 999,
              border: `1px solid ${activeSection === opt.value ? "#B0294A" : isDark ? "#2A2531" : "#ECE5E3"}`,
              background: activeSection === opt.value ? "#B0294A" : isDark ? "#1E1A24" : "#F6F2F1",
              color: activeSection === opt.value ? "#fff" : isDark ? "#F4EFF2" : "#1A1518",
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* ── Container (desktop ou mobile 390px) ─────────────────────── */}
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          padding: isMobileView ? "0" : "32px 20px",
        }}
      >
        <div
          style={{
            width: isMobileView ? 390 : "100%",
            maxWidth: isMobileView ? 390 : 1120,
            minHeight: "100vh",
          }}
        >
          {/* TUDO envolto em caderno-root */}
          <div className="caderno-root" style={{ fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif' }}>

            {/* ── Seções de superfícies completas ──────────────────────── */}
            {activeSection === "shell" && (
              <ShellSection isMobileView={isMobileView} isDark={isDark} scenario="default" />
            )}
            {activeSection === "recall" && <RecallSection />}
            {activeSection === "triagem" && <TriagemSection />}
            {activeSection === "insights" && <InsightsSection />}
            {activeSection === "flashcards" && <FlashcardsSection />}
            {activeSection === "treino" && <TreinoSection />}
            {activeSection === "favoritos" && <FavoritosSection />}
            {activeSection === "anotacoes" && <AnotacoesSection />}
            {activeSection === "retafinal" && (
              <RetaFinalSection isMobileView={isMobileView} isDark={isDark} scenario="all" />
            )}

            {/* ── Galeria de primitivos (seção padrão) ───────────────── */}
            {activeSection === "primitivos" && (
              <>

            {/* ── 1. PageHeaderPremium ───────────────────────────────── */}
            <Section title="1 · PageHeaderPremium" dark={isDark}>
              <PageHeaderPremium
                title="Caderno de Erros"
                subtitle="Revise suas questões organizadas por causa e especialidade."
                stats={STATS}
                primaryAction={
                  <button
                    style={{
                      background: "linear-gradient(135deg, #B0294A, #7A1A32)",
                      color: "#fff",
                      border: "none",
                      borderRadius: 12,
                      padding: "10px 20px",
                      fontWeight: 700,
                      fontSize: 13,
                      cursor: "pointer",
                    }}
                  >
                    Iniciar Revisão
                  </button>
                }
              />
            </Section>

            {/* ── 2. SegmentedTabs ───────────────────────────────────── */}
            <Section title="2 · SegmentedTabs" dark={isDark}>
              <SegmentedTabs
                items={TAB_ITEMS}
                value={activeTab}
                onValueChange={setActiveTab}
              />
              <p style={{ marginTop: 8, fontSize: 12, color: "var(--c-muted)" }}>
                Tab ativa: <strong>{activeTab}</strong>
              </p>
            </Section>

            {/* ── 3. FilterChips ─────────────────────────────────────── */}
            <Section title="3 · FilterChip" dark={isDark}>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {FILTER_CHIPS.map((f) => (
                  <FilterChip
                    key={f.label}
                    label={f.label}
                    count={f.count}
                    active={activeFilter === f.label}
                    onClick={() => setActiveFilter(f.label)}
                  />
                ))}
              </div>
            </Section>

            {/* ── 4. CauseBadge + CauseBar ───────────────────────────── */}
            <Section title="4 · CauseBadge + CauseBar" dark={isDark}>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 20 }}>
                {REASONS.map((r) => (
                  <CauseBadge key={r} reason={r} />
                ))}
                <div style={{ marginTop: 4, display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {REASONS.map((r) => (
                    <CauseBadge key={r + "-sm"} reason={r} size="sm" />
                  ))}
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 340 }}>
                {REASONS.map((r, i) => (
                  <CauseBar
                    key={r}
                    reason={r}
                    value={Math.round(80 - i * 12)}
                  />
                ))}
              </div>
            </Section>

            {/* ── 5. StatTile ────────────────────────────────────────── */}
            <Section title="5 · StatTile" dark={isDark}>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 32 }}>
                <StatTile label="Total" value={42} suffix="q" />
                <StatTile label="Pendentes" value={18} suffix="q" color="var(--c-wine-600, #9B2645)" />
                <StatTile label="Taxa de Acerto" value={72} suffix="%" color="#16A34A" />
                <StatTile label="Sequência" value={7} suffix="dias" trend="up" />
                <StatTile label="Queda" value={-3} suffix="%" trend="down" />
              </div>
            </Section>

            {/* ── 6. ProgressRing + ProgressBar ─────────────────────── */}
            <Section title="6 · ProgressRing + ProgressBar" dark={isDark}>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 24, alignItems: "center", marginBottom: 24 }}>
                {[0, 25, 50, 72, 100].map((v) => (
                  <ProgressRing key={v} value={v} size={72} strokeWidth={6}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "var(--c-ink)" }}>{v}%</span>
                  </ProgressRing>
                ))}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: 340 }}>
                {[20, 50, 72, 100].map((v) => (
                  <div key={v} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <ProgressBar value={v} style={{ flex: 1 }} label={`${v}%`} />
                    <span style={{ fontSize: 12, fontWeight: 600, color: "var(--c-muted)", minWidth: 32 }}>{v}%</span>
                  </div>
                ))}
              </div>
            </Section>

            {/* ── 7. CadernoCard ─────────────────────────────────────── */}
            <Section title="7 · CadernoCard" dark={isDark}>
              <div style={{ display: "grid", gap: 16, gridTemplateColumns: isMobileView ? "1fr" : "1fr 1fr 1fr" }}>
                <CadernoCard style={{ padding: 20 }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: "var(--c-ink)" }}>Card base</p>
                  <p style={{ fontSize: 12, color: "var(--c-muted)", marginTop: 4 }}>
                    Conteúdo padrão sem interação.
                  </p>
                </CadernoCard>
                <CadernoCard variant="interactive" style={{ padding: 20 }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: "var(--c-ink)" }}>Card interactive</p>
                  <p style={{ fontSize: 12, color: "var(--c-muted)", marginTop: 4 }}>
                    Hover: sobe 2px + shadow-md.
                  </p>
                </CadernoCard>
                <CadernoCard hero style={{ padding: 20 }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: "var(--c-ink)" }}>Card hero</p>
                  <p style={{ fontSize: 12, color: "var(--c-muted)", marginTop: 4 }}>
                    Borda wine + glow sutil.
                  </p>
                </CadernoCard>
              </div>
            </Section>

            {/* ── 8. SectionHeader ───────────────────────────────────── */}
            <Section title="8 · SectionHeader" dark={isDark}>
              <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                <SectionHeader
                  title="Questões Pendentes"
                  count={18}
                  description="Ordenadas por data de erro."
                  action={
                    <button style={{ fontSize: 12, color: "var(--c-wine-600, #9B2645)", fontWeight: 600, background: "none", border: "none", cursor: "pointer" }}>
                      Ver todas
                    </button>
                  }
                />
                <SectionHeader title="Favoritos" count={8} />
              </div>
            </Section>

            {/* ── 9. CadernoSkeleton / estados de loading ────────────── */}
            <Section title="9 · CadernoSkeleton" dark={isDark}>
              {showSkeleton ? (
                <CadernoSkeleton count={3} />
              ) : (
                <p style={{ fontSize: 13, color: "var(--c-muted)" }}>
                  Ative o toggle "Skeleton ON" na barra superior para ver.
                </p>
              )}
            </Section>

            {/* ── 10. CadernoEmptyState ──────────────────────────────── */}
            <Section title="10 · CadernoEmptyState" dark={isDark}>
              <div style={{ display: "grid", gap: 16, gridTemplateColumns: isMobileView ? "1fr" : "1fr 1fr" }}>
                <CadernoEmptyState
                  icon={<BookOpen className="h-8 w-8" style={{ color: "var(--c-muted)" }} />}
                  title="Nenhum erro encontrado"
                  description="Você não adicionou questões ao caderno ainda. Comece um simulado!"
                  action={
                    <button style={{ padding: "8px 20px", borderRadius: 12, background: "linear-gradient(135deg, #B0294A, #7A1A32)", color: "#fff", border: "none", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                      Ir para Simulados
                    </button>
                  }
                />
                <CadernoEmptyState
                  variant="celebratory"
                  icon={<Star className="h-8 w-8" style={{ color: "var(--c-wine-600, #9B2645)" }} />}
                  title="Tudo revisado!"
                  description="Você zerou a fila de pendências. Continue assim!"
                />
              </div>
            </Section>

            {/* ── 11. MobileAppBar ───────────────────────────────────── */}
            <Section title="11 · MobileAppBar" dark={isDark}>
              <div style={{ border: "1px solid var(--c-border)", borderRadius: 12, overflow: "hidden" }}>
                <MobileAppBar
                  title="Caderno de Erros"
                  onBack={() => {}}
                  action={
                    <button style={{ fontSize: 12, fontWeight: 700, color: "var(--c-wine-600, #9B2645)", background: "none", border: "none", cursor: "pointer" }}>
                      Filtros
                    </button>
                  }
                />
              </div>
            </Section>

            {/* ── 12. BottomActionBar (preview estático) ─────────────── */}
            <Section title="12 · BottomActionBar (preview estático)" dark={isDark}>
              <div
                style={{
                  position: "relative",
                  border: "1px solid var(--c-border)",
                  borderRadius: 12,
                  overflow: "hidden",
                  height: 80,
                }}
              >
                <div
                  className="caderno-root"
                  style={{
                    position: "absolute",
                    inset: "auto 0 0 0",
                    borderTop: "1px solid var(--c-border)",
                    background: "var(--c-surface)",
                    padding: "12px 16px",
                    display: "flex",
                    gap: 12,
                    alignItems: "center",
                  }}
                >
                  <button style={{ flex: 1, padding: "10px 0", background: "var(--c-surface-2)", border: "none", borderRadius: 12, fontSize: 13, fontWeight: 600, color: "var(--c-muted)", cursor: "pointer" }}>
                    Adiar
                  </button>
                  <button style={{ flex: 1, padding: "10px 0", background: "linear-gradient(135deg, #B0294A, #7A1A32)", border: "none", borderRadius: 12, fontSize: 13, fontWeight: 700, color: "#fff", cursor: "pointer" }}>
                    Revisar agora
                  </button>
                </div>
              </div>
            </Section>

              </>
            )}

            {/* ── AdaptiveModal (via botão no header) ────────────────── */}
            <AdaptiveModal
              open={modalOpen}
              onOpenChange={setModalOpen}
              title="AdaptiveModal"
              description="Dialog no desktop · Drawer bottom-sheet no mobile (use o toggle)."
              footer={
                <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                  <button onClick={() => setModalOpen(false)} style={{ padding: "8px 16px", borderRadius: 12, border: "1px solid var(--c-border)", background: "var(--c-surface-2)", fontSize: 13, fontWeight: 600, cursor: "pointer", color: "var(--c-ink)" }}>
                    Cancelar
                  </button>
                  <button onClick={() => setModalOpen(false)} style={{ padding: "8px 20px", borderRadius: 12, background: "linear-gradient(135deg, #B0294A, #7A1A32)", border: "none", fontSize: 13, fontWeight: 700, color: "#fff", cursor: "pointer" }}>
                    Confirmar
                  </button>
                </div>
              }
            >
              <div style={{ padding: "8px 0", fontSize: 14, color: "var(--c-muted)", lineHeight: 1.6 }}>
                <p>No desktop (&ge;768px) este componente usa <strong style={{ color: "var(--c-ink)" }}>Dialog</strong> centralizado.</p>
                <p style={{ marginTop: 8 }}>No mobile (&lt;768px) usa <strong style={{ color: "var(--c-ink)" }}>Drawer</strong> bottom-sheet.</p>
                <p style={{ marginTop: 8 }}>A API é idêntica em ambos: <code style={{ fontSize: 12, background: "var(--c-surface-2)", padding: "2px 6px", borderRadius: 4 }}>open / onOpenChange / title / children / footer</code>.</p>
              </div>
            </AdaptiveModal>

          </div>
        </div>
      </div>
    </div>
  );
}

// ── Helper: container de seção ───────────────────────────────────────────────
function Section({ title, children, dark }: { title: string; children: React.ReactNode; dark: boolean }) {
  return (
    <div
      style={{
        marginBottom: 40,
        padding: "24px",
        borderRadius: 16,
        background: dark ? "#16131A" : "#FFFFFF",
        border: `1px solid ${dark ? "#2A2531" : "#ECE5E3"}`,
        boxShadow: "0 1px 2px rgba(20,12,16,.05), 0 2px 8px -4px rgba(20,12,16,.08)",
      }}
    >
      <p
        style={{
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: dark ? "#A89FB0" : "#6E6469",
          marginBottom: 16,
        }}
      >
        {title}
      </p>
      {children}
    </div>
  );
}
