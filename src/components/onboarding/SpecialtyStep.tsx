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
      <div className="flex flex-col items-center justify-center py-12 px-5">
        <p className="text-[13px]" style={{ color: "rgba(255,255,255,.5)" }}>
          Erro ao carregar especialidades.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="mt-3 text-[12px] underline"
          style={{ color: "#e83862" }}
        >
          Tentar novamente
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Glyph area */}
      <div className="flex flex-col items-center pt-7 pb-0 px-5 shrink-0">
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
            <GraduationCap
              className="w-[30px] h-[30px]"
              style={{ color: "#e83862" }}
              strokeWidth={1.75}
            />
          </div>
        </div>
        <h2 className="text-[19px] font-extrabold text-center leading-tight tracking-tight text-white mb-1.5">
          Qual sua especialidade desejada?
        </h2>
        <p
          className="text-[12.5px] text-center leading-relaxed mb-5"
          style={{ color: "rgba(255,255,255,.45)" }}
        >
          Usaremos essa informação para comparar seu desempenho com candidatos
          da mesma área.
        </p>
      </div>

      {/* Search + chips */}
      <div className="flex-1 overflow-hidden flex flex-col px-4 pb-2">
        {/* Search input */}
        <div className="relative mb-3 shrink-0">
          <Search
            className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4"
            style={{ color: "rgba(255,255,255,.3)" }}
          />
          <input
            type="text"
            placeholder="Buscar especialidade..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-[42px] pl-10 pr-10 rounded-[13px] text-[12.5px] focus:outline-none focus:ring-2 focus:ring-[#e83862]/35 transition-all"
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

        {/* Chips grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="h-11 rounded-[13px] animate-pulse"
                style={{ background: "rgba(255,255,255,.06)" }}
              />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 overflow-y-auto pr-0.5">
            {filtered.map((spec) => {
              const isSelected = specialty === spec;
              const isUndecided = spec === AINDA_NAO_SEI;
              return (
                <button
                  key={spec}
                  type="button"
                  onClick={() => onSelect(spec)}
                  className={`flex items-center justify-between p-3.5 rounded-[13px] transition-all duration-150 text-left group${
                    isUndecided ? " sm:col-span-2" : ""
                  }`}
                  style={
                    isSelected
                      ? {
                          background: "rgba(232,56,98,.12)",
                          border: "1px solid rgba(232,56,98,.38)",
                        }
                      : isUndecided
                      ? {
                          background: "rgba(255,255,255,.025)",
                          border: "1px dashed rgba(255,255,255,.1)",
                        }
                      : {
                          background: "rgba(255,255,255,.035)",
                          border: "1px solid rgba(255,255,255,.07)",
                        }
                  }
                >
                  <span
                    className={`text-[12px] transition-colors${
                      isUndecided ? " italic" : ""
                    }`}
                    style={{
                      color: isSelected
                        ? "#e83862"
                        : isUndecided
                        ? "rgba(255,255,255,.3)"
                        : "rgba(255,255,255,.6)",
                      fontWeight: isSelected ? 600 : 400,
                    }}
                  >
                    {spec}
                  </span>
                  {isSelected ? (
                    <CheckCircle2
                      className="h-4 w-4 shrink-0"
                      style={{ color: "#e83862" }}
                    />
                  ) : (
                    <ChevronRight
                      className="h-4 w-4 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                      style={{ color: "rgba(255,255,255,.3)" }}
                    />
                  )}
                </button>
              );
            })}
            {filtered.length === 0 && (
              <p
                className="col-span-2 text-center text-[12px] py-8"
                style={{ color: "rgba(255,255,255,.35)" }}
              >
                Nenhuma especialidade encontrada para &quot;{search}&quot;
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
