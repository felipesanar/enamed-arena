/**
 * Auditoria de gabarito sob demanda — gate de publicação (Componente 3).
 *
 * Ver docs/superpowers/specs/2026-08-17-blindagem-gabarito-design.md
 *
 * Lê as questões do banco (planilha original não está em mãos no gate de
 * publicação), deriva o gabarito a partir de `question_options.is_correct` e
 * cruza com o comentário via `checkGabarito` (mesmo módulo puro que blinda o
 * import). Dois estados são impossíveis pelo import mas possíveis por edição
 * manual no banco — nenhuma alternativa marcada como correta, ou mais de uma —
 * e viram findings próprios, sempre `severity: 'error'`.
 *
 * A 2ª opinião por IA (`runAiSecondOpinion`) é disparo separado, só para as
 * questões já carregadas por `runGabaritoAudit`, em lotes com concorrência
 * limitada (mesmo padrão de `runVerify` em AdminUploadQuestions.tsx).
 */
import { useCallback, useState } from 'react';
import { adminApi } from '@/admin/services/adminApi';
import type {
  GabaritoAiFinding,
  GabaritoAuditQuestion,
  GabaritoVerifyInput,
} from '@/admin/services/adminApi';
import {
  checkGabarito,
  summarizeGabaritoFindings,
} from '@/admin/lib/gabaritoCheck';
import type { GabaritoCheckType, GabaritoFinding, GabaritoSummary } from '@/admin/lib/gabaritoCheck';
import { chunk } from '@/admin/lib/chunk';
import { logger } from '@/lib/logger';

/** 1 questão por chamada — mesma calibração do `admin-verify-gabarito` (spec, Componente 4). */
const GABARITO_AI_BATCH_SIZE = 1;
const GABARITO_AI_CONCURRENCY = 4;

export type GabaritoAuditStatus = 'idle' | 'loading' | 'success' | 'error';

export interface UseGabaritoAuditResult {
  status: GabaritoAuditStatus;
  summary: GabaritoSummary | null;
  questions: GabaritoAuditQuestion[];
  error: Error | null;
  aiFindings: GabaritoAiFinding[];
  aiLoading: boolean;
  aiError: Error | null;
  /** Busca as questões, cruza gabarito × comentário e devolve o resumo. */
  runGabaritoAudit: (simuladoId: string) => Promise<GabaritoSummary>;
  /** 2ª opinião por IA sobre as questões já carregadas por `runGabaritoAudit`. */
  runAiSecondOpinion: () => Promise<GabaritoAiFinding[]>;
  reset: () => void;
}

function noCorrectMarkedFinding(questionNumber: number): GabaritoFinding {
  return {
    questionNumber,
    // `no_correct_marked` não está no contrato congelado de `gabaritoCheck.ts`
    // (só cobre o comentário × gabarito informado); aqui é um estado de dados
    // que só o gate de publicação consegue detectar, então cunhamos um
    // checkType próprio só para exibição.
    checkType: 'no_correct_marked' as unknown as GabaritoCheckType,
    severity: 'error',
    what: `Questão ${questionNumber}: nenhuma alternativa está marcada como correta no banco.`,
    how: 'Marque manualmente a alternativa correta antes de publicar.',
    evidence: '',
  };
}

function multipleCorrectMarkedFinding(questionNumber: number, labels: string[]): GabaritoFinding {
  return {
    questionNumber,
    checkType: 'multiple_correct_marked',
    severity: 'error',
    what: `Questão ${questionNumber}: mais de uma alternativa está marcada como correta (${labels.join(', ')}).`,
    how: 'Corrija no banco para que só uma alternativa fique marcada como correta.',
    evidence: '',
  };
}

export function useGabaritoAudit(): UseGabaritoAuditResult {
  const [status, setStatus] = useState<GabaritoAuditStatus>('idle');
  const [summary, setSummary] = useState<GabaritoSummary | null>(null);
  const [questions, setQuestions] = useState<GabaritoAuditQuestion[]>([]);
  const [error, setError] = useState<Error | null>(null);

  const [aiFindings, setAiFindings] = useState<GabaritoAiFinding[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<Error | null>(null);

  const runGabaritoAudit = useCallback(async (simuladoId: string): Promise<GabaritoSummary> => {
    setStatus('loading');
    setError(null);
    setAiFindings([]);
    setAiError(null);
    try {
      const loadedQuestions = await adminApi.getQuestionsForGabaritoAudit(simuladoId);
      const findings: GabaritoFinding[] = [];

      for (const q of loadedQuestions) {
        const correctOptions = q.options.filter((o) => o.isCorrect);

        if (correctOptions.length === 0) {
          findings.push(noCorrectMarkedFinding(q.questionNumber));
          continue;
        }
        if (correctOptions.length > 1) {
          findings.push(multipleCorrectMarkedFinding(q.questionNumber, correctOptions.map((o) => o.label)));
          continue;
        }

        const gabarito = correctOptions[0].label;
        try {
          const questionFindings = checkGabarito({
            questionNumber: q.questionNumber,
            gabarito,
            options: q.options.map((o) => ({ label: o.label, text: o.text })),
            comentario: q.comentario,
          });
          findings.push(...questionFindings);
        } catch (checkErr) {
          // Uma questão que quebra o checador não pode derrubar a auditoria inteira.
          logger.error('[useGabaritoAudit] checkGabarito falhou na questão', q.questionNumber, checkErr);
        }
      }

      const nextSummary = summarizeGabaritoFindings(findings);
      setSummary(nextSummary);
      setQuestions(loadedQuestions);
      setStatus('success');
      return nextSummary;
    } catch (err: any) {
      logger.error('[useGabaritoAudit] Falha ao rodar auditoria de gabarito:', err);
      setStatus('error');
      setSummary(null);
      setQuestions([]);
      setError(err);
      throw err;
    }
  }, []);

  const runAiSecondOpinion = useCallback(async (): Promise<GabaritoAiFinding[]> => {
    if (questions.length === 0) return [];

    setAiLoading(true);
    setAiError(null);
    try {
      const inputs: GabaritoVerifyInput[] = questions.map((q) => {
        const correct = q.options.find((o) => o.isCorrect);
        return {
          question_number: q.questionNumber,
          enunciado_text: q.enunciado,
          comentario_text: q.comentario,
          alternativas: q.options.map((o) => ({ label: o.label, text: o.text })),
          gabarito: correct?.label ?? '',
        };
      });

      const batches = chunk(inputs, GABARITO_AI_BATCH_SIZE);
      const results: GabaritoAiFinding[] = [];
      let cursor = 0;

      async function worker() {
        while (cursor < batches.length) {
          const my = cursor++;
          const batch = batches[my];
          if (!batch) return;
          const part = await adminApi.verifyGabarito(batch);
          results.push(...part);
        }
      }
      await Promise.all(
        Array.from({ length: Math.min(GABARITO_AI_CONCURRENCY, batches.length || 1) }, worker),
      );

      setAiFindings(results);
      return results;
    } catch (err: any) {
      logger.error('[useGabaritoAudit] Falha na 2ª opinião por IA:', err);
      setAiError(err);
      throw err;
    } finally {
      setAiLoading(false);
    }
  }, [questions]);

  const reset = useCallback(() => {
    setStatus('idle');
    setSummary(null);
    setQuestions([]);
    setError(null);
    setAiFindings([]);
    setAiError(null);
  }, []);

  return {
    status,
    summary,
    questions,
    error,
    aiFindings,
    aiLoading,
    aiError,
    runGabaritoAudit,
    runAiSecondOpinion,
    reset,
  };
}
