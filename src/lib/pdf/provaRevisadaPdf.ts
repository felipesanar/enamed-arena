/**
 * Generates a "Prova Revisada" PDF using @react-pdf/renderer.
 * Premium quality with custom fonts, SVG gradients, and proper typography.
 */
import React from 'react';
import type { PerformanceBreakdown } from '@/lib/resultHelpers';
import type { Question } from '@/types';
import type { ExamState } from '@/types/exam';

export type ProgressStage = 'preparing' | 'loading_images' | 'generating' | 'complete';
export type ProgressCallback = (stage: ProgressStage, current: number, total: number) => void;

export interface ProvaRevisadaInput {
  simuladoTitle: string;
  studentName: string;
  questions: Question[];
  examState: ExamState;
  breakdown: PerformanceBreakdown;
  onProgress?: ProgressCallback;
}

export async function generateProvaRevisadaPdf(input: ProvaRevisadaInput): Promise<Blob> {
  const { simuladoTitle, studentName, questions, examState, breakdown, onProgress } = input;

  onProgress?.('preparing', 0, 1);

  // ─── Load images ───
  const imageMap = new Map<string, string>();
  const questionsWithImages = questions.filter(q => q.imageUrl);
  for (let i = 0; i < questionsWithImages.length; i++) {
    onProgress?.('loading_images', i + 1, questionsWithImages.length);
    try {
      const base64 = await loadImageAsBase64(questionsWithImages[i].imageUrl!);
      if (base64) {
        imageMap.set(questionsWithImages[i].id, base64);
      }
    } catch {
      // Skip failed images
    }
  }

  // ─── Generate PDF ───
  onProgress?.('generating', 0, 1);

  const { pdf } = await import('@react-pdf/renderer');
  const { ProvaRevisadaDocument } = await import('./ProvaRevisadaDocument');

  const element = React.createElement(ProvaRevisadaDocument, {
    simuladoTitle,
    studentName,
    questions,
    examState,
    breakdown,
    imageMap,
  });

  const blob = await (pdf as any)(element).toBlob();

  onProgress?.('complete', 1, 1);
  return blob;
}

async function loadImageAsBase64(url: string, retries = 3): Promise<string | null> {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const response = await fetch(url, { cache: 'no-store' });
      if (!response.ok) return null;
      const blob = await response.blob();
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(blob);
      });
    } catch {
      if (attempt < retries - 1) {
        await new Promise(r => setTimeout(r, 500 * (attempt + 1)));
        continue;
      }
      return null;
    }
  }
  return null;
}
