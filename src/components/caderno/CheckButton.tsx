import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

/* ──────────────────────────────────────────────────────────────────────────
 * CheckButton — pequeno, acessível, usando tokens do sistema
 * ────────────────────────────────────────────────────────────────────────── */

export function CheckButton({
  done,
  onToggle,
  label,
}: {
  done: boolean;
  onToggle: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={label}
      aria-pressed={done}
      className={cn(
        'group/check inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px] border transition-all duration-150',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        done
          ? 'border-success/40 bg-success/15 text-success'
          : 'border-border bg-muted/50 text-muted-foreground hover:border-success/40 hover:bg-success/10 hover:text-success',
      )}
    >
      <Check className="h-3.5 w-3.5" strokeWidth={2.75} aria-hidden />
    </button>
  );
}
