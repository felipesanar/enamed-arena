import { Sparkles } from "lucide-react";
import { SEGMENT_LABELS } from "@/types";
import type { UserSegment } from "@/types";

interface Props {
  segment: string;
  specialty: string;
  institutions: string[];
}

export function ConfirmationStep({ segment, specialty, institutions }: Props) {
  const segmentLabel = SEGMENT_LABELS[segment as UserSegment] ?? segment;

  return (
    <div className="flex flex-col h-full overflow-hidden lg:pt-4">
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
            <Sparkles
              className="w-[30px] h-[30px]"
              style={{ color: "#e83862" }}
              strokeWidth={1.75}
            />
          </div>
        </div>
        <h2 className="text-[19px] font-extrabold text-center leading-tight tracking-tight text-white mb-1.5">
          Tudo pronto!
        </h2>
        <p
          className="text-[12.5px] text-center leading-relaxed mb-5"
          style={{ color: "rgba(255,255,255,.45)" }}
        >
          Confira suas informações antes de começar. Você poderá editar esses
          dados entre as janelas de simulado.
        </p>
      </div>

      {/* Confirmation cards */}
      <div className="flex-1 overflow-y-auto px-4 pb-2 lg:px-0 lg:pb-0 flex flex-col gap-3 lg:grid lg:grid-cols-3 lg:gap-4 lg:content-start">
        <div
          className="p-4 rounded-[15px] flex flex-col gap-1 lg:h-fit"
          style={{
            background: "rgba(255,255,255,.028)",
            border: "1px solid rgba(255,255,255,.07)",
          }}
        >
          <p
            className="text-[9px] font-bold uppercase tracking-[.1em]"
            style={{ color: "rgba(255,255,255,.28)" }}
          >
            Seu plano
          </p>
          <p
            className="text-[13.5px] font-semibold"
            style={{ color: "rgba(255,255,255,.82)" }}
          >
            {segmentLabel}
          </p>
          <p className="text-[10.5px]" style={{ color: "rgba(255,255,255,.28)" }}>
            Definido pela sua assinatura
          </p>
        </div>

        <div
          className="p-4 rounded-[15px] flex flex-col gap-1 lg:h-fit"
          style={{
            background: "rgba(255,255,255,.028)",
            border: "1px solid rgba(255,255,255,.07)",
          }}
        >
          <p
            className="text-[9px] font-bold uppercase tracking-[.1em]"
            style={{ color: "rgba(255,255,255,.28)" }}
          >
            Especialidade desejada
          </p>
          <p
            className="text-[13.5px] font-semibold"
            style={{ color: "rgba(255,255,255,.82)" }}
          >
            {specialty}
          </p>
        </div>

        <div
          className="p-4 rounded-[15px] flex flex-col gap-2 lg:h-fit"
          style={{
            background: "rgba(255,255,255,.028)",
            border: "1px solid rgba(255,255,255,.07)",
          }}
        >
          <p
            className="text-[9px] font-bold uppercase tracking-[.1em]"
            style={{ color: "rgba(255,255,255,.28)" }}
          >
            Instituições desejadas
          </p>
          <div className="flex flex-wrap gap-1.5">
            {institutions.map((inst) => (
              <span
                key={inst}
                className="px-2.5 py-1.5 rounded-[8px] text-[11px] font-medium"
                style={{
                  background: "rgba(255,255,255,.055)",
                  border: "1px solid rgba(255,255,255,.09)",
                  color: "rgba(255,255,255,.55)",
                }}
              >
                {inst}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
