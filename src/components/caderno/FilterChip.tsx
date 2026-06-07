import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export function FilterChip({
  label,
  count,
  active,
  dotColor,
  activeColors,
  variant = 'default',
  onClick,
}: {
  label: string;
  count?: number;
  active: boolean;
  dotColor?: string;
  activeColors?: { bg: string; text: string; border: string };
  variant?: 'default' | 'subtle';
  onClick: () => void;
}) {
  const isDefault = variant === 'default';

  // Active default: usa cor do tipo quando fornecida, senão wine primary
  const activeStyle =
    active && isDefault && activeColors
      ? {
          background: activeColors.bg,
          color: activeColors.text,
          borderColor: activeColors.border,
        }
      : undefined;

  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onClick}
      style={activeStyle}
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1.5 text-[12px] font-semibold transition-all duration-150',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        // Active states
        active && isDefault && !activeColors && 'border-primary bg-primary text-primary-foreground shadow-[0_2px_8px_-2px_hsl(345_65%_30%/0.3)]',
        active && !isDefault && 'border-primary/30 bg-primary/10 text-primary',
        // Inactive
        !active && 'border-border bg-card text-muted-foreground hover:border-primary/30 hover:text-foreground',
      )}
    >
      {active ? (
        <Check className="h-3 w-3" strokeWidth={3} aria-hidden />
      ) : (
        dotColor && (
          <span
            aria-hidden
            className="h-1.5 w-1.5 rounded-full"
            style={{ background: dotColor }}
          />
        )
      )}
      {label}
      {typeof count === 'number' && (
        <span
          className={cn(
            'text-[10px] font-bold tabular-nums',
            active ? 'opacity-80' : 'opacity-60',
          )}
        >
          {count}
        </span>
      )}
    </button>
  );
}
