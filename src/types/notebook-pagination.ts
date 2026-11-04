import type { Database } from '@/integrations/supabase/types';
import type { DbReason } from '@/lib/errorNotebookReasons';
import type { CadernoExportEntry } from '@/lib/cadernoExport';

export interface NotebookEdition {
  edition_id: string | null;
  edition_code: string | null;
  edition_label: string | null;
}
export type NotebookRow = Database['public']['Tables']['error_notebook']['Row'] & NotebookEdition;
export interface NotebookFilters {
  editionId?: string | null;
  reason?: DbReason | null;
  area?: string | null;
  search?: string | null;
  state?: 'all' | 'pending' | 'mastered';
}
export interface NotebookPagination { limit?: number; offset?: number }
export interface NotebookOptions { editionsEnabled?: boolean }
export interface NotebookAreaCounts {
  area: string | null;
  total: number;
  mastered: number;
  due: number;
}
export interface NotebookCounts {
  total: number;
  mastered: number;
  due: number;
  by_area: NotebookAreaCounts[];
}
export interface NotebookPage {
  items: NotebookRow[];
  total: number;
  limit: number;
  offset: number;
  counts: NotebookCounts;
}
export type NotebookExportEntry = CadernoExportEntry & NotebookEdition;
