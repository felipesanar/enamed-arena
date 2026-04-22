import { useState, useEffect, useId } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { simuladosApi } from '@/services/simuladosApi';
import { toast } from '@/hooks/use-toast';
import { logger } from '@/lib/logger';
import {
  type LocalReason,
  LOCAL_REASON_META,
  LOCAL_TO_DB_REASON,
} from '@/lib/errorNotebookReasons';

// ── SVG icon paths (Lucide-style, stroke-width 1.8) ──────────────────────────

const ICONS: Record<LocalReason, JSX.Element> = {
  nao_sei: (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </svg>
  ),
  nao_lembrei: (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
    </svg>
  ),
  leitura: (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /><line x1="2" y1="2" x2="22" y2="22" strokeWidth="1.8" />
    </svg>
  ),
  diferencial: (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="2" x2="12" y2="22" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </svg>
  ),
  acertei_sem_certeza: (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="3" /><line x1="12" y1="2" x2="12" y2="5" /><line x1="12" y1="19" x2="12" y2="22" /><line x1="2" y1="12" x2="5" y2="12" /><line x1="19" y1="12" x2="22" y2="12" />
    </svg>
  ),
};

// ── Props ─────────────────────────────────────────────────────────────────────

interface AddToNotebookModalProps {
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

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

// ── Step indicator ────────────────────────────────────────────────────────────

function StepIndicator({ step }: { step: 1 | 2 }) {
  const pip = (n: 1 | 2) => {
    const done = n < step;
    const active = n === step;
    return (
      <div
        style={{
          width: 20, height: 20, borderRadius: '50%',
          background: done ? '#d1fae5' : active ? '#7c2d44' : '#e5e7eb',
          color: done ? '#059669' : active ? '#fff' : '#9ca3af',
          fontSize: 10, fontWeight: 700,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        {done
          ? <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12" /></svg>
          : n
        }
      </div>
    );
  };

  const stepLabel = (n: 1 | 2, text: string) => {
    const done = n < step;
    const active = n === step;
    return (
      <span style={{ fontSize: 11, fontWeight: 600, color: done ? '#059669' : active ? '#111827' : '#9ca3af', marginLeft: 6 }}>
        {text}
      </span>
    );
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', padding: '10px 20px', background: '#f8fafc', borderBottom: '1px solid #e5e7eb' }}>
      {pip(1)}{stepLabel(1, 'Motivo')}
      <div style={{ flex: 1, height: 1.5, background: step > 1 ? '#a7f3d0' : '#e5e7eb', margin: '0 10px', borderRadius: 1 }} />
      {pip(2)}{stepLabel(2, 'Anotação')}
    </div>
  );
}

// ── Modal ─────────────────────────────────────────────────────────────────────

export function AddToNotebookModal({
  open, onClose, questionId, simuladoId, simuladoTitle,
  area, theme, questionNumber, questionText, wasCorrect, userId, onAdded,
  selectedHighlight, existingEntry,
}: AddToNotebookModalProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const [reason, setReason] = useState<LocalReason | null>(null);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const isDuplicate = !!existingEntry;
  const initialDbReason = existingEntry?.reason;

  useEffect(() => {
    if (!open) return;
    setStep(1);
    setNote(selectedHighlight ? `"${selectedHighlight}"\n\n` : '');
    // Pre-select existing reason for duplicate
    if (existingEntry) {
      const match = (Object.keys(LOCAL_TO_DB_REASON) as LocalReason[]).find(
        k => LOCAL_TO_DB_REASON[k] === existingEntry.reason,
      );
      setReason(match ?? null);
    } else {
      setReason(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleSubmit = async () => {
    if (!reason || !userId) return;
    setSaving(true);
    try {
      await simuladosApi.addToErrorNotebook({
        userId, simuladoId, questionId, area, theme,
        reason: LOCAL_TO_DB_REASON[reason],
        learningText: note || null,
        wasCorrect,
        questionNumber,
        questionText: questionText.substring(0, 500),
        simuladoTitle,
      });
      const meta = LOCAL_REASON_META[reason];
      toast({
        title: 'Salvo no Caderno de Erros',
        description: `Q${questionNumber} · ${area} adicionada à fila de revisão.`,
      });
      onAdded?.();
      onClose();
    } catch (err) {
      logger.error('[AddToNotebookModal] Error:', err);
      toast({ title: 'Erro ao salvar', description: 'Tente novamente.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const reasons = (
    Object.entries(LOCAL_REASON_META) as [LocalReason, (typeof LOCAL_REASON_META)[LocalReason]][]
  ).filter(([, m]) => wasCorrect ? !m.forWrongAnswer : m.forWrongAnswer).map(([k]) => k);

  // "Atualizar" only enabled if user picked a *different* reason
  const canSave = reason !== null && (!isDuplicate || LOCAL_TO_DB_REASON[reason] !== initialDbReason);

  const step1Title = wasCorrect ? 'Acertou, mas quer revisar?' : 'Por que salvar esta questão?';
  const metaLine = `Q${questionNumber} · ${area}${theme ? ` · ${theme}` : ''}`;

  const titleId = useId();
  const descId = useId();

  // Close with Escape; lock body scroll while open.
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !saving) {
        e.preventDefault();
        onClose();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, saving, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,.45)', padding: 16 }}
          onClick={() => { if (!saving) onClose(); }}
          aria-hidden={!open}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={descId}
            initial={{ opacity: 0, scale: 0.95, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 16 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            style={{
              background: '#fff', borderRadius: 18, boxShadow: '0 8px 32px rgba(0,0,0,.12), 0 2px 6px rgba(0,0,0,.06)',
              maxWidth: 420, width: '100%', overflow: 'hidden',
              opacity: saving ? 0.7 : 1, transition: 'opacity 0.2s',
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{ padding: '18px 20px 14px', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: 9, background: '#fdf2f5', border: '1px solid #f0d0d9', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="#7c2d44" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" /><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
                </svg>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div id={titleId} style={{ fontSize: 14, fontWeight: 700, color: '#111827', lineHeight: 1.3 }}>
                  {step === 1 ? step1Title : 'O que você aprendeu?'}
                </div>
                <div id={descId} style={{ fontSize: 11, color: '#6b7280', marginTop: 1 }}>
                  {step === 1 ? metaLine : `Q${questionNumber} · ${reason ? LOCAL_REASON_META[reason].badge : ''} · ${area}`}
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                disabled={saving}
                aria-label="Fechar diálogo"
                title="Fechar"
                style={{ width: 28, height: 28, borderRadius: 7, background: 'none', border: 'none', cursor: saving ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <X size={14} color="#6b7280" aria-hidden="true" />
              </button>
            </div>

            {/* Step indicator */}
            <StepIndicator step={step} />

            {/* Steps */}
            <AnimatePresence mode="wait">
              {step === 1 && (
                <motion.div
                  key="step1"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.18 }}
                >
                  {/* Duplicate banner */}
                  {isDuplicate && existingEntry && (
                    <div style={{ padding: '12px 20px 0' }}>
                      <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 9, padding: '10px 13px', display: 'flex', gap: 9, alignItems: 'flex-start' }}>
                        <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="#b45309" strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0, marginTop: 1 }}>
                          <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                        </svg>
                        <span style={{ fontSize: 11.5, color: '#92400e', lineHeight: 1.5 }}>
                          <strong style={{ color: '#78350f' }}>Já está no Caderno</strong> — adicionada em {fmtDate(existingEntry.addedAt)}. Selecione outro motivo para atualizar.
                        </span>
                      </div>
                    </div>
                  )}

                  {/* wasCorrect banner */}
                  {wasCorrect && (
                    <div style={{ padding: '12px 20px 0' }}>
                      <div style={{ background: '#fefce8', border: '1.5px solid #fde047', borderRadius: 10, padding: '11px 13px', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#b45309" strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0, marginTop: 1 }}>
                          <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                        </svg>
                        <div style={{ fontSize: 12, color: '#78350f', lineHeight: 1.5 }}>
                          <strong style={{ display: 'block', color: '#451a03', fontSize: 12.5, marginBottom: 2 }}>Acertou por exclusão ou intuição?</strong>
                          Acertar sem domínio é um risco na prova real. Vale revisar.
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Reason cards */}
                  <div style={{ padding: '14px 20px', display: 'flex', flexDirection: 'column', gap: 7 }}>
                    {reasons.map(r => {
                      const meta = LOCAL_REASON_META[r];
                      const selected = reason === r;
                      return (
                        <button
                          key={r}
                          onClick={() => setReason(r)}
                          style={{
                            borderRadius: 10,
                            border: selected ? `1.5px solid ${meta.colorBorder}` : '1.5px solid #e5e7eb',
                            background: selected ? meta.colorBg : '#fff',
                            padding: '11px 13px',
                            cursor: 'pointer',
                            textAlign: 'left',
                            transition: 'border-color .12s, background .12s',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                            <div style={{ width: 28, height: 28, borderRadius: 7, background: selected ? meta.colorBg : '#f1f3f6', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: selected ? meta.colorText : '#6b7280' }}>
                              {ICONS[r]}
                            </div>
                            <span style={{ fontSize: 12.5, fontWeight: 600, color: '#111827', flex: 1 }}>{meta.label}</span>
                            <span style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '0.04em', padding: '2px 7px', borderRadius: 99, background: selected ? meta.colorBg : '#f1f3f6', color: selected ? meta.colorText : '#6b7280', border: selected ? `1px solid ${meta.colorBorder}` : '1px solid #e5e7eb', flexShrink: 0 }}>
                              {meta.badge}
                            </span>
                          </div>
                          <div style={{ fontSize: 11, color: '#6b7280', marginTop: 4, paddingLeft: 37, lineHeight: 1.5 }}>
                            {meta.hint}
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {/* Footer */}
                  <div style={{ padding: '14px 20px', borderTop: '1px solid #e5e7eb', display: 'flex', gap: 8 }}>
                    <button
                      onClick={onClose}
                      style={{ borderRadius: 9, padding: '9px 16px', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', border: 'none', background: '#f8fafc', color: '#374151', flexShrink: 0 }}
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={() => canSave && setStep(2)}
                      disabled={!canSave}
                      style={{ flex: 1, borderRadius: 9, padding: '9px 16px', fontSize: 12.5, fontWeight: 600, cursor: canSave ? 'pointer' : 'not-allowed', border: 'none', background: '#7c2d44', color: '#fff', opacity: canSave ? 1 : 0.4, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}
                    >
                      {isDuplicate ? 'Atualizar →' : 'Continuar →'}
                    </button>
                  </div>
                </motion.div>
              )}

              {step === 2 && (
                <motion.div
                  key="step2"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ duration: 0.18 }}
                >
                  <div style={{ padding: '14px 20px 4px', opacity: saving ? 0.4 : 1 }}>
                    {/* Highlight box */}
                    {selectedHighlight && (
                      <div style={{ borderRadius: 9, background: '#fdf2f5', border: '1px solid #f0d0d9', padding: '9px 13px', marginBottom: 12 }}>
                        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#7c2d44', marginBottom: 3, display: 'flex', alignItems: 'center', gap: 5 }}>
                          <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="#7c2d44" strokeWidth="2">
                            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                          </svg>
                          Trecho selecionado
                        </div>
                        <div style={{ fontSize: 11.5, color: '#374151', fontStyle: 'italic', lineHeight: 1.5 }}>
                          "{selectedHighlight}"
                        </div>
                      </div>
                    )}

                    {/* Note textarea */}
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 8 }}>
                      Sua anotação <span style={{ color: '#9ca3af', fontWeight: 400 }}>(opcional)</span>
                    </div>
                    <textarea
                      value={note}
                      onChange={e => setNote(e.target.value.slice(0, 300))}
                      placeholder="O que ficou claro agora? Escreva em suas palavras…"
                      rows={4}
                      disabled={saving}
                      style={{
                        width: '100%', borderRadius: 9, border: '1.5px solid #e5e7eb',
                        background: '#fff', padding: '11px 13px', fontSize: 12.5,
                        fontFamily: 'inherit', color: '#111827', resize: 'none',
                        outline: 'none', lineHeight: 1.6,
                      }}
                      onFocus={e => { e.target.style.borderColor = '#9b3557'; e.target.style.boxShadow = '0 0 0 3px rgba(124,45,68,.09)'; }}
                      onBlur={e => { e.target.style.borderColor = '#e5e7eb'; e.target.style.boxShadow = 'none'; }}
                    />
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 5 }}>
                      <span style={{ fontSize: 11, color: '#9ca3af' }}>{note.length} / 300</span>
                      <button
                        onClick={handleSubmit}
                        disabled={saving}
                        style={{ fontSize: 11.5, color: '#6b7280', textDecoration: 'underline', textUnderlineOffset: 3, background: 'none', border: 'none', cursor: saving ? 'not-allowed' : 'pointer' }}
                      >
                        Pular →
                      </button>
                    </div>
                  </div>

                  {/* Footer */}
                  <div style={{ padding: '14px 20px', borderTop: '1px solid #e5e7eb', display: 'flex', gap: 8 }}>
                    <button
                      onClick={() => setStep(1)}
                      disabled={saving}
                      style={{ borderRadius: 9, padding: '9px 16px', fontSize: 12.5, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', background: 'transparent', color: '#6b7280', border: '1.5px solid #e5e7eb', flexShrink: 0 }}
                    >
                      ← Voltar
                    </button>
                    <button
                      onClick={handleSubmit}
                      disabled={saving}
                      style={{ flex: 1, borderRadius: 9, padding: '9px 16px', fontSize: 12.5, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', border: 'none', background: '#7c2d44', color: '#fff', opacity: saving ? 0.9 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                    >
                      {saving ? (
                        <>
                          <div style={{ width: 13, height: 13, border: '2px solid rgba(255,255,255,.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin .7s linear infinite' }} />
                          Salvando…
                        </>
                      ) : 'Salvar no Caderno'}
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
