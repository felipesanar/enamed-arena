import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { MOCK_ENTRIES } from "./mockEntries";
import { useNotebookEntries } from "./hooks/useNotebookEntries";
import { useReviewStreak } from "./hooks/useReviewStreak";
import { ToastProvider } from "./ui/ToastProvider";
import { PageHero } from "./components/PageHero";
import { FilterBar } from "./components/FilterBar";
import { HeroNextCard } from "./components/HeroNextCard";
import { EntryCard } from "./components/EntryCard";
import { EmptyState } from "./components/EmptyState";
import { ZeroPendingState } from "./components/ZeroPendingState";
import { AddToNotebookModal } from "./components/AddToNotebookModal/index";
import { ERROR_TYPE_KEYS, type ErrorTypeKey } from "./errorTypes";
import "./tokens.css";

export function CadernoSandboxPage() {
  const {
    entries,
    filtered,
    pending,
    resolved,
    heroEntry,
    activeTypeFilter,
    activeSpecFilter,
    setTypeFilter,
    setSpecFilter,
    markResolved,
  } = useNotebookEntries(MOCK_ENTRIES);

  const { streak } = useReviewStreak(entries);
  const [showResolved, setShowResolved] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  const specialties = useMemo(
    () => [...new Set(entries.map((e) => e.area))].sort(),
    [entries]
  );

  const typeCounts = useMemo(() => {
    const counts: Partial<Record<ErrorTypeKey | "all", number>> = { all: filtered.length };
    for (const key of ERROR_TYPE_KEYS) {
      counts[key] = filtered.filter((e) => e.errorType === key).length;
    }
    return counts;
  }, [filtered]);

  const isEmpty = entries.length === 0;
  const allResolved = entries.length > 0 && pending.length === 0;

  return (
    <ToastProvider>
      <div
        className="caderno-sandbox"
        style={{ minHeight: "100vh", background: "var(--s3)", fontFamily: "'Inter', sans-serif" }}
      >
        {isEmpty ? (
          <EmptyState />
        ) : (
          <>
            <PageHero
              pendingCount={pending.length}
              resolvedCount={resolved.length}
              totalCount={entries.length}
              specialtyCount={specialties.length}
              streak={streak}
            />

            <FilterBar
              activeType={activeTypeFilter}
              activeSpec={activeSpecFilter}
              typeCounts={typeCounts}
              specialties={specialties}
              onTypeChange={setTypeFilter}
              onSpecChange={setSpecFilter}
            />

            <div style={{ padding: "20px 24px", maxWidth: 720, margin: "0 auto" }}>
              {allResolved ? (
                <ZeroPendingState
                  resolvedCount={resolved.length}
                  streak={streak}
                  onShowResolved={() => setShowResolved(true)}
                />
              ) : (
                <>
                  {heroEntry && (
                    <HeroNextCard entry={heroEntry} onMarkResolved={markResolved} />
                  )}

                  {pending.length > 1 && (
                    <section aria-labelledby="queue-heading" style={{ marginBottom: 24 }}>
                      <h2 id="queue-heading" style={{
                        fontSize: 10, fontWeight: 700, letterSpacing: ".08em",
                        textTransform: "uppercase", color: "var(--t3)", margin: "0 0 10px",
                      }}>
                        Na fila ({pending.length - 1})
                      </h2>
                      <motion.div
                        style={{ display: "flex", flexDirection: "column", gap: 6 }}
                        initial="hidden"
                        animate="visible"
                        variants={{ visible: { transition: { staggerChildren: 0.04 } }, hidden: {} }}
                      >
                        {pending.slice(1).map((entry) => (
                          <motion.div
                            key={entry.id}
                            variants={{
                              hidden: { opacity: 0, y: 8 },
                              visible: { opacity: 1, y: 0, transition: { type: "spring", damping: 22, stiffness: 280 } },
                            }}
                          >
                            <EntryCard entry={entry} onMarkResolved={markResolved} />
                          </motion.div>
                        ))}
                      </motion.div>
                    </section>
                  )}
                </>
              )}

              {(showResolved || allResolved) && resolved.length > 0 && (
                <section aria-labelledby="resolved-heading" style={{ marginTop: allResolved ? 16 : 0 }}>
                  <h2 id="resolved-heading" style={{
                    fontSize: 10, fontWeight: 700, letterSpacing: ".08em",
                    textTransform: "uppercase", color: "var(--t3)", margin: "0 0 10px",
                  }}>
                    Resolvidas ({resolved.length})
                  </h2>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {resolved.map((entry) => (
                      <EntryCard key={entry.id} entry={entry} />
                    ))}
                  </div>
                </section>
              )}

              {/* Demo modal trigger */}
              <div style={{ marginTop: 32, paddingTop: 24, borderTop: "1px solid var(--border)" }}>
                <p style={{ fontSize: 11, color: "var(--t3)", marginBottom: 8 }}>Demo: AddToNotebookModal</p>
                <button
                  onClick={() => setModalOpen(true)}
                  style={{
                    padding: "9px 18px", borderRadius: "var(--radius-md)",
                    border: "1.5px solid var(--border)", background: "var(--surface)",
                    color: "var(--t1)", fontSize: 13, fontWeight: 600,
                    cursor: "pointer", fontFamily: "'Inter', sans-serif",
                  }}
                >
                  Abrir modal de adicionar
                </button>
              </div>
            </div>
          </>
        )}

        <AddToNotebookModal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          questionId="q-demo"
          simuladoId="sim-demo"
          simuladoTitle="ENAMED Simulado Demo"
          area="Cardiologia"
          theme="IAM com supra de ST"
          questionNumber={42}
          questionText="Qual a conduta no IAM?"
          wasCorrect={false}
          userId="user-demo"
          onAdded={() => {}}
        />
      </div>
    </ToastProvider>
  );
}
