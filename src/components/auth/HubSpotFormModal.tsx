import { useEffect, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ArrowRight, X } from "lucide-react";

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
  onOpenChange: (open: boolean) => void;
  prefillEmail: string;
  prefillName: string;
}

export function HubSpotFormModal({
  open,
  onOpenChange,
  prefillEmail,
  prefillName,
}: HubSpotFormModalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const scriptLoadedRef = useRef(false);

  useEffect(() => {
    if (!open) return;

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
          const emailInput = $form.find
            ? $form.find('input[name="email"]')
            : $form.querySelector?.('input[name="email"]');
          const nameInput = $form.find
            ? $form.find('input[name="firstname"]')
            : $form.querySelector?.('input[name="firstname"]');

          if (emailInput?.val) {
            emailInput.val(prefillEmail).change();
          } else if (emailInput) {
            emailInput.value = prefillEmail;
            emailInput.dispatchEvent(new Event("input", { bubbles: true }));
          }

          if (nameInput?.val) {
            nameInput.val(prefillName).change();
          } else if (nameInput) {
            nameInput.value = prefillName;
            nameInput.dispatchEvent(new Event("input", { bubbles: true }));
          }
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={[
          "max-h-[90vh] overflow-y-auto sm:max-w-[460px] rounded-2xl p-0",
          /* Auth dark surface */
          "border border-[hsl(var(--auth-border-subtle))]",
          "bg-[hsl(var(--auth-bg-soft))]",
          "shadow-[var(--auth-shadow-card)]",
          "text-[hsl(var(--auth-text-primary))]",
          /* Remove default close button — we render our own */
          "[&>button.absolute]:hidden",
        ].join(" ")}
      >
        {/* Close button */}
        <button
          type="button"
          onClick={() => onOpenChange(false)}
          className="absolute right-3.5 top-3.5 z-10 flex h-7 w-7 items-center justify-center rounded-lg border border-[hsl(var(--auth-border-subtle))] bg-[hsl(var(--auth-surface-soft))] text-[hsl(var(--auth-text-muted))] transition-colors hover:border-[hsl(var(--auth-border-strong))] hover:text-[hsl(var(--auth-text-primary))]"
          aria-label="Fechar"
        >
          <X className="h-3.5 w-3.5" />
        </button>

        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-[hsl(var(--auth-border-subtle))]">
          <DialogHeader className="space-y-1.5">
            <DialogTitle className="text-heading-3 font-semibold text-[hsl(var(--auth-text-primary))]">
              Complete seu cadastro
            </DialogTitle>
            <DialogDescription className="text-body-sm text-[hsl(var(--auth-text-muted))]">
              Preencha os campos restantes. Seu nome e e-mail já foram preenchidos.
            </DialogDescription>
          </DialogHeader>
        </div>

        {/* HubSpot form container with auth-themed overrides */}
        <div className="px-6 py-5">
          <div
            id="hubspot-form-container"
            ref={containerRef}
            className={[
              "min-h-[200px]",

              /* Form layout */
              "[&_form]:space-y-4",
              "[&_.hs-form-field]:space-y-1.5",

              /* Labels */
              "[&_label]:block [&_label]:text-[12px] [&_label]:font-semibold [&_label]:uppercase [&_label]:tracking-[0.06em]",
              "[&_label]:text-[hsl(var(--auth-text-muted))]",
              "[&_.hs-form-required]:text-primary [&_.hs-form-required]:ml-0.5",

              /* Text inputs */
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

              /* Select (Etapa da carreira) */
              "[&_select]:h-11 [&_select]:w-full [&_select]:rounded-xl [&_select]:appearance-none",
              "[&_select]:border [&_select]:border-[hsl(var(--auth-border-subtle))]",
              "[&_select]:bg-[hsl(var(--auth-input))]",
              "[&_select]:px-3.5 [&_select]:py-2.5",
              "[&_select]:text-body-sm [&_select]:font-medium",
              "[&_select]:text-[hsl(var(--auth-text-primary))]",
              "[&_select]:transition-all [&_select]:duration-200",
              "[&_select:focus]:outline-none [&_select:focus]:ring-2 [&_select:focus]:ring-primary/40",
              "[&_select:focus]:border-primary/50",
              /* Select option styling */
              "[&_select_option]:bg-[hsl(var(--auth-bg-soft))] [&_select_option]:text-[hsl(var(--auth-text-primary))]",

              /* Submit button */
              "[&_.hs-submit]:mt-5",
              "[&_.hs-button]:flex [&_.hs-button]:w-full [&_.hs-button]:items-center [&_.hs-button]:justify-center",
              "[&_.hs-button]:h-11 [&_.hs-button]:rounded-xl",
              "[&_.hs-button]:bg-primary [&_.hs-button]:hover:bg-[hsl(var(--wine-hover))]",
              "[&_.hs-button]:text-body-sm [&_.hs-button]:font-semibold [&_.hs-button]:uppercase [&_.hs-button]:tracking-[0.02em]",
              "[&_.hs-button]:text-primary-foreground",
              "[&_.hs-button]:border-0 [&_.hs-button]:cursor-pointer",
              "[&_.hs-button]:transition-all [&_.hs-button]:duration-200",
              "[&_.hs-button]:hover:-translate-y-0.5",
              "[&_.hs-button]:active:translate-y-0 [&_.hs-button]:active:scale-[0.995]",
              "[&_.hs-button]:shadow-[0_4px_16px_-4px_hsl(var(--primary)/0.4)]",

              /* Error messages */
              "[&_.hs-error-msgs]:mt-1 [&_.hs-error-msgs]:list-none [&_.hs-error-msgs]:p-0",
              "[&_.hs-error-msg]:text-[11px] [&_.hs-error-msg]:text-destructive",

              /* Legal consent */
              "[&_.legal-consent-container]:text-[11px] [&_.legal-consent-container]:text-[hsl(var(--auth-text-muted)/0.7)]",
              "[&_.legal-consent-container_a]:text-primary [&_.legal-consent-container_a]:hover:underline",

              /* Hide form title if HubSpot renders one */
              "[&_.hs-form-title]:hidden",
            ].join(" ")}
          />
        </div>

        {/* Skip button */}
        <div className="px-6 pb-5 pt-0">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="flex h-10 w-full items-center justify-center rounded-xl border border-[hsl(var(--auth-border-subtle))] bg-[hsl(var(--auth-surface-soft))] text-body-sm font-semibold text-[hsl(var(--auth-text-muted))] transition-all duration-200 hover:border-[hsl(var(--auth-border-strong))] hover:text-[hsl(var(--auth-text-primary))] hover:-translate-y-0.5"
          >
            Pular por enquanto
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
