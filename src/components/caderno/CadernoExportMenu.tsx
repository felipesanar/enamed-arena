/**
 * CadernoExportMenu — botão "Exportar" do Caderno de Erros.
 *
 * Botão direto (sem dropdown): ao clicar, busca as entradas do caderno já
 * enriquecidas com enunciado completo, alternativas, gabarito e explicação
 * (simuladosApi.getErrorNotebookForExport) e gera um PDF de estudo.
 *
 * Dispara o evento de analytics canônico `caderno_export_pdf`.
 * NÃO montado em CadernoPage — o ponto de uso fica por conta do chamador.
 */

import { useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import { trackEvent } from '@/lib/analytics';
import { logger } from '@/lib/logger';
import { simuladosApi } from '@/services/simuladosApi';
import { exportNotebookPdf } from '@/lib/cadernoExport';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface CadernoExportMenuProps {
  /** ID do usuário dono do caderno — usado para buscar os dados de export. */
  userId: string;
  /** Quantidade de entradas no caderno (para desabilitar quando vazio). */
  entryCount: number;
  /**
   * Variante visual do botão.
   * @default "outline"
   */
  variant?: 'outline' | 'ghost' | 'secondary' | 'default';
  /**
   * Tamanho do botão.
   * @default "sm"
   */
  size?: 'sm' | 'default' | 'lg' | 'icon';
  /** Classe CSS extra aplicada ao botão. */
  className?: string;
}

// ---------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------

export function CadernoExportMenu({
  userId,
  entryCount,
  variant = 'outline',
  size = 'sm',
  className,
}: CadernoExportMenuProps) {
  const [busy, setBusy] = useState(false);

  const isEmpty = entryCount === 0;

  async function handleExport() {
    if (busy || isEmpty) return;
    setBusy(true);

    try {
      const entries = await simuladosApi.getErrorNotebookForExport(userId);

      if (entries.length === 0) {
        toast({
          title: 'Nada para exportar',
          description: 'Seu caderno de erros está vazio.',
        });
        return;
      }

      exportNotebookPdf(entries);
      trackEvent('caderno_export_pdf', { entry_count: entries.length });
      toast({
        title: 'PDF gerado com sucesso!',
        description: `${entries.length} ${entries.length === 1 ? 'questão exportada' : 'questões exportadas'}.`,
      });
    } catch (err) {
      logger.error('[CadernoExportMenu] Erro ao exportar:', err);
      toast({
        title: 'Erro ao exportar',
        description: 'Não foi possível gerar o PDF. Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button
      variant={variant}
      size={size}
      className={className}
      disabled={isEmpty || busy}
      onClick={handleExport}
      aria-label="Exportar caderno de erros em PDF"
    >
      {busy ? (
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
      ) : (
        <Download className="h-4 w-4" aria-hidden />
      )}
      <span className="ml-2">{busy ? 'Gerando…' : 'Exportar PDF'}</span>
    </Button>
  );
}
