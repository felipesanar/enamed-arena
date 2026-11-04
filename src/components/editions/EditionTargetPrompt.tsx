import { useEffect, useRef, useState } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { useAuth } from '@/contexts/AuthContext';
import { useUser } from '@/contexts/UserContext';
import { useAppConfig } from '@/hooks/useAppConfig';
import { Button } from '@/components/ui/button';
import { Dialog, DialogOverlay, DialogPortal, DialogDescription, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { EditionTargetForm } from '@/components/editions/EditionTargetSettings';

export function EditionTargetPrompt() {
  const enabled = useAppConfig('editions_ui');
  const { user, loading } = useAuth();
  const { profile, onboarding, isLoading } = useUser();
  if (!enabled || loading || isLoading || !user || profile?.id !== user.id || (onboarding && onboarding.userId !== user.id)) return null;
  return <Prompt key={user.id} />;
}

function Prompt() {
  const { onboarding } = useUser();
  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [pending, setPending] = useState(false);
  const saved = useRef(false);
  const title = useRef<HTMLHeadingElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const active = useRef(true);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  const focusPage = () => {
    const anchor = document.querySelector<HTMLElement>('[data-edition-target-focus], [data-edition-target-home] h1') ?? document.querySelector<HTMLElement>('main h1');
    if (anchor) {
      if (!anchor.hasAttribute('tabindex')) anchor.setAttribute('tabindex', '-1');
      anchor.focus();
    }
  };
  const hidden = dismissed || (!open && !!onboarding?.targetEditionId);
  if (!open && !saved.current && (dismissed || onboarding?.targetEditionId)) return null;
  return <>
    <Dialog open={open} onOpenChange={next => { if (!pending) setOpen(next); }}>
      <section hidden={hidden} className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border bg-card p-5" aria-label="Escolher edição-alvo">
        <div className="min-w-0"><h2 className="text-heading-3">Qual edição é o seu alvo?</h2><p className="mt-1 text-sm text-muted-foreground">Escolha quando quiser. Seus simulados continuam disponíveis.</p></div>
        <div className="flex flex-wrap gap-2">
          <DialogTrigger asChild><Button ref={trigger} variant="outline" className="min-h-11">Escolher edição</Button></DialogTrigger>
          <Button variant="ghost" className="min-h-11" onClick={() => { setDismissed(true); focusPage(); }}>Agora não</Button>
        </div>
      </section>
      <DialogPortal>
      <DialogOverlay className="motion-reduce:!animate-none" />
      <DialogPrimitive.Content className="fixed left-1/2 top-1/2 z-50 grid max-h-[90dvh] w-[calc(100%_-_2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 gap-4 overflow-y-auto rounded-xl border border-border bg-background p-6 text-foreground shadow-lg data-[state=open]:animate-in data-[state=open]:fade-in-0 motion-reduce:!animate-none" onOpenAutoFocus={event => { event.preventDefault(); title.current?.focus(); }}
        onCloseAutoFocus={event => { event.preventDefault(); if (!active.current) return; if (saved.current) focusPage(); else trigger.current?.focus(); }}
        onEscapeKeyDown={event => { if (pending) event.preventDefault(); }} onPointerDownOutside={event => { if (pending) event.preventDefault(); }}>
        <DialogTitle ref={title} tabIndex={-1}>Escolher edição</DialogTitle>
        <DialogDescription>Você pode alterar depois nas configurações.</DialogDescription>
        <EditionTargetForm initialValue={{ targetEditionId: undefined, expectedGraduationTerm: onboarding?.expectedGraduationTerm ?? null }}
          onPendingChange={setPending} onCancel={() => setOpen(false)} onSaved={() => { saved.current = true; setOpen(false); setDismissed(true); }} />
      </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
    <p role="status" className="text-sm">{saved.current ? 'Edição salva. Você pode alterá-la nas configurações.' : ''}</p>
  </>;
}
