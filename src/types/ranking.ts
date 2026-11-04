/** Released selector DTO. Legacy names stay compatible with current consumers. */
export interface RankingSimuladoOption {
  id: string;
  title: string;
  sequence_number: number;
  editionId?: string | null;
  editionCode?: string | null;
  editionLabel?: string | null;
  resultsReleaseAt?: string | null;
}

export interface RankingQueryOptions {
  /** Home uses the latest result without overwriting the ranking page selection. */
  selection?: 'persisted' | 'latest-in-edition';
  editionId?: string | null;
}
