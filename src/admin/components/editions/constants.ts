import type { EditionStatus } from '@/types/edition';

export const editionStatusLabels: Record<EditionStatus, string> = {
  planned: 'Planejada', preparing: 'Em preparação', active: 'Ativa', closed: 'Encerrada', archived: 'Arquivada',
};
