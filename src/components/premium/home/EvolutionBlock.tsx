import { Trophy, TrendingUp, ArrowRight, Target } from "lucide-react";
import { Link } from "react-router-dom";

interface EvolutionBlockProps {
  rankPosition: number | null;
  rankTotal: number | null;
  rankScore: number | null;
  simuladosRealizados: number;
  mediaAtual: number;
  bestScore: number | null;
}

export function EvolutionBlock({
  rankPosition,
  rankTotal,
  rankScore,
  simuladosRealizados,
  mediaAtual,
  bestScore,
}: EvolutionBlockProps) {
  const hasRanking = rankPosition !== null;

  return (
    <section
      className="grid grid-cols-1 md:grid-cols-12 gap-4 lg:gap-5"
      aria-label="Evolução e performance"
    >
      {/* Ranking card — premium dark treatment */}
      <div className="md:col-span-7">
        <div className="relative overflow-hidden rounded-[22px] border border-white/[0.07] bg-[linear-gradient(148deg,#180A10_0%,#2A0F1B_46%,#1A0D14_100%)] p-6 md:p-7 shadow-[0_20px_40px_-24px_rgba(30,10,18,0.85),0_6px_16px_-10px_rgba(50,14,28,0.4)] min-h-[180px]">
          <div className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-[rgba(200,40,76,0.14)] blur-[50px]" />
          <div className="pointer-events-none absolute -left-16 -bottom-12 h-48 w-48 rounded-full bg-[rgba(10,14,24,0.5)] blur-[40px]" />

          <div className="relative z-10">
            <div className="flex items-center gap-2.5 mb-5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/[0.08] border border-white/[0.06]">
                <Trophy className="h-4 w-4 text-[#E83862]" aria-hidden />
              </div>
              <div>
                <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-white/40">
                  Enamed Ranking
                </p>
                {hasRanking && (
                  <p className="text-[10px] font-medium text-[#E83862]/80">
                    Classificado
                  </p>
                )}
              </div>
            </div>

            {hasRanking ? (
              <div className="flex items-end gap-6 mb-4">
                <div>
                  <p className="text-[9px] uppercase tracking-[0.12em] text-white/35 mb-1">
                    Posição
                  </p>
                  <p className="text-[42px] font-extrabold leading-none tracking-[-0.04em] text-white tabular-nums">
                    #{rankPosition}
                  </p>
                </div>
                {rankTotal !== null && (
                  <div className="pb-1.5">
                    <p className="text-[9px] uppercase tracking-[0.12em] text-white/35 mb-1">
                      Total
                    </p>
                    <p className="text-[20px] font-bold leading-none text-white/60 tabular-nums">
                      {rankTotal}
                    </p>
                  </div>
                )}
                {rankScore !== null && (
                  <div className="pb-1.5">
                    <p className="text-[9px] uppercase tracking-[0.12em] text-white/35 mb-1">
                      Nota
                    </p>
                    <p className="text-[20px] font-bold leading-none text-white/80 tabular-nums">
                      {Math.round(rankScore)}%
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="mb-4">
                <p className="text-[15px] text-white/50 leading-relaxed max-w-sm">
                  Complete um simulado na janela de execução para aparecer no
                  ranking nacional.
                </p>
              </div>
            )}

            <Link
              to="/ranking"
              className="inline-flex items-center gap-2 text-[13px] font-semibold text-white/70 hover:text-white transition-colors duration-200 no-underline group"
            >
              Ver ranking completo
              <ArrowRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden />
            </Link>
          </div>
        </div>
      </div>

      {/* Performance summary */}
      <div className="md:col-span-5">
        <div className="relative overflow-hidden rounded-[22px] border border-[#E8E1E5]/70 bg-white/90 p-6 md:p-7 shadow-[0_8px_24px_-12px_rgba(30,20,26,0.1)] h-full backdrop-blur-sm">
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/[0.02] to-transparent" />

          <div className="relative z-10">
            <div className="flex items-center gap-2.5 mb-5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary/[0.08] to-primary/[0.14] border border-primary/[0.1]">
                <TrendingUp className="h-4 w-4 text-primary/80" aria-hidden />
              </div>
              <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/60">
                Resumo de performance
              </p>
            </div>

            <div className="space-y-4">
              <StatRow
                icon={Target}
                label="Simulados realizados"
                value={String(simuladosRealizados)}
              />
              <StatRow
                icon={TrendingUp}
                label="Média atual"
                value={`${mediaAtual}%`}
              />
              {bestScore !== null && (
                <StatRow
                  icon={Trophy}
                  label="Melhor nota"
                  value={`${Math.round(bestScore)}%`}
                  highlight
                />
              )}
            </div>

            <div className="mt-5 pt-4 border-t border-[#E8E1E5]/50">
              <Link
                to="/desempenho"
                className="inline-flex items-center gap-2 text-[13px] font-semibold text-primary hover:text-primary/80 transition-colors duration-200 no-underline group"
              >
                Ver desempenho completo
                <ArrowRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function StatRow({
  icon: Icon,
  label,
  value,
  highlight,
}: {
  icon: typeof Trophy;
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2.5">
        <Icon
          className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0"
          aria-hidden
        />
        <span className="text-[13px] text-muted-foreground">{label}</span>
      </div>
      <span
        className={`text-[15px] font-bold tabular-nums ${
          highlight ? "text-primary" : "text-foreground"
        }`}
      >
        {value}
      </span>
    </div>
  );
}
