import { useEffect, useRef } from "react";
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

    // Clear previous form
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
          // Pre-fill email and name
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

    // Check if script already exists
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
      // Small delay for hbspt to initialize
      setTimeout(createForm, 100);
    };
    document.body.appendChild(script);
  }, [open, prefillEmail, prefillName]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto border-border bg-background sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">
            Complete seu cadastro
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Preencha os campos restantes para finalizar. Seu nome e e-mail já
            foram preenchidos automaticamente.
          </DialogDescription>
        </DialogHeader>

        <div
          id="hubspot-form-container"
          ref={containerRef}
          className="min-h-[200px] [&_form]:space-y-3 [&_input]:rounded-md [&_input]:border [&_input]:border-border [&_input]:bg-background [&_input]:px-3 [&_input]:py-2 [&_input]:text-sm [&_select]:rounded-md [&_select]:border [&_select]:border-border [&_select]:bg-background [&_select]:px-3 [&_select]:py-2 [&_select]:text-sm [&_label]:text-sm [&_label]:font-medium [&_label]:text-foreground [&_.hs-submit]:mt-4 [&_.hs-button]:w-full [&_.hs-button]:rounded-lg [&_.hs-button]:bg-primary [&_.hs-button]:px-4 [&_.hs-button]:py-2.5 [&_.hs-button]:text-sm [&_.hs-button]:font-semibold [&_.hs-button]:text-primary-foreground [&_.hs-button]:transition-colors [&_.hs-button]:hover:bg-primary/90"
        />

        <button
          type="button"
          onClick={() => onOpenChange(false)}
          className="mt-2 w-full text-center text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          Pular por enquanto
        </button>
      </DialogContent>
    </Dialog>
  );
}
