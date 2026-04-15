import { Chip } from "../ui/Chip";
import { ERROR_TYPES, type ErrorTypeKey } from "../errorTypes";

const TYPE_FILTERS: Array<{ key: ErrorTypeKey | "all"; label: string; dotColor?: string }> = [
  { key: "all", label: "Todos" },
  { key: "lacuna", label: "Lacuna", dotColor: "#f43f5e" },
  { key: "memoria", label: "Memória", dotColor: "#8b5cf6" },
  { key: "diferencial", label: "Diferencial", dotColor: "#3b82f6" },
  { key: "atencao", label: "Atenção", dotColor: "#f59e0b" },
  { key: "guessed_correctly", label: "Chute", dotColor: "#eab308" },
];

interface FilterBarProps {
  activeType: ErrorTypeKey | "all";
  activeSpec: string | null;
  typeCounts: Partial<Record<ErrorTypeKey | "all", number>>;
  specialties: string[];
  onTypeChange: (t: ErrorTypeKey | "all") => void;
  onSpecChange: (s: string | null) => void;
}

export function FilterBar({
  activeType,
  activeSpec,
  typeCounts,
  specialties,
  onTypeChange,
  onSpecChange,
}: FilterBarProps) {
  return (
    <div
      className="caderno-sandbox"
      style={{
        background: "var(--surface)",
        borderBottom: "1px solid var(--border)",
        padding: "12px 24px",
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      {/* Type filter */}
      <div
        role="radiogroup"
        aria-label="Filtrar por tipo de erro"
        style={{ display: "flex", gap: 6, overflowX: "auto", msOverflowStyle: "none", scrollbarWidth: "none" } as React.CSSProperties}
      >
        {TYPE_FILTERS.map(({ key, label, dotColor }) => (
          <Chip
            key={key}
            label={label}
            count={typeCounts[key]}
            active={activeType === key}
            dotColor={dotColor}
            onClick={() => onTypeChange(key)}
          />
        ))}
      </div>

      {/* Specialty filter */}
      {specialties.length > 1 && (
        <div
          role="radiogroup"
          aria-label="Filtrar por especialidade"
          style={{ display: "flex", gap: 6, overflowX: "auto", msOverflowStyle: "none", scrollbarWidth: "none" } as React.CSSProperties}
        >
          <Chip
            label="Todas"
            active={activeSpec === null}
            onClick={() => onSpecChange(null)}
          />
          {specialties.map((spec) => (
            <Chip
              key={spec}
              label={spec}
              active={activeSpec === spec}
              onClick={() => onSpecChange(spec)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
