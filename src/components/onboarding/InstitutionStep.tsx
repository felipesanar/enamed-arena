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
  const [enareExpanded, setEnareExpanded] = useState(() =>
    selected.filter((s) => s !== AINDA_NAO_SEI).length > 0
  );
  const [expandedUfs, setExpandedUfs] = useState<Set<string>>(new Set());

  const isUndecided = selected.includes(AINDA_NAO_SEI);
  const { grouped, flat } = useInstitutionsBySpecialty(selectedSpecialty);
  const isLoading =
    !grouped && selectedSpecialty && selectedSpecialty !== AINDA_NAO_SEI;

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
    if (isUndecided) onToggle(AINDA_NAO_SEI);
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
    <div className="flex flex-col h-full overflow-hidden lg:pt-2">
      {/* Glyph area */}
      <div className="flex flex-col items-center pt-7 pb-0 px-5 shrink-0 lg:hidden">
        <div className="relative mb-4">
          <div
            className="pointer-events-none absolute inset-[-10px] rounded-full onboarding-glyph-glow"
            style={{
              background:
                "radial-gradient(circle, rgba(232,56,98,.12) 0%, transparent 65%)",
            }}
            aria-hidden
          />
          <div
            className="relative w-16 h-16 rounded-[20px] flex items-center justify-center onboarding-glyph-box"
            style={{
              background:
                "linear-gradient(145deg, rgba(232,56,98,.22) 0%, rgba(90,21,48,.42) 100%)",
              border: "1px solid rgba(232,56,98,.32)",
              boxShadow: "0 6px 24px rgba(232,56,98,.22)",
            }}
          >
            <Building2
              className="w-[30px] h-[30px]"
              style={{ color: "#e83862" }}
              strokeWidth={1.75}
            />
          </div>
        </div>
        <h2 className="text-[19px] font-extrabold text-center leading-tight tracking-tight text-white mb-1.5">
          Quais instituições você deseja?
        </h2>
        <p
          className="text-[12.5px] text-center leading-relaxed mb-4"
          style={{ color: "rgba(255,255,255,.65)" }}
        >
          Selecione até {MAX_INSTITUTIONS} instituições do ENARE onde pretende
          prestar residência.
        </p>
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-hidden flex flex-col px-4 pb-2 gap-2.5">
        {/* "Ainda não sei" */}
        <button
          type="button"
          onClick={handleToggleUndecided}
          className="w-full p-3.5 rounded-[13px] text-left flex items-center justify-between shrink-0 transition-all duration-150"
          style={
            isUndecided
              ? {
                  background: "rgba(232,56,98,.12)",
                  border: "1px solid rgba(232,56,98,.38)",
                }
              : {
                  background: "rgba(255,255,255,.025)",
                  border: "1px dashed rgba(255,255,255,.1)",
                }
          }
        >
          <span
            className="text-[12px] italic"
            style={{
              color: isUndecided ? "#e83862" : "rgba(255,255,255,.5)",
              fontWeight: isUndecided ? 600 : 400,
            }}
          >
            {AINDA_NAO_SEI}
          </span>
          {isUndecided && (
            <CheckCircle2 className="h-4 w-4 shrink-0" style={{ color: "#e83862" }} />
          )}
        </button>

        {!isUndecided && (
          <>
            {/* ENARE toggle */}
            <button
              type="button"
              onClick={() => setEnareExpanded(!enareExpanded)}
              className="w-full p-4 rounded-[15px] text-left transition-all duration-200 shrink-0"
              style={{
                border: enareExpanded
                  ? "1.5px solid rgba(232,56,98,.35)"
                  : "1.5px solid rgba(232,56,98,.22)",
                background: enareExpanded
                  ? "rgba(232,56,98,.07)"
                  : "rgba(232,56,98,.04)",
              }}
            >
              <div className="flex items-center justify-between">
                <div>
                  <span
                    className="text-[13.5px] font-bold"
                    style={{ color: "rgba(255,255,255,.9)" }}
                  >
                    ENARE
                  </span>
                  <span
                    className="text-[10.5px] ml-2"
                    style={{ color: "rgba(255,255,255,.55)" }}
                  >
                    {totalInstitutions} inst. · {totalVagas} vagas
                  </span>
                </div>
                {enareExpanded ? (
                  <ChevronUp
                    className="h-5 w-5"
                    style={{ color: "rgba(232,56,98,.7)" }}
                  />
                ) : (
                  <ChevronDown
                    className="h-5 w-5"
                    style={{ color: "rgba(255,255,255,.3)" }}
                  />
                )}
              </div>
              {!enareExpanded && (
                <p
                  className="text-[11px] mt-1"
                  style={{ color: "rgba(255,255,255,.3)" }}
                >
                  Clique para ver as instituições de{" "}
                  <strong style={{ color: "rgba(255,255,255,.45)" }}>
                    {selectedSpecialty}
                  </strong>
                </p>
              )}
            </button>

            {enareExpanded && (
              <>
                {/* Selected chips */}
                {realSelected.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 shrink-0">
                    {realSelected.map((inst) => (
                      <button
                        key={inst}
                        type="button"
                        onClick={() => onToggle(inst)}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-[9px] text-[11px] font-semibold transition-opacity hover:opacity-80"
                        style={{
                          background: "rgba(232,56,98,.12)",
                          border: "1px solid rgba(232,56,98,.25)",
                          color: "#e83862",
                        }}
                      >
                        {inst}
                        <X className="h-3 w-3" />
                      </button>
                    ))}
                  </div>
                )}

                {/* Search + counter */}
                <div className="flex items-center gap-2.5 shrink-0">
                  <div className="relative flex-1">
                    <Search
                      className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4"
                      style={{ color: "rgba(255,255,255,.3)" }}
                    />
                    <input
                      type="text"
                      placeholder="Buscar instituição..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="w-full h-[42px] pl-10 pr-4 rounded-[13px] text-[12.5px] focus:outline-none focus:ring-2 focus:ring-[#e83862]/35 transition-all"
                      style={{
                        background: "rgba(255,255,255,.05)",
                        border: "1px solid rgba(255,255,255,.09)",
                        color: "rgba(255,255,255,.85)",
                      }}
                    />
                    {search && (
                      <button
                        onClick={() => setSearch("")}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2"
                        style={{ color: "rgba(255,255,255,.3)" }}
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                  <div
                    className="text-[11px] font-semibold px-3 py-2 rounded-[10px] shrink-0 tabular-nums"
                    style={
                      realSelected.length > 0
                        ? {
                            background: "rgba(74,222,128,.1)",
                            color: "rgba(74,222,128,.9)",
                          }
                        : {
                            background: "rgba(251,191,36,.1)",
                            color: "rgba(251,191,36,.8)",
                          }
                    }
                  >
                    {realSelected.length}/{MAX_INSTITUTIONS}
                  </div>
                </div>

                {/* UF groups */}
                <div className="flex-1 min-h-0">
                  {isLoading ? (
                    <div className="flex h-full flex-col gap-2 overflow-y-auto pr-0.5">
                      {Array.from({ length: 4 }).map((_, i) => (
                        <div
                          key={i}
                          className="h-10 rounded-[13px] animate-pulse"
                          style={{ background: "rgba(255,255,255,.05)" }}
                        />
                      ))}
                    </div>
                  ) : filteredGrouped &&
                    Object.keys(filteredGrouped).length > 0 ? (
                    <div className="h-full overflow-y-auto flex flex-col gap-1.5 pr-0.5">
                      {Object.entries(filteredGrouped).map(([uf, insts]) => {
                        const isExpanded =
                          expandedUfs.has(uf) || !!search.trim();
                        const ufVagas = insts.reduce(
                          (s, i) => s + i.vagas,
                          0
                        );
                        return (
                          <div
                            key={uf}
                            className="rounded-[13px] overflow-hidden"
                            style={{ border: "1px solid rgba(255,255,255,.06)" }}
                          >
                            <button
                              type="button"
                              onClick={() => toggleUf(uf)}
                              className="w-full flex items-center justify-between p-3 transition-colors"
                              style={{ background: "rgba(255,255,255,.03)" }}
                            >
                              <div className="flex items-center gap-2">
                                <MapPin
                                  className="h-3.5 w-3.5"
                                  style={{ color: "rgba(255,255,255,.3)" }}
                                />
                                <span
                                  className="text-[11.5px] font-bold"
                                   style={{ color: "rgba(255,255,255,.82)" }}
                                >
                                  {uf}
                                </span>
                                <span
                                  className="text-[10px]"
                                  style={{ color: "rgba(255,255,255,.5)" }}
                                >
                                  {insts.length} inst. · {ufVagas} vagas
                                </span>
                              </div>
                              {isExpanded ? (
                                <ChevronUp
                                  className="h-4 w-4"
                                  style={{ color: "rgba(255,255,255,.28)" }}
                                />
                              ) : (
                                <ChevronDown
                                  className="h-4 w-4"
                                  style={{ color: "rgba(255,255,255,.28)" }}
                                />
                              )}
                            </button>
                            {isExpanded && (
                              <div className="p-1.5 flex flex-col gap-0.5">
                                {insts.map((inst) => {
                                  const isSelected = realSelected.includes(
                                    inst.name
                                  );
                                  const isMaxReached =
                                    !isSelected &&
                                    realSelected.length >= MAX_INSTITUTIONS;
                                  return (
                                    <button
                                      key={inst.id}
                                      type="button"
                                      onClick={() =>
                                        handleToggleInstitution(inst.name)
                                      }
                                      disabled={isMaxReached}
                                      className="w-full flex items-center justify-between p-2.5 rounded-[10px] transition-all text-left disabled:cursor-not-allowed"
                                      style={
                                        isSelected
                                          ? {
                                              background:
                                                "rgba(232,56,98,.07)",
                                              border:
                                                "1px solid rgba(232,56,98,.1)",
                                            }
                                          : isMaxReached
                                          ? { opacity: 0.35 }
                                          : {}
                                      }
                                    >
                                      <div className="flex-1 min-w-0">
                                        <p
                                          className="text-[11.5px] truncate"
                                          style={{
                                            color: isSelected
                                              ? "#e83862"
                                              : "rgba(255,255,255,.82)",
                                            fontWeight: isSelected ? 600 : 400,
                                          }}
                                        >
                                          {inst.name}
                                        </p>
                                        <p
                                          className="text-[10px]"
                                          style={{
                                            color: "rgba(255,255,255,.5)",
                                          }}
                                        >
                                          {inst.vagas} vaga
                                          {inst.vagas !== 1 ? "s" : ""}
                                          {inst.cenario_pratica &&
                                            ` · ${inst.cenario_pratica}`}
                                        </p>
                                      </div>
                                      {isSelected && (
                                        <CheckCircle2
                                          className="h-4 w-4 shrink-0 ml-2"
                                          style={{ color: "#e83862" }}
                                        />
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
                    <p
                      className="text-center text-[12px] py-8"
                      style={{ color: "rgba(255,255,255,.55)" }}
                    >
                      {search
                        ? `Nenhuma instituição encontrada para "${search}"`
                        : "Nenhuma instituição oferta esta especialidade no ENARE."}
                    </p>
                  )}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
