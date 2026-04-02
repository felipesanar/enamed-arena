import { useEffect, useRef, useState } from "react";
import { CheckCircle2, ArrowRight, AlertTriangle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

declare global {
  interface Window {
    hbspt?: {
      forms: {
        create: (config: Record<string, unknown>) => void;
      };
    };
  }
}

interface HubSpotFormModalProps {
  open: boolean;
  onComplete: () => void;
  prefillEmail: string;
  prefillName: string;
}

function prefillField($form: any, fieldNames: string[], value: string) {
  if (!value) return;
  for (const name of fieldNames) {
    if ($form.find) {
      const $el = $form.find(`input[name="${name}"]`);
      if ($el.length) {
        $el.val(value).change();
        return;
      }
    }
    const el = $form.querySelector?.(`input[name="${name}"]`);
    if (el) {
      el.value = value;
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
      return;
    }
  }
}

export function HubSpotFormModal({
  open,
  onComplete,
  prefillEmail,
  prefillName,
}: HubSpotFormModalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const scriptLoadedRef = useRef(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!open) {
      setSubmitted(false);
      return;
    }

    if (containerRef.current) {
      containerRef.current.innerHTML = "";
    }

    const createForm = () => {
      if (!window.hbspt || !containerRef.current) return;

      window.hbspt.forms.create({
        portalId: "9321751",
        formId: "3cef6ec2-5f6f-4bab-ae9c-d3c2e2f2d3a3",
        region: "na1",
        target: "#hubspot-form-container",
        onFormReady: ($form: any) => {
          if (!$form) return;
          prefillField($form, ["email"], prefillEmail);
          prefillField($form, ["firstname", "name", "nome", "full_name", "fullname"], prefillName);
        },
        onFormSubmitted: () => {
          setSubmitted(true);
        },
      });
    };

    if (scriptLoadedRef.current && window.hbspt) {
      createForm();
      return;
    }

    const existing = document.querySelector(
      'script[src*="hsforms.net/forms/embed"]'
    );
    if (existing && window.hbspt) {
      scriptLoadedRef.current = true;
      createForm();
      return;
    }

    const script = document.createElement("script");
    script.src = "//js.hsforms.net/forms/embed/v2.js";
    script.charset = "utf-8";
    script.async = true;
    script.onload = () => {
      scriptLoadedRef.current = true;
      setTimeout(createForm, 100);
    };
    document.body.appendChild(script);
  }, [open, prefillEmail, prefillName]);

  return (
    <Dialog open={open} onOpenChange={() => { /* mandatory — don't allow close */ }}>
      <DialogContent
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
        className={[
          "max-h-[90vh] overflow-y-auto sm:max-w-[460px] rounded-2xl p-0",
          "border border-[hsl(var(--auth-border-subtle))]",
          "bg-[hsl(var(--auth-bg-soft))]",
          "shadow-[var(--auth-shadow-card)]",
          "text-[hsl(var(--auth-text-primary))]",
          "[&>button.absolute]:hidden",
        ].join(" ")}
      >
        {submitted ? (
          /* ── Success state with CTA ── */
          <div className="px-6 py-10 text-center space-y-5">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-success/15">
              <CheckCircle2 className="h-7 w-7 text-success" />
            </div>
            <div className="space-y-2">
              <h2 className="text-heading-3 font-semibold text-[hsl(var(--auth-text-primary))]">
                Cadastro completo!
              </h2>
              <p className="text-body-sm text-[hsl(var(--auth-text-muted))] max-w-[32ch] mx-auto leading-relaxed">
                Agora verifique seu e-mail para ativar sua conta e acessar a plataforma.
              </p>
            </div>
            <button
              type="button"
              onClick={onComplete}
              className="inline-flex h-11 w-full max-w-[280px] items-center justify-center gap-2 rounded-xl bg-primary text-body-sm font-semibold uppercase tracking-[0.02em] text-primary-foreground transition-all hover:bg-[hsl(var(--wine-hover))] hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.995] shadow-[0_4px_16px_-4px_hsl(var(--primary)/0.4)]"
            >
              Continuar <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        ) : (
          /* ── Form state ── */
          <>
            <div className="px-6 pt-6 pb-4 border-b border-[hsl(var(--auth-border-subtle))]">
              <DialogHeader className="space-y-1.5 text-center">
                <DialogTitle className="text-heading-3 font-semibold text-[hsl(var(--auth-text-primary))]">
                  Complete seu cadastro
                </DialogTitle>
                <DialogDescription className="text-body-sm text-[hsl(var(--auth-text-muted))]">
                  Preencha os campos restantes para finalizar. Seu nome e e-mail já foram preenchidos.
                </DialogDescription>
              </DialogHeader>
            </div>

            <div className="px-6 py-5">
              <div
                id="hubspot-form-container"
                ref={containerRef}
                className={[
                  "min-h-[200px] mx-auto max-w-[380px]",
                  "[&_form]:space-y-4",
                  "[&_.hs-form-field]:space-y-1.5",
                  "[&_label]:block [&_label]:text-[12px] [&_label]:font-semibold [&_label]:uppercase [&_label]:tracking-[0.06em]",
                  "[&_label]:text-[hsl(var(--auth-text-muted))]",
                  "[&_.hs-form-required]:text-primary [&_.hs-form-required]:ml-0.5",
                  "[&_input[type='text']]:h-11 [&_input[type='email']]:h-11 [&_input[type='tel']]:h-11",
                  "[&_input]:w-full [&_input]:rounded-xl",
                  "[&_input]:border [&_input]:border-[hsl(var(--auth-border-subtle))]",
                  "[&_input]:bg-[hsl(var(--auth-input))]",
                  "[&_input]:px-3.5 [&_input]:py-2.5",
                  "[&_input]:text-body-sm [&_input]:font-medium",
                  "[&_input]:text-[hsl(var(--auth-text-primary))]",
                  "[&_input]:placeholder:text-[hsl(var(--auth-text-muted)/0.5)]",
                  "[&_input]:transition-all [&_input]:duration-200",
                  "[&_input:focus]:outline-none [&_input:focus]:ring-2 [&_input:focus]:ring-primary/40",
                  "[&_input:focus]:border-primary/50",
                  "[&_select]:h-11 [&_select]:w-full [&_select]:rounded-xl [&_select]:appearance-none",
                  "[&_select]:border [&_select]:border-[hsl(var(--auth-border-subtle))]",
                  "[&_select]:bg-[hsl(var(--auth-input))]",
                  "[&_select]:px-3.5 [&_select]:py-2.5",
                  "[&_select]:text-body-sm [&_select]:font-medium",
                  "[&_select]:text-[hsl(var(--auth-text-primary))]",
                  "[&_select]:transition-all [&_select]:duration-200",
                  "[&_select:focus]:outline-none [&_select:focus]:ring-2 [&_select:focus]:ring-primary/40",
                  "[&_select:focus]:border-primary/50",
                  "[&_select_option]:bg-[hsl(var(--auth-bg-soft))] [&_select_option]:text-[hsl(var(--auth-text-primary))]",
                  "[&_.hs-submit]:mt-5 [&_.hs-submit]:text-center",
                  "[&_.hs-button]:inline-flex [&_.hs-button]:w-full [&_.hs-button]:items-center [&_.hs-button]:justify-center",
                  "[&_.hs-button]:h-11 [&_.hs-button]:rounded-xl",
                  "[&_.hs-button]:bg-primary [&_.hs-button]:hover:bg-[hsl(var(--wine-hover))]",
                  "[&_.hs-button]:text-body-sm [&_.hs-button]:font-semibold [&_.hs-button]:uppercase [&_.hs-button]:tracking-[0.02em]",
                  "[&_.hs-button]:text-primary-foreground",
                  "[&_.hs-button]:border-0 [&_.hs-button]:cursor-pointer",
                  "[&_.hs-button]:transition-all [&_.hs-button]:duration-200",
                  "[&_.hs-button]:hover:-translate-y-0.5",
                  "[&_.hs-button]:active:translate-y-0 [&_.hs-button]:active:scale-[0.995]",
                  "[&_.hs-button]:shadow-[0_4px_16px_-4px_hsl(var(--primary)/0.4)]",
                  "[&_.hs-error-msgs]:mt-1 [&_.hs-error-msgs]:list-none [&_.hs-error-msgs]:p-0",
                  "[&_.hs-error-msg]:text-[11px] [&_.hs-error-msg]:text-destructive",
                  "[&_.legal-consent-container]:mt-3 [&_.legal-consent-container]:text-center [&_.legal-consent-container]:text-[11px] [&_.legal-consent-container]:text-[hsl(var(--auth-text-muted)/0.7)]",
                  "[&_.legal-consent-container_a]:text-primary [&_.legal-consent-container_a]:hover:underline",
                  "[&_.hs-form-title]:hidden",
                ].join(" ")}
              />
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
