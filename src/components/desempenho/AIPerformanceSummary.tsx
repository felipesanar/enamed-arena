import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Sparkles, Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { logger } from '@/lib/logger';
import type { PerformanceBreakdown } from '@/lib/resultHelpers';

interface Props {
  studentName: string;
  simuladoTitle?: string;
  breakdown: PerformanceBreakdown;
}

export function AIPerformanceSummary({ studentName, simuladoTitle, breakdown }: Props) {
  const [loading, setLoading] = useState(false);
  const [markdown, setMarkdown] = useState<string | null>(null);

  const generate = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('gemini-performance-summary', {
        body: {
          studentName,
          simuladoTitle,
          overall: {
            totalQuestions: breakdown.overall.totalQuestions,
            totalCorrect: breakdown.overall.totalCorrect,
            totalAnswered: breakdown.overall.totalAnswered,
            percentageScore: breakdown.overall.percentageScore,
          },
          byArea: breakdown.byArea.map((a) => ({
            area: a.area, total: a.total, correct: a.correct, score: a.score,
          })),
          bySubspecialty: breakdown.bySubspecialty.map((s) => ({
            specialty: s.specialty, subTopic: s.subTopic, total: s.total, correct: s.correct, score: s.score,
          })),
        },
      });
      if (error) throw error;
      if (!data?.markdown) throw new Error('Resposta vazia da IA');
      setMarkdown(data.markdown);
    } catch (err) {
      logger.error('[AIPerformanceSummary] error', err);
      toast({
        title: 'Não foi possível gerar a análise',
        description: err instanceof Error ? err.message : 'Tente novamente em instantes.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-[22px] border border-primary/15 bg-gradient-to-br from-primary/[0.04] to-primary/[0.08] p-5 md:p-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-primary/10 p-2.5">
            <Sparkles className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="text-heading-3 text-foreground">Análise com IA</h3>
            <p className="text-caption text-muted-foreground mt-0.5">
              Resumo personalizado do seu desempenho gerado pelo Gemini.
            </p>
          </div>
        </div>
        <Button
          onClick={generate}
          disabled={loading}
          className="!text-white"
          size="sm"
        >
          {loading ? (
            <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Gerando…</>
          ) : markdown ? (
            <><RefreshCw className="h-4 w-4 mr-2" />Gerar novamente</>
          ) : (
            <><Sparkles className="h-4 w-4 mr-2" />Gerar análise</>
          )}
        </Button>
      </div>

      {markdown && (
        <div className="prose prose-sm max-w-none mt-5 text-foreground prose-headings:text-foreground prose-headings:font-semibold prose-h3:text-[15px] prose-h3:mt-4 prose-h3:mb-2 prose-p:text-body prose-p:text-muted-foreground prose-li:text-body prose-li:text-muted-foreground prose-strong:text-foreground">
          <ReactMarkdown>{markdown}</ReactMarkdown>
        </div>
      )}
    </div>
  );
}