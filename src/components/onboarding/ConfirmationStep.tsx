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
  const safeInstitutions = institutions.length > 0 ? institutions : ["Ainda não definido"];

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
      <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-2 lg:px-0 lg:pb-0">
        <div
          className="grid grid-cols-1 gap-3 lg:grid-cols-12 lg:gap-4"
        >
          <div
            className="rounded-2xl p-4 lg:col-span-4"
            style={{
              background:
                "linear-gradient(165deg, rgba(255,255,255,.04) 0%, rgba(255,255,255,.02) 100%)",
              border: "1px solid rgba(255,255,255,.09)",
              boxShadow: "inset 0 1px 0 rgba(255,255,255,.04)",
            }}
          >
            <p
              className="text-[9px] font-bold uppercase tracking-[.12em]"
              style={{ color: "rgba(255,255,255,.32)" }}
            >
              Seu plano
            </p>
            <p
              className="mt-1 text-[22px] font-extrabold leading-none"
              style={{ color: "rgba(255,255,255,.9)" }}
            >
              {segmentLabel}
            </p>
            <p className="mt-2 text-[11px]" style={{ color: "rgba(255,255,255,.36)" }}>
              Definido pela sua assinatura atual.
            </p>
          </div>

          <div
            className="rounded-2xl p-4 lg:col-span-8"
            style={{
              background:
                "linear-gradient(165deg, rgba(232,56,98,.11) 0%, rgba(232,56,98,.04) 100%)",
              border: "1px solid rgba(232,56,98,.22)",
              boxShadow:
                "inset 0 1px 0 rgba(255,255,255,.05), 0 10px 26px -18px rgba(232,56,98,.45)",
            }}
          >
            <p
              className="text-[9px] font-bold uppercase tracking-[.12em]"
              style={{ color: "rgba(255,255,255,.36)" }}
            >
              Especialidade desejada
            </p>
            <p
              className="mt-1 text-[20px] font-extrabold leading-tight"
              style={{ color: "#f6f2f4" }}
            >
              {specialty}
            </p>
          </div>
        </div>

        <div
          className="mt-3 rounded-2xl p-4"
          style={{
            background:
              "linear-gradient(165deg, rgba(255,255,255,.03) 0%, rgba(255,255,255,.018) 100%)",
            border: "1px solid rgba(255,255,255,.08)",
          }}
        >
          <p
            className="text-[9px] font-bold uppercase tracking-[.12em]"
            style={{ color: "rgba(255,255,255,.32)" }}
          >
            Instituições desejadas
          </p>
          <div className="mt-2 grid grid-cols-1 gap-2.5 lg:grid-cols-2">
            {safeInstitutions.map((inst) => (
              <div
                key={inst}
                className="rounded-xl px-3 py-2.5"
                style={{
                  background: "rgba(255,255,255,.04)",
                  border: "1px solid rgba(255,255,255,.1)",
                }}
              >
                <p className="text-[10px] uppercase tracking-[.1em]" style={{ color: "rgba(255,255,255,.3)" }}>
                  Instituição
                </p>
                <p className="mt-0.5 text-[13px] font-semibold leading-snug" style={{ color: "rgba(255,255,255,.78)" }}>
                  {inst}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
