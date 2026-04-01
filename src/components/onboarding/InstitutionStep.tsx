import { useState, useMemo } from "react";
import {
  Search,
  X,
  CheckCircle2,
  Building2,
  MapPin,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useInstitutionsBySpecialty } from "@/hooks/useEnamedData";

const AINDA_NAO_SEI = "Ainda não sei";
const MAX_INSTITUTIONS = 3;

interface Props {
  selected: string[];
  onToggle: (inst: string) => void;
  selectedSpecialty: string;
}

export function InstitutionStep({ selected, onToggle, selectedSpecialty }: Props) {
  const [search, setSearch] = useState("");
  const [enareExpanded, setEnareExpanded] = useState(false);
  const [expandedUfs, setExpandedUfs] = useState<Set<string>>(new Set());

  const isUndecided = selected.includes(AINDA_NAO_SEI);
  const { grouped, flat } = useInstitutionsBySpecialty(selectedSpecialty);
  const isLoading = !grouped && selectedSpecialty && selectedSpecialty !== AINDA_NAO_SEI;

  const filteredGrouped = useMemo(() => {
    if (!grouped) return null;
    if (!search.trim()) return grouped;
    const result: Record<string, typeof flat> = {};
    for (const [uf, insts] of Object.entries(grouped)) {
      const matches = insts.filter(
        (i) =>
          i.name.toLowerCase().includes(search.toLowerCase()) ||
          i.uf.toLowerCase().includes(search.toLowerCase())
      );
      if (matches.length > 0) result[uf] = matches;
    }
    return result;
  }, [grouped, search]);

  const totalVagas = useMemo(() => {
    if (!flat) return 0;
    return flat.reduce((sum, i) => sum + i.vagas, 0);
  }, [flat]);

  const totalInstitutions = flat?.length ?? 0;

  const handleToggleUndecided = () => {
    if (isUndecided) {
      onToggle(AINDA_NAO_SEI);
    } else {
      selected.forEach((inst) => onToggle(inst));
      onToggle(AINDA_NAO_SEI);
    }
  };

  const handleToggleInstitution = (instName: string) => {
    if (isUndecided) {
      onToggle(AINDA_NAO_SEI);
    }
    const realSelected = selected.filter((s) => s !== AINDA_NAO_SEI);
    const alreadySelected = realSelected.includes(instName);
    if (!alreadySelected && realSelected.length >= MAX_INSTITUTIONS) return;
    onToggle(instName);
  };

  const toggleUf = (uf: string) => {
    setExpandedUfs((prev) => {
      const next = new Set(prev);
      if (next.has(uf)) next.delete(uf);
      else next.add(uf);
      return next;
    });
  };

  const realSelected = selected.filter((s) => s !== AINDA_NAO_SEI);

  return (
    <div>
      <div className="text-center mb-8">
        <div className="h-14 w-14 rounded-2xl bg-accent flex items-center justify-center mx-auto mb-4">
          <Building2 className="h-7 w-7 text-primary" />
        </div>
        <h2 className="text-heading-2 text-foreground mb-2">
          Quais instituições você deseja?
        </h2>
        <p className="text-body text-muted-foreground max-w-md mx-auto">
          Selecione até {MAX_INSTITUTIONS} instituições do ENARE onde pretende
          prestar residência.
        </p>
      </div>

      <div className="max-w-lg mx-auto">
        {/* "Ainda não sei" option */}
        <button
          onClick={handleToggleUndecided}
          className={`w-full mb-4 p-3.5 rounded-xl border transition-all duration-150 text-left flex items-center justify-between ${
            isUndecided
              ? "border-primary bg-accent"
              : "border-dashed border-border bg-muted/30 hover:border-primary/30 hover:bg-accent/30"
          }`}
        >
          <span
            className={`text-body transition-colors ${
              isUndecided
                ? "text-primary font-medium"
                : "text-muted-foreground italic"
            }`}
          >
            {AINDA_NAO_SEI}
          </span>
          {isUndecided && (
            <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
          )}
        </button>

        {!isUndecided && (
          <>
            {/* ENARE toggle */}
            <button
              onClick={() => setEnareExpanded(!enareExpanded)}
              className={`w-full mb-4 p-4 rounded-xl border-2 transition-all duration-200 text-left ${
                enareExpanded
                  ? "border-primary bg-accent/50"
                  : "border-primary/30 bg-card hover:border-primary/50"
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-body font-semibold text-foreground">
                    ENARE
                  </span>
                  <span className="text-caption text-muted-foreground ml-2">
                    {totalInstitutions} instituições · {totalVagas} vagas
                  </span>
                </div>
                {enareExpanded ? (
                  <ChevronUp className="h-5 w-5 text-primary" />
                ) : (
                  <ChevronDown className="h-5 w-5 text-muted-foreground" />
                )}
              </div>
              {!enareExpanded && (
                <p className="text-caption text-muted-foreground mt-1">
                  Clique para ver as instituições que ofertam{" "}
                  <strong className="text-foreground">{selectedSpecialty}</strong>
                </p>
              )}
            </button>

            {enareExpanded && (
              <>
                {/* Selected chips */}
                {realSelected.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-4">
                    {realSelected.map((inst) => (
                      <button
                        key={inst}
                        onClick={() => onToggle(inst)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-body-sm font-medium hover:bg-primary/20 transition-colors"
                      >
                        {inst}
                        <X className="h-3 w-3" />
                      </button>
                    ))}
                  </div>
                )}

                {/* Search + counter */}
                <div className="flex items-center gap-3 mb-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <input
                      type="text"
                      placeholder="Buscar instituição..."
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
                  <div
                    className={`text-caption font-semibold px-3 py-2 rounded-lg shrink-0 ${
                      realSelected.length > 0
                        ? "bg-success/10 text-success"
                        : "bg-warning/10 text-warning"
                    }`}
                  >
                    {realSelected.length}/{MAX_INSTITUTIONS}
                  </div>
                </div>

                {/* Institutions grouped by UF */}
                {isLoading ? (
                  <div className="space-y-3">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <div
                        key={i}
                        className="h-10 rounded-xl bg-muted animate-pulse"
                      />
                    ))}
                  </div>
                ) : filteredGrouped && Object.keys(filteredGrouped).length > 0 ? (
                  <div className="max-h-[320px] overflow-y-auto pr-1 space-y-2">
                    {Object.entries(filteredGrouped).map(([uf, insts]) => {
                      const isExpanded = expandedUfs.has(uf) || !!search.trim();
                      const ufVagas = insts.reduce((s, i) => s + i.vagas, 0);
                      return (
                        <div key={uf} className="border border-border rounded-xl overflow-hidden">
                          <button
                            onClick={() => toggleUf(uf)}
                            className="w-full flex items-center justify-between p-3 bg-muted/30 hover:bg-muted/50 transition-colors"
                          >
                            <div className="flex items-center gap-2">
                              <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                              <span className="text-body-sm font-semibold text-foreground">
                                {uf}
                              </span>
                              <span className="text-caption text-muted-foreground">
                                {insts.length} inst. · {ufVagas} vagas
                              </span>
                            </div>
                            {isExpanded ? (
                              <ChevronUp className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <ChevronDown className="h-4 w-4 text-muted-foreground" />
                            )}
                          </button>
                          {isExpanded && (
                            <div className="p-2 space-y-1">
                              {insts.map((inst) => {
                                const isSelected = realSelected.includes(inst.name);
                                const isMaxReached =
                                  !isSelected && realSelected.length >= MAX_INSTITUTIONS;
                                return (
                                  <button
                                    key={inst.id}
                                    onClick={() => handleToggleInstitution(inst.name)}
                                    disabled={isMaxReached}
                                    className={`w-full flex items-center justify-between p-2.5 rounded-lg transition-all text-left ${
                                      isSelected
                                        ? "bg-accent border border-primary text-primary"
                                        : isMaxReached
                                        ? "bg-muted/30 text-muted-foreground/50 cursor-not-allowed"
                                        : "hover:bg-accent/30 text-foreground"
                                    }`}
                                  >
                                    <div className="flex-1 min-w-0">
                                      <p
                                        className={`text-body-sm truncate ${
                                          isSelected ? "font-medium" : ""
                                        }`}
                                      >
                                        {inst.name}
                                      </p>
                                      <p className="text-micro-label text-muted-foreground">
                                        {inst.vagas} vaga{inst.vagas !== 1 ? "s" : ""}
                                        {inst.cenario_pratica &&
                                          ` · ${inst.cenario_pratica}`}
                                      </p>
                                    </div>
                                    {isSelected && (
                                      <CheckCircle2 className="h-4 w-4 text-primary shrink-0 ml-2" />
                                    )}
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-center text-body-sm text-muted-foreground py-8">
                    {search
                      ? `Nenhuma instituição encontrada para "${search}"`
                      : "Nenhuma instituição oferta esta especialidade no ENARE."}
                  </p>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
