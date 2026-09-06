/**
 * Cores literais dos cadernos impressos (Vermelho / Azul).
 *
 * Estas cores são fixas — não seguem o tema claro/escuro do produto —
 * porque identificam fisicamente qual caderno impresso o aluno tem na mesa.
 * É a mesma lógica das superfícies "always-dark" já usadas no produto
 * (hero/sidebar em wine): a cor É a informação, então ela não pode variar
 * com o tema.
 *
 * Os tons (equivalentes a Tailwind red-700 / blue-700) foram escolhidos para
 * garantir contraste de texto branco >= 4.5:1 nas duas cores — medido:
 * vermelho #B91C1C ~6.47:1, azul #1D4ED8 ~6.70:1 (WCAG 2.1, fórmula de
 * luminância relativa). Não usamos os tokens `--destructive`/`--info` do
 * design system porque eles mudam de tom entre os temas claro/escuro (o que
 * quebraria a identidade fixa do caderno) e não têm o mesmo contraste
 * garantido nos dois temas.
 */
import type { PresencialCaderno } from '@/types/presencial';

export const CADERNO_COLOR_HEX: Record<PresencialCaderno['color'], string> = {
  vermelho: '#B91C1C',
  azul: '#1D4ED8',
};

/** Cor por extenso, com a primeira letra maiúscula (`vermelho` → `Vermelho`). */
export function cadernoColorLabel(color: PresencialCaderno['color']): string {
  return color === 'vermelho' ? 'Vermelho' : 'Azul';
}
