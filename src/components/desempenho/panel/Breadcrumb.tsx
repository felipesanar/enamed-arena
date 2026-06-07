import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export function Breadcrumb({
  specialty,
  subspecialty,
  onReset,
  onBackToSpecialty,
}: {
  specialty: string | null;
  subspecialty: string | null;
  onReset: () => void;
  onBackToSpecialty: () => void;
}) {
  return (
    <nav
      aria-label="Navegação de drill-down"
      className="flex flex-wrap items-center gap-1.5 text-caption text-muted-foreground"
    >
      <button
        type="button"
        onClick={onReset}
        className="rounded font-medium transition-colors hover:text-foreground focus-visible:outline-none focus-visible:underline"
      >
        Especialidades
      </button>
      {specialty && (
        <>
          <ChevronRight className="h-3 w-3 opacity-40" aria-hidden />
          <button
            type="button"
            onClick={onBackToSpecialty}
            className={cn(
              'rounded font-medium transition-colors hover:text-foreground focus-visible:outline-none focus-visible:underline',
              !subspecialty && 'font-semibold text-foreground',
            )}
          >
            {specialty}
          </button>
        </>
      )}
      {subspecialty && (
        <>
          <ChevronRight className="h-3 w-3 opacity-40" aria-hidden />
          <span className="font-semibold text-foreground">{subspecialty}</span>
        </>
      )}
    </nav>
  );
}
