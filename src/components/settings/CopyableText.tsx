import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

interface CopyableTextProps {
  value: string;
  /** Texto exibido (pode ser mascarado, mas `value` é o que será copiado). */
  display?: string;
  className?: string;
  label?: string;
}

export function CopyableText({ value, display, className, label = "Copiar" }: CopyableTextProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast({ title: "Copiado para a área de transferência." });
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast({
        title: "Não foi possível copiar",
        description: "Copie manualmente: " + value,
        variant: "destructive",
      });
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      title={label}
      aria-label={label}
      className={cn(
        "group inline-flex items-center gap-2 rounded-lg text-foreground -mx-1.5 -my-1 px-1.5 py-1 transition-colors",
        "hover:bg-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
        className,
      )}
    >
      <span className="font-medium truncate">{display ?? value}</span>
      <span
        aria-hidden="true"
        className="relative inline-flex h-4 w-4 items-center justify-center text-muted-foreground"
      >
        <AnimatePresence initial={false} mode="wait">
          {copied ? (
            <motion.span
              key="done"
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.6 }}
              transition={{ duration: 0.16 }}
              className="absolute inset-0 flex items-center justify-center text-success"
            >
              <Check className="h-3.5 w-3.5" />
            </motion.span>
          ) : (
            <motion.span
              key="idle"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.16 }}
              className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100"
            >
              <Copy className="h-3.5 w-3.5" />
            </motion.span>
          )}
        </AnimatePresence>
      </span>
    </button>
  );
}
