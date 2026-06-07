import { cn } from '@/lib/utils';

export function SimuladoTabs({
  simulados,
  selectedId,
  onSelect,
}: {
  simulados: Array<{ id: string; title: string }>;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="Escolher simulado"
      className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-none [scrollbar-width:none] [-ms-overflow-style:none]"
    >
      {simulados.map((s) => {
        const active = s.id === selectedId;
        return (
          <button
            key={s.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onSelect(s.id)}
            title={s.title}
            className={cn(
              'shrink-0 rounded-full border px-3.5 py-1.5 text-[12px] font-semibold transition-all duration-150',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
              active
                ? 'border-primary bg-primary text-primary-foreground shadow-[0_2px_8px_-2px_hsl(345_65%_30%/0.3)]'
                : 'border-border bg-card text-muted-foreground hover:border-primary/30 hover:text-foreground',
            )}
          >
            {s.title.length > 32 ? `${s.title.slice(0, 32)}…` : s.title}
          </button>
        );
      })}
    </div>
  );
}
