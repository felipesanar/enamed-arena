import type { SimuladoConfig } from '@/types';

type EditionMetadata = Pick<SimuladoConfig, 'editionId' | 'editionCode' | 'editionLabel'>;

export function editionBadge(sim?: EditionMetadata | null): string {
  return sim?.editionLabel || (sim?.editionCode ? `ENAMED ${sim.editionCode}` : 'ENAMED');
}

/** Missing metadata is explicit legacy data, never the current edition. */
export function groupSimuladosByEdition<T extends EditionMetadata>(
  items: readonly T[], currentEditionId?: string | null,
): { key: string; label: string; isCurrent: boolean; items: T[] }[] {
  const groups = new Map<string, { key: string; label: string; isCurrent: boolean; items: T[] }>();
  for (const item of items) {
    const key = item.editionId ? `id:${item.editionId}` : item.editionCode ? `code:${item.editionCode}` : 'legacy';
    let group = groups.get(key);
    if (!group) {
      group = { key, label: key === 'legacy' ? 'Legado sem edição' : editionBadge(item),
        isCurrent: !!currentEditionId && item.editionId === currentEditionId, items: [] };
      groups.set(key, group);
    }
    group.items.push(item);
  }
  return [...groups.values()].sort((a, b) => Number(b.isCurrent) - Number(a.isCurrent));
}
