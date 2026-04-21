import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Check, Pencil, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface InlineNameEditProps {
  value: string;
  onSave: (next: string) => Promise<void> | void;
  placeholder?: string;
  /** Exibido quando o valor está vazio (ex.: "Adicionar seu nome"). */
  emptyLabel?: string;
  /** `text-body-sm` por padrão — usado nos rows. */
  className?: string;
}

export function InlineNameEdit({
  value,
  onSave,
  placeholder = "Seu nome completo",
  emptyLabel = "Adicionar nome",
  className,
}: InlineNameEditProps) {
  const reduced = useReducedMotion();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!editing) setDraft(value);
  }, [value, editing]);

  useEffect(() => {
    if (editing) {
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [editing]);

  const dirty = draft.trim() !== value.trim();
  const canSave = dirty && draft.trim().length > 0 && !saving;

  const submit = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      await onSave(draft.trim());
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  const cancel = () => {
    setDraft(value);
    setEditing(false);
  };

  return (
    <AnimatePresence initial={false} mode="wait">
      {editing ? (
        <motion.form
          key="editing"
          initial={reduced ? false : { opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduced ? { opacity: 0 } : { opacity: 0, y: -4 }}
          transition={{ duration: 0.18 }}
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
          className={cn("flex items-center gap-2", className)}
        >
          <label htmlFor="inline-name-input" className="sr-only">
            {placeholder}
          </label>
          <input
            ref={inputRef}
            id="inline-name-input"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={placeholder}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.preventDefault();
                cancel();
              }
            }}
            className={cn(
              "h-10 w-full max-w-sm rounded-xl border border-input bg-background",
              "px-3 text-body text-foreground placeholder:text-muted-foreground/70",
              "shadow-[inset_0_1px_0_0_rgba(0,0,0,0.02)]",
              "focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/40",
            )}
          />
          <button
            type="submit"
            disabled={!canSave}
            aria-label="Salvar nome"
            title="Salvar"
            className={cn(
              "h-10 w-10 inline-flex items-center justify-center rounded-xl transition-colors",
              "bg-primary text-primary-foreground hover:bg-wine-hover",
              "disabled:opacity-40 disabled:cursor-not-allowed",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
            )}
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <Check className="h-4 w-4" aria-hidden="true" />
            )}
          </button>
          <button
            type="button"
            onClick={cancel}
            disabled={saving}
            aria-label="Cancelar edição"
            title="Cancelar"
            className="h-10 w-10 inline-flex items-center justify-center rounded-xl border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </motion.form>
      ) : (
        <motion.button
          key="display"
          type="button"
          onClick={() => setEditing(true)}
          initial={reduced ? false : { opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduced ? { opacity: 0 } : { opacity: 0, y: 4 }}
          transition={{ duration: 0.18 }}
          className={cn(
            "group inline-flex items-center gap-2 rounded-lg text-foreground -mx-1.5 -my-1 px-1.5 py-1 transition-colors",
            "hover:bg-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
            className,
          )}
        >
          <span
            className={cn(
              "font-semibold",
              !value.trim() && "text-muted-foreground italic font-normal",
            )}
          >
            {value.trim() || emptyLabel}
          </span>
          <Pencil
            className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity"
            aria-hidden="true"
          />
        </motion.button>
      )}
    </AnimatePresence>
  );
}
