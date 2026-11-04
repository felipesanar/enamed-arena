import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useUser } from '@/contexts/UserContext';
import { useAppConfig } from '@/hooks/useAppConfig';
import { useExamEditions } from '@/hooks/useExamEditions';
import { Button } from '@/components/ui/button';
import { EditionTargetPicker, type EditionTargetValue } from '@/components/editions/EditionTargetPicker';

// Also used by the onboarding step and prompt; callers mount it only for a ready account and enabled flag.
export function EditionTargetForm({ initialValue, onSaved, onCancel, submitLabel = 'Salvar edição', onPendingChange }: {
  initialValue: EditionTargetValue;
  onSaved?: (value: EditionTargetValue) => void;
  onCancel?: () => void;
  submitLabel?: string;
  onPendingChange?: (pending: boolean) => void;
}) {
  const { saveTargetEdition } = useUser();
  const errorId = useId();
  const query = useExamEditions();
  const [value, setValue] = useState(initialValue);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const errorRef = useRef<HTMLParagraphElement>(null);
  const active = useRef(true);
  const sending = useRef(false);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  useEffect(() => { if (error) errorRef.current?.focus(); }, [error]);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (sending.current) return;
    const { targetEditionId } = value;
    const validation = value.expectedGraduationTerm !== null && !/^\d{4}\.[12]$/.test(value.expectedGraduationTerm)
      ? 'Informe ano com quatro dígitos e semestre, ou deixe ambos em branco.'
      : targetEditionId != null && (!query.isSuccess || !query.data?.some(item => item.id === targetEditionId))
      ? 'Não foi possível conferir a edição selecionada. Recarregue o catálogo ou escolha Ainda não sei.' : null;
    setSaved(false);
    if (validation || targetEditionId === undefined) {
      setError(validation ?? 'Escolha uma edição ou marque Ainda não sei.');
      errorRef.current?.focus();
      return;
    }
    sending.current = true;
    setPending(true);
    onPendingChange?.(true);
    setError('');
    try {
      await saveTargetEdition(targetEditionId, value.expectedGraduationTerm);
      if (!active.current) return;
      setSaved(true);
      onSaved?.(value);
    } catch {
      if (active.current) setError('Não foi possível salvar. Suas escolhas foram mantidas. Tente novamente.');
    } finally {
      if (active.current) {
        sending.current = false;
        setPending(false);
        onPendingChange?.(false);
      }
    }
  };
  return <form onSubmit={submit} noValidate aria-busy={pending} aria-describedby={error ? errorId : undefined} className="min-w-0 space-y-4">
    <EditionTargetPicker value={value} onChange={next => { setValue(next); setError(''); setSaved(false); }} disabled={pending} />
    {error && <p id={errorId} ref={errorRef} tabIndex={-1} role="alert" className="rounded-xl border border-destructive/40 bg-destructive/5 p-3 text-sm text-foreground">{error}</p>}
    <div className="flex flex-wrap gap-3 border-t border-border pt-4">
      <Button type="submit" disabled={pending} className="min-h-11 flex-1">{pending ? 'Salvando…' : submitLabel}</Button>
      {onCancel && <Button type="button" variant="outline" disabled={pending} className="min-h-11" onClick={onCancel}>Cancelar</Button>}
    </div>
    <p role="status" className="text-sm">{pending ? 'Salvando sua escolha…' : saved ? 'Edição salva. Você pode alterar sua escolha quando quiser.' : ''}</p>
  </form>;
}

export function EditionTargetSettings() {
  const enabled = useAppConfig('editions_ui');
  const { user, loading } = useAuth();
  const { profile, onboarding, isLoading } = useUser();
  if (!enabled || loading || isLoading || !user || profile?.id !== user.id || (onboarding && onboarding.userId !== user.id)) return null;
  return <section className="mb-5 min-w-0 space-y-4 rounded-2xl border border-border bg-card p-5 text-foreground md:p-6" aria-label="Edição-alvo">
    <div><h2 className="text-heading-3">Edição-alvo</h2><p className="mt-1 text-sm text-muted-foreground">Essa escolha é independente da edição de especialidade e instituições, mesmo durante uma janela de simulado.</p></div>
    <EditionTargetForm key={user.id} initialValue={{ targetEditionId: onboarding?.targetEditionId ?? null, expectedGraduationTerm: onboarding?.expectedGraduationTerm ?? null }} />
  </section>;
}
