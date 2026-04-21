import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { ERROR_TYPE_KEYS, ERROR_TYPES, type ErrorTypeKey } from "../../errorTypes";
import { ReasonCard } from "./ReasonCard";
import { StepIndicator } from "./StepIndicator";
import { DuplicateBanner } from "./DuplicateBanner";
import { useToast } from "../../ui/ToastProvider";

export interface AddToNotebookModalProps {
  open: boolean;
  onClose: () => void;
  questionId: string;
  simuladoId: string;
  simuladoTitle: string;
  area: string;
  theme: string;
  questionNumber: number;
  questionText: string;
  wasCorrect: boolean;
  userId: string;
  onAdded?: () => void;
  selectedHighlight?: string;
  existingEntry?: { reason: string; addedAt: string } | null;
}

export function AddToNotebookModal({
  open,
  onClose,
  area,
  theme,
  questionNumber,
  wasCorrect,
  onAdded,
  selectedHighlight,
  existingEntry,
}: AddToNotebookModalProps) {
  const reduced = useReducedMotion();
  const { showToast } = useToast();
  const [step, setStep] = useState<1 | 2>(1);
  const [selectedType, setSelectedType] = useState<ErrorTypeKey | null>(
    existingEntry
      ? (Object.values(ERROR_TYPES).find((t) => t.label === existingEntry.reason)?.key ?? null)
      : null
  );
  const [note, setNote] = useState(selectedHighlight ?? "");
  const [saving, setSaving] = useState(false);

  const availableKeys = wasCorrect
    ? ERROR_TYPE_KEYS.filter((k) => !ERROR_TYPES[k].forWrongAnswer)
    : ERROR_TYPE_KEYS.filter((k) => ERROR_TYPES[k].forWrongAnswer);

  // Escape key handler
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  // Reset on open
  useEffect(() => {
    if (open) {
      setStep(1);
      setNote(selectedHighlight ?? "");
    }
  }, [open, selectedHighlight]);

  const isDuplicate = !!existingEntry;
  const existingKey = existingEntry
    ? Object.values(ERROR_TYPES).find((t) => t.label === existingEntry.reason)?.key
    : undefined;
  const isSameAsExisting = existingKey !== undefined && selectedType === existingKey;

  const handleSave = useCallback(() => {
    if (!selectedType) return;
    setSaving(true);
    setTimeout(() => {
      setSaving(false);
      onAdded?.();
      onClose();
      showToast({
        questionNumber,
        area,
        typeLabel: ERROR_TYPES[selectedType].label,
        typeColor: ERROR_TYPES[selectedType].colorBase,
      });
    }, 600);
  }, [selectedType, onAdded, onClose, showToast, questionNumber, area]);

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={onClose}
            style={{
              position: "fixed", inset: 0,
              background: "rgba(0,0,0,.5)",
              zIndex: 1000,
            }}
          />

          {/* Dialog */}
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Adicionar ao Caderno de Erros"
            initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.95, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.95, y: 16 }}
            transition={
              reduced
                ? { duration: 0.15 }
                : { type: "spring", damping: 25, stiffness: 300 }
            }
            className="caderno-sandbox"
            style={{
              position: "fixed",
              top: "50%", left: "50%",
              transform: "translate(-50%, -50%)",
              zIndex: 1001,
              width: "min(480px, calc(100vw - 32px))",
              background: "var(--surface)",
              borderRadius: "var(--radius-2xl)",
              boxShadow: "0 24px 64px rgba(0,0,0,.28)",
              fontFamily: "'Inter', sans-serif",
              overflow: "hidden",
            }}
          >
            {/* Header */}
            <div style={{ padding: "20px 20px 0" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--t3)", marginBottom: 4 }}>
                    Q{questionNumber} · {area} · {theme}
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: "var(--t1)" }}>
                    {wasCorrect ? "Acertou, mas quer revisar?" : "Adicionar ao Caderno de Erros"}
                  </div>
                </div>
                <button
                  onClick={onClose}
                  disabled={saving}
                  aria-label="Fechar"
                  style={{
                    width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center",
                    border: "none", background: "none", cursor: saving ? "not-allowed" : "pointer",
                    color: "var(--t3)", borderRadius: "var(--radius-sm)", flexShrink: 0,
                    opacity: saving ? 0.4 : 1,
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </div>
              <StepIndicator current={step} />
            </div>

            {/* Body */}
            <div style={{ padding: "16px 20px 20px", opacity: saving ? 0.4 : 1, transition: "opacity .2s" }}>
              <AnimatePresence mode="wait">
                {step === 1 ? (
                  <motion.div
                    key="step1"
                    initial={reduced ? {} : { opacity: 0, x: 30 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={reduced ? {} : { opacity: 0, x: -30 }}
                    transition={{ duration: 0.32, ease: [0.4, 0, 0.2, 1] }}
                  >
                    {wasCorrect && (
                      <div style={{
                        background: "#fffbeb", border: "1px solid #fde68a",
                        borderRadius: "var(--radius-md)", padding: "10px 14px",
                        fontSize: 12, color: "#92400e", marginBottom: 12, lineHeight: 1.5,
                      }}>
                        Acertou por exclusão ou intuição? Acertar sem domínio é um risco na prova real.
                      </div>
                    )}
                    {isDuplicate && existingEntry && (
                      <DuplicateBanner
                        existingReason={existingEntry.reason}
                        addedAt={existingEntry.addedAt}
                      />
                    )}
                    <div role="radiogroup" aria-label="Motivo do erro" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {availableKeys.map((key) => (
                        <ReasonCard
                          key={key}
                          type={ERROR_TYPES[key]}
                          selected={selectedType === key}
                          onSelect={() => setSelectedType(key)}
                          onKeyDown={(e) => {
                            if (e.key === "ArrowDown") {
                              e.preventDefault();
                              (e.currentTarget.nextElementSibling as HTMLButtonElement)?.focus();
                            }
                            if (e.key === "ArrowUp") {
                              e.preventDefault();
                              (e.currentTarget.previousElementSibling as HTMLButtonElement)?.focus();
                            }
                          }}
                        />
                      ))}
                    </div>
                    <button
                      onClick={() => setStep(2)}
                      disabled={!selectedType || (isDuplicate && isSameAsExisting)}
                      style={{
                        marginTop: 16, width: "100%", padding: "11px",
                        borderRadius: "var(--radius-md)", border: "none",
                        background: selectedType && !(isDuplicate && isSameAsExisting) ? "var(--wine)" : "var(--border)",
                        color: selectedType && !(isDuplicate && isSameAsExisting) ? "#fff" : "var(--t3)",
                        fontSize: 13.5, fontWeight: 700,
                        cursor: selectedType && !(isDuplicate && isSameAsExisting) ? "pointer" : "not-allowed",
                        fontFamily: "'Inter', sans-serif", transition: "all .15s",
                      }}
                    >
                      {isDuplicate ? "Atualizar →" : "Continuar →"}
                    </button>
                  </motion.div>
                ) : (
                  <motion.div
                    key="step2"
                    initial={reduced ? {} : { opacity: 0, x: 30 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={reduced ? {} : { opacity: 0, x: -30 }}
                    transition={{ duration: 0.32, ease: [0.4, 0, 0.2, 1] }}
                  >
                    <p style={{ fontSize: 12, color: "var(--t3)", marginBottom: 10 }}>
                      Anotação opcional — o que precisa lembrar?
                    </p>
                    {selectedHighlight && (
                      <div style={{
                        background: "var(--s3)", borderRadius: "var(--radius-sm)",
                        padding: "8px 12px", fontSize: 12, color: "var(--t2)",
                        marginBottom: 10, fontStyle: "italic",
                        borderLeft: "3px solid var(--wine)",
                      }}>
                        "{selectedHighlight}"
                      </div>
                    )}
                    <textarea
                      value={note}
                      onChange={(e) => setNote(e.target.value.slice(0, 300))}
                      placeholder="Ex: Revisar critérios de Boston para IC aguda…"
                      rows={4}
                      style={{
                        width: "100%", borderRadius: "var(--radius-md)",
                        border: "1.5px solid var(--border)", padding: "10px 12px",
                        fontSize: 12.5, color: "var(--t1)", resize: "vertical",
                        fontFamily: "'Inter', sans-serif", outline: "none",
                        boxSizing: "border-box", background: "var(--surface)",
                      }}
                      onFocus={(e) => { e.currentTarget.style.borderColor = "var(--wine)"; }}
                      onBlur={(e) => { e.currentTarget.style.borderColor = "var(--border)"; }}
                    />
                    <div style={{
                      textAlign: "right", fontSize: 11, marginBottom: 12,
                      color: note.length > 270 ? "#ef4444" : "var(--t4)",
                    }}>
                      {note.length}/300
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        onClick={handleSave}
                        disabled={saving}
                        style={{
                          flex: 1, padding: "11px", borderRadius: "var(--radius-md)",
                          border: "none",
                          background: saving ? "var(--border)" : "var(--wine)",
                          color: saving ? "var(--t3)" : "#fff",
                          fontSize: 13.5, fontWeight: 700, cursor: saving ? "not-allowed" : "pointer",
                          fontFamily: "'Inter', sans-serif",
                          display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                        }}
                      >
                        {saving ? (
                          <>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" style={{ animation: "spin .8s linear infinite" }}>
                              <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                            </svg>
                            Salvando…
                          </>
                        ) : "Salvar no Caderno"}
                      </button>
                      <button
                        onClick={handleSave}
                        disabled={saving}
                        style={{
                          padding: "11px 16px", borderRadius: "var(--radius-md)",
                          border: "1.5px solid var(--border)", background: "none",
                          color: "var(--t2)", fontSize: 13, cursor: "pointer",
                          fontFamily: "'Inter', sans-serif",
                        }}
                      >
                        Pular →
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </>
      )}
    </AnimatePresence>
  );
}
