/**
 * Shared hook for PDF download with progress tracking.
 */
import { useState, useCallback } from 'react';
import { toast } from '@/hooks/use-toast';
import { trackEvent } from '@/lib/analytics';
import { logger } from '@/lib/logger';
import type { PerformanceBreakdown } from '@/lib/resultHelpers';
import type { Question } from '@/types';
import type { ExamState } from '@/types/exam';
import type { ProgressStage } from '@/lib/pdf/provaRevisadaPdf';

export type PdfType = 'gabarito' | 'prova_revisada';

interface UsePdfDownloadReturn {
  downloading: boolean;
  stage: ProgressStage | null;
  progress: { current: number; total: number } | null;
  downloadGabarito: () => Promise<void>;
  downloadProvaRevisada: () => Promise<void>;
}

const STAGE_LABELS: Record<ProgressStage, string> = {
  preparing: 'Preparando...',
  loading_images: 'Carregando imagens',
  generating: 'Gerando PDF',
  complete: 'Concluido!',
};

export function usePdfDownload(opts: {
  simuladoId: string;
  simuladoTitle: string;
  studentName: string;
  questions: Question[];
  examState: ExamState | null;
  breakdown: PerformanceBreakdown | null;
}): UsePdfDownloadReturn {
  const [downloading, setDownloading] = useState(false);
  const [stage, setStage] = useState<ProgressStage | null>(null);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);

  const downloadGabarito = useCallback(async () => {
    if (!opts.breakdown || downloading) return;
    setDownloading(true);
    try {
      const { generateGabaritoPdf } = await import('@/lib/pdf/gabaritoPdf');
      const blob = generateGabaritoPdf({
        simuladoTitle: opts.simuladoTitle,
        studentName: opts.studentName,
        questions: opts.questions,
        breakdown: opts.breakdown,
      });
      saveBlob(blob, `gabarito_${slugify(opts.simuladoTitle)}.pdf`);
      trackEvent('pdf_downloaded', { type: 'gabarito', simulado_id: opts.simuladoId });
      toast({ title: 'Gabarito baixado!', description: 'O PDF foi salvo com sucesso.' });
    } catch (err) {
      logger.error('[PDF] Gabarito error:', err);
      toast({ title: 'Erro ao gerar PDF', description: 'Tente novamente.', variant: 'destructive' });
    } finally {
      setDownloading(false);
    }
  }, [opts, downloading]);

  const downloadProvaRevisada = useCallback(async () => {
    if (!opts.breakdown || !opts.examState || downloading) return;
    setDownloading(true);
    setStage('preparing');
    try {
      const { generateProvaRevisadaPdf } = await import('@/lib/pdf/provaRevisadaPdf');
      const blob = await generateProvaRevisadaPdf({
        simuladoTitle: opts.simuladoTitle,
        studentName: opts.studentName,
        questions: opts.questions,
        examState: opts.examState,
        breakdown: opts.breakdown,
        onProgress: (s, c, t) => {
          setStage(s);
          setProgress({ current: c, total: t });
        },
      });
      saveBlob(blob, `prova_revisada_${slugify(opts.simuladoTitle)}.pdf`);
      trackEvent('pdf_downloaded', { type: 'prova_revisada', simulado_id: opts.simuladoId });
      toast({ title: 'Prova Revisada baixada!', description: 'O PDF completo foi salvo.' });
    } catch (err) {
      logger.error('[PDF] Prova revisada error:', err);
      toast({ title: 'Erro ao gerar PDF', description: 'Tente novamente.', variant: 'destructive' });
    } finally {
      setDownloading(false);
      setStage(null);
      setProgress(null);
    }
  }, [opts, downloading]);

  return { downloading, stage, progress, downloadGabarito, downloadProvaRevisada };
}

export function getStageLabel(stage: ProgressStage): string {
  return STAGE_LABELS[stage];
}

function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}
