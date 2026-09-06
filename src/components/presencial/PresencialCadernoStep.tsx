/**
 * PresencialCadernoStep — Tela 0 do fluxo presencial (QR → gabarito → resultado).
 *
 * Só é renderizada (por `PresencialPage`) quando a sala não está travada num
 * caderno e o simulado tem 2+ cadernos ativos: o aluno escolhe qual caderno
 * impresso ele recebeu antes de se identificar. É a pergunta mais fácil da
 * sessão e a mais cara de errar — o gabarito impresso de um caderno não
 * serve para o outro, então escolher errado invalida a correção inteira.
 * Por isso vem primeiro, os alvos são grandes (mínimo 96px de altura) e a
 * cor sólida — não um ícone — é a informação.
 */
import { motion, useReducedMotion } from 'framer-motion';
import { CADERNO_COLOR_HEX, cadernoColorLabel } from './presencialCadernoColors';
import type { PresencialCaderno } from '@/types/presencial';

interface PresencialCadernoStepProps {
  cadernos: PresencialCaderno[];
  onSelect: (caderno: PresencialCaderno) => void;
}

export function PresencialCadernoStep({ cadernos, onSelect }: PresencialCadernoStepProps) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <motion.div
      initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: prefersReducedMotion ? 0 : 0.3 }}
      className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-8"
    >
      <div className="space-y-2 text-center">
        <h1 className="text-heading-2 text-foreground">Qual caderno você recebeu?</h1>
        <p className="text-body text-muted-foreground">
          Confira a capa do seu caderno. Escolher o caderno errado invalida sua nota.
        </p>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row">
        {cadernos.map((caderno) => (
          <button
            key={caderno.code}
            type="button"
            onClick={() => onSelect(caderno)}
            aria-label={`${caderno.label}, cor ${cadernoColorLabel(caderno.color)}`}
            className="flex min-h-[160px] flex-1 flex-col items-center justify-center gap-1 rounded-2xl px-6 py-8 text-center text-white shadow-md transition hover:brightness-110 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            style={{ backgroundColor: CADERNO_COLOR_HEX[caderno.color] }}
          >
            <span className="text-heading-2 font-bold">{caderno.label}</span>
            <span className="text-body font-semibold">{cadernoColorLabel(caderno.color)}</span>
          </button>
        ))}
      </div>

      {/*
        Esta tela não aparece só para quem esteve na sala. Todo aluno com
        gabarito offline pendente deste simulado passa por aqui — inclusive
        quem baixou a prova em PDF pela plataforma e vai transcrever de casa
        (no dia do S7 eram 105 pessoas, mais gente do que a sala inteira).
        Essas pessoas não têm caderno impresso na mão e não têm como adivinhar
        o que responder. O PDF da plataforma é gerado na ordem natural das
        questões, que é exatamente o Caderno 1 — dizer isso aqui, de forma
        explícita, é o que impede alguém sem caderno de chutar "Azul" e ter o
        gabarito inteiro embaralhado.
      */}
      <p className="text-center text-caption text-muted-foreground">
        Baixou a prova em PDF pela plataforma, sem caderno impresso? Ela corresponde ao{' '}
        <strong className="font-semibold text-foreground">Caderno 1</strong>.
      </p>
    </motion.div>
  );
}
