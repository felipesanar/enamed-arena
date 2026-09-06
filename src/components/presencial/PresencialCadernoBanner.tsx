/**
 * PresencialCadernoBanner — faixa persistente com o caderno do aluno.
 *
 * Aparece (via `PresencialPage`) da identificação em diante — identificação,
 * gabarito e resultado. É a rede de segurança de quem escolheu errado na
 * Tela 0: ele convive com a cor do caderno na tela pelos ~15 minutos de
 * prova, o que é mais fácil de notar do que lembrar de conferir de novo a
 * capa impressa.
 *
 * A cor é literal (não segue o tema claro/escuro) pelo mesmo motivo das
 * superfícies "always-dark" já usadas no produto: ela identifica
 * fisicamente o caderno, então não pode variar com o tema — texto branco é
 * correto nos dois temas.
 */
import { CADERNO_COLOR_HEX, cadernoColorLabel } from './presencialCadernoColors';
import type { PresencialCaderno } from '@/types/presencial';

interface PresencialCadernoBannerProps {
  caderno: PresencialCaderno;
  /** `true` na tela do gabarito: fica fixa no topo e não sai da viewport ao rolar. */
  sticky?: boolean;
  /**
   * Saída para quem percebeu pela cor que pegou o caderno errado. Sem isso o
   * aluno depende de recarregar a página (que funciona, mas ninguém adivinha)
   * ou de chamar o fiscal no meio da prova.
   */
  onChangeCaderno?: () => void;
}

export function PresencialCadernoBanner({
  caderno,
  sticky = false,
  onChangeCaderno,
}: PresencialCadernoBannerProps) {
  return (
    <div
      role="status"
      className={`z-20 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 px-4 py-2 text-body-sm font-semibold text-white ${
        sticky ? 'sticky top-0' : ''
      }`}
      style={{ backgroundColor: CADERNO_COLOR_HEX[caderno.color] }}
    >
      <span>
        {caderno.label} · {cadernoColorLabel(caderno.color)}
      </span>
      {onChangeCaderno && (
        <button
          type="button"
          onClick={onChangeCaderno}
          className="rounded underline underline-offset-2 font-normal opacity-90 transition hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
        >
          Não é este caderno?
        </button>
      )}
    </div>
  );
}
