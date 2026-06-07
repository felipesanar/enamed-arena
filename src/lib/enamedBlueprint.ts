/**
 * ENAMED Blueprint — mapa de pesos das grandes áreas na prova.
 *
 * Pesos somam 1.0 (100%).
 * Fonte: distribuição histórica do ENAMED / SanarFlix Conteúdo.
 *
 * TODO: validar pesos oficiais com Conteúdo antes do lançamento em produção.
 *
 * Os rótulos de área seguem os valores possíveis do campo `error_notebook.area`
 * (texto livre desnormalizado). A correspondência é case-insensitive e por
 * substring para tolerar variações de capitalização do banco.
 */

export interface AreaBlueprint {
  /** Rótulo canônico exibido na UI. */
  label: string;
  /**
   * Peso (0–1) da área no ENAMED.
   * Soma de todos os pesos = 1.0.
   */
  weight: number;
  /**
   * Substrings (lowercase) que identificam esta área no campo `area`
   * da tabela `error_notebook`. A primeira correspondência vence.
   */
  matchers: string[];
}

// TODO: validar pesos oficiais com Conteúdo
export const ENAMED_BLUEPRINT: AreaBlueprint[] = [
  {
    label: 'Clínica Médica',
    weight: 0.35,
    matchers: ['clínica médica', 'clinica medica', 'clínica', 'medicina interna', 'cardiologia', 'pneumologia', 'gastroenterologia', 'reumatologia', 'nefrologia', 'endocrinologia', 'hematologia', 'infectologia', 'neurologia', 'dermatologia'],
  },
  {
    label: 'Cirurgia',
    weight: 0.20,
    matchers: ['cirurgia', 'trauma', 'urgência cirúrgica', 'urgencia cirurgica', 'anestesiologia'],
  },
  {
    label: 'Ginecologia e Obstetrícia',
    weight: 0.15,
    matchers: ['ginecologia', 'obstetrícia', 'obstetricia', 'go ', 'g&o', 'gineco', 'mastologia'],
  },
  {
    label: 'Pediatria',
    weight: 0.15,
    matchers: ['pediatria', 'neonatologia', 'puericultura'],
  },
  {
    label: 'Medicina de Família e Preventiva',
    weight: 0.15,
    matchers: ['medicina de família', 'medicina de familia', 'saúde coletiva', 'saude coletiva', 'medicina preventiva', 'epidemiologia', 'atenção básica', 'atencao basica', 'saúde pública', 'saude publica', 'medicina da família', 'medicina da familia', 'mfc'],
  },
];

/** Soma dos pesos (deve ser 1.0). */
export const TOTAL_WEIGHT = ENAMED_BLUEPRINT.reduce((acc, a) => acc + a.weight, 0);

/**
 * Retorna o peso ENAMED de uma área a partir do campo `area` do banco.
 * Tolerante a capitalização e variações de nome.
 * Retorna 0.05 (peso mínimo de cauda) se nenhuma área conhecida for detectada.
 */
export function getAreaWeight(area: string | null | undefined): number {
  if (!area) return 0.05;
  const lower = area.toLowerCase().trim();
  for (const blueprint of ENAMED_BLUEPRINT) {
    for (const matcher of blueprint.matchers) {
      if (lower.includes(matcher)) return blueprint.weight;
    }
  }
  // Área desconhecida — peso de cauda (não zerar para não excluir da priorização)
  return 0.05;
}

/**
 * Retorna o label canônico ENAMED de uma área.
 * Útil para exibição agrupada no War Room.
 */
export function getAreaLabel(area: string | null | undefined): string {
  if (!area) return 'Outras';
  const lower = area.toLowerCase().trim();
  for (const blueprint of ENAMED_BLUEPRINT) {
    for (const matcher of blueprint.matchers) {
      if (lower.includes(matcher)) return blueprint.label;
    }
  }
  return area;
}
