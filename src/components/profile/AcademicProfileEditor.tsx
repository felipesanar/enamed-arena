import { useState, useMemo, useCallback } from "react";
import { GraduationCap, Building2, Save, X, Search, Check } from "lucide-react";
import { useEnamedSpecialties, useInstitutionsBySpecialty } from "@/hooks/useEnamedData";
import { cn } from "@/lib/utils";

const AINDA_NAO_SEI = "Ainda não sei";
const MAX_INSTITUTIONS = 3;

interface AcademicProfileEditorProps {
  initialSpecialty: string;
  initialInstitutions: string[];
  onSave: (data: { specialty: string; targetInstitutions: string[] }) => Promise<void>;
  onCancel: () => void;
  saving?: boolean;
}

export function AcademicProfileEditor({
  initialSpecialty,
  initialInstitutions,
  onSave,
  onCancel,
  saving = false,
}: AcademicProfileEditorProps) {
  const [specialty, setSpecialty] = useState(initialSpecialty);
  const [institutions, setInstitutions] = useState<string[]>(initialInstitutions);
  const [specSearch, setSpecSearch] = useState("");
  const [instSearch, setInstSearch] = useState("");

  const { data: specialties, isLoading: specLoading } = useEnamedSpecialties();
  const { grouped: instGrouped, flat: instFlat } = useInstitutionsBySpecialty(specialty);

  const specOptions = useMemo(
    () => {
      const all = [AINDA_NAO_SEI, ...(specialties?.map(s => s.name) ?? [])];
      if (!specSearch.trim()) return all;
      const q = specSearch.toLowerCase();
      return all.filter(s => s.toLowerCase().includes(q));
    },
    [specialties, specSearch]
  );

  const groupedInstitutions = useMemo(() => {
    if (!instGrouped) return [];
    const q = instSearch.toLowerCase();
    const entries = Object.entries(instGrouped);
    if (!instSearch.trim()) return entries;
    return entries
      .map(([uf, insts]) => {
        const filtered = insts.filter(
          (i: any) => i.name.toLowerCase().includes(q) || uf.toLowerCase().includes(q)
        );
        return filtered.length ? [uf, filtered] as const : null;
      })
      .filter(Boolean) as [string, any[]][];
  }, [instGrouped, instSearch]);

  const toggleInstitution = useCallback((name: string) => {
    setInstitutions(prev => {
      if (name === AINDA_NAO_SEI) return [AINDA_NAO_SEI];
      const without = prev.filter(i => i !== AINDA_NAO_SEI);
      if (without.includes(name)) return without.filter(i => i !== name);
      if (without.length >= MAX_INSTITUTIONS) return without;
      return [...without, name];
    });
  }, []);

  const handleSave = async () => {
    if (!specialty || institutions.length === 0) return;
    await onSave({ specialty, targetInstitutions: institutions });
  };

  const hasChanges = specialty !== initialSpecialty ||
    JSON.stringify([...institutions].sort()) !== JSON.stringify([...initialInstitutions].sort());

  return (
    <div className="space-y-5">
      {/* Specialty picker */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <div className="h-7 w-7 rounded-lg bg-accent flex items-center justify-center">
            <GraduationCap className="h-3.5 w-3.5 text-primary" />
          </div>
          <p className="text-body-sm font-semibold text-foreground">Especialidade</p>
        </div>
        <div className="relative mb-2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="text"
            value={specSearch}
            onChange={e => setSpecSearch(e.target.value)}
            placeholder="Buscar especialidade..."
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-border bg-background text-body-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
          {specSearch && (
            <button onClick={() => setSpecSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2">
              <X className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          )}
        </div>
        <div className="max-h-40 overflow-y-auto rounded-lg border border-border bg-background">
          {specLoading ? (
            <div className="p-3 text-caption text-muted-foreground">Carregando...</div>
          ) : specOptions.length === 0 ? (
            <div className="p-3 text-caption text-muted-foreground">Nenhuma especialidade encontrada.</div>
          ) : (
            specOptions.map(opt => (
              <button
                key={opt}
                onClick={() => {
                  setSpecialty(opt);
                  // Reset institutions when specialty changes (different programs)
                  if (opt !== specialty) setInstitutions([]);
                }}
                className={cn(
                  "w-full text-left px-3 py-2 text-body-sm flex items-center justify-between transition-colors",
                  specialty === opt
                    ? "bg-primary/10 text-primary font-semibold"
                    : "text-foreground hover:bg-muted"
                )}
              >
                {opt}
                {specialty === opt && <Check className="h-3.5 w-3.5 text-primary" />}
              </button>
            ))
          )}
        </div>
      </div>

      {/* Institutions picker */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-accent flex items-center justify-center">
              <Building2 className="h-3.5 w-3.5 text-primary" />
            </div>
            <p className="text-body-sm font-semibold text-foreground">Instituições</p>
          </div>
          <span className="text-caption text-muted-foreground">{institutions.filter(i => i !== AINDA_NAO_SEI).length}/{MAX_INSTITUTIONS}</span>
        </div>

        {/* "Ainda não sei" toggle */}
        <button
          onClick={() => toggleInstitution(AINDA_NAO_SEI)}
          className={cn(
            "w-full mb-2 px-3 py-2 rounded-lg border text-body-sm font-medium flex items-center justify-between transition-colors",
            institutions.includes(AINDA_NAO_SEI)
              ? "bg-primary/10 border-primary/30 text-primary"
              : "border-border text-muted-foreground hover:bg-muted"
          )}
        >
          {AINDA_NAO_SEI}
          {institutions.includes(AINDA_NAO_SEI) && <Check className="h-3.5 w-3.5" />}
        </button>

        {!institutions.includes(AINDA_NAO_SEI) && specialty && specialty !== AINDA_NAO_SEI && (
          <>
            <div className="relative mb-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <input
                type="text"
                value={instSearch}
                onChange={e => setInstSearch(e.target.value)}
                placeholder="Buscar instituição..."
                className="w-full pl-9 pr-3 py-2 rounded-lg border border-border bg-background text-body-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
              {instSearch && (
                <button onClick={() => setInstSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2">
                  <X className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
              )}
            </div>
            <div className="max-h-48 overflow-y-auto rounded-lg border border-border bg-background">
              {!instGrouped ? (
                <div className="p-3 text-caption text-muted-foreground">Carregando...</div>
              ) : groupedInstitutions.length === 0 ? (
                <div className="p-3 text-caption text-muted-foreground">Nenhuma instituição encontrada.</div>
              ) : (
                groupedInstitutions.map(([uf, insts]) => (
                  <div key={uf}>
                    <div className="px-3 py-1.5 text-micro-label text-muted-foreground bg-muted/50 font-semibold uppercase tracking-wider sticky top-0">
                      {uf}
                    </div>
                    {insts.map(inst => {
                      const selected = institutions.includes(inst.name);
                      const disabled = !selected && institutions.length >= MAX_INSTITUTIONS;
                      return (
                        <button
                          key={inst.name}
                          onClick={() => toggleInstitution(inst.name)}
                          disabled={disabled}
                          className={cn(
                            "w-full text-left px-3 py-2 text-body-sm flex items-center justify-between transition-colors",
                            selected
                              ? "bg-primary/10 text-primary font-semibold"
                              : disabled
                              ? "text-muted-foreground/40 cursor-not-allowed"
                              : "text-foreground hover:bg-muted"
                          )}
                        >
                          <span>
                            {inst.name}
                            {inst.vagas > 0 && (
                              <span className="ml-1.5 text-caption text-muted-foreground">
                                ({inst.vagas} vaga{inst.vagas !== 1 ? 's' : ''})
                              </span>
                            )}
                          </span>
                          {selected && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                ))
              )}
            </div>
          </>
        )}

        {/* Selected tags */}
        {institutions.length > 0 && !institutions.includes(AINDA_NAO_SEI) && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {institutions.map(inst => (
              <span
                key={inst}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-primary/10 text-primary text-caption font-medium"
              >
                {inst}
                <button onClick={() => toggleInstitution(inst)} className="hover:text-destructive">
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-2 pt-2">
        <button
          onClick={onCancel}
          disabled={saving}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-border text-body-sm font-medium text-muted-foreground hover:bg-muted transition-colors disabled:opacity-40"
        >
          <X className="h-3.5 w-3.5" />
          Cancelar
        </button>
        <button
          onClick={handleSave}
          disabled={saving || !specialty || institutions.length === 0 || !hasChanges}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-white text-body-sm font-semibold hover:bg-wine-hover transition-colors disabled:opacity-40"
        >
          <Save className="h-3.5 w-3.5" />
          {saving ? 'Salvando...' : 'Salvar'}
        </button>
      </div>
    </div>
  );
}
