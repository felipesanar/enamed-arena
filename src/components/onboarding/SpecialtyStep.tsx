import { useState, useMemo } from "react";
import { Search, X, CheckCircle2, ChevronRight, GraduationCap } from "lucide-react";
import { useEnamedSpecialties } from "@/hooks/useEnamedData";

const AINDA_NAO_SEI = "Ainda não sei";

interface Props {
  specialty: string;
  onSelect: (s: string) => void;
}

export function SpecialtyStep({ specialty, onSelect }: Props) {
  const [search, setSearch] = useState("");
  const { data: specialties, isLoading, isError } = useEnamedSpecialties();

  const allOptions = useMemo(
    () => [AINDA_NAO_SEI, ...(specialties?.map((s) => s.name) ?? [])],
    [specialties]
  );

  const filtered = useMemo(() => {
    if (!search.trim()) return allOptions;
    return allOptions.filter((s) =>
      s.toLowerCase().includes(search.toLowerCase())
    );
  }, [search, allOptions]);

  if (isError) {
    return (
      <div className="text-center py-12">
        <p className="text-body text-destructive">Erro ao carregar especialidades.</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-3 text-body-sm text-primary underline"
        >
          Tentar novamente
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="text-center mb-8">
        <div className="h-14 w-14 rounded-2xl bg-accent flex items-center justify-center mx-auto mb-4">
          <GraduationCap className="h-7 w-7 text-primary" />
        </div>
        <h2 className="text-heading-2 text-foreground mb-2">
          Qual sua especialidade desejada?
        </h2>
        <p className="text-body text-muted-foreground max-w-md mx-auto">
          Usaremos essa informação para comparar seu desempenho com candidatos
          da mesma área.
        </p>
      </div>

      <div className="max-w-lg mx-auto">
        <div className="relative mb-4">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Buscar especialidade..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-11 pl-10 pr-4 rounded-xl border border-border bg-card text-body text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-primary transition-all"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="h-12 rounded-xl bg-muted animate-pulse"
              />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-[360px] overflow-y-auto pr-1">
            {filtered.map((spec) => {
              const isSelected = specialty === spec;
              const isUndecided = spec === AINDA_NAO_SEI;
              return (
                <button
                  key={spec}
                  onClick={() => onSelect(spec)}
                  className={`flex items-center justify-between p-3.5 rounded-xl border transition-all duration-150 text-left group ${
                    isUndecided ? "sm:col-span-2" : ""
                  } ${
                    isSelected
                      ? "border-primary bg-accent"
                      : isUndecided
                      ? "border-dashed border-border bg-muted/30 hover:border-primary/30 hover:bg-accent/30"
                      : "border-border bg-card hover:border-primary/30 hover:bg-accent/30"
                  }`}
                >
                  <span
                    className={`text-body transition-colors ${
                      isSelected
                        ? "text-primary font-medium"
                        : isUndecided
                        ? "text-muted-foreground italic"
                        : "text-foreground"
                    }`}
                  >
                    {spec}
                  </span>
                  {isSelected ? (
                    <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                  )}
                </button>
              );
            })}
            {filtered.length === 0 && (
              <p className="col-span-2 text-center text-body-sm text-muted-foreground py-8">
                Nenhuma especialidade encontrada para "{search}"
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
