/**
 * CadernoExportMenu — dropdown "Exportar" do Caderno de Erros (Fase 3).
 *
 * Recebe `entries` por prop, chama as funções de export client-side,
 * exibe toast de sucesso/erro e dispara os eventos de analytics canônicos
 * `caderno_export_pdf` e `caderno_export_anki` (spec 00 §13 + analytics.ts).
 *
 * NÃO montado em CadernoPage — o ponto de uso fica por conta do chamador.
 */

import { useState } from 'react';
import { Download, FileText, BookOpen, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from '@/hooks/use-toast';
import { trackEvent } from '@/lib/analytics';
import { logger } from '@/lib/logger';
import { exportNotebookPdf, exportNotebookAnkiCsv, type CadernoExportEntry } from '@/lib/cadernoExport';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface CadernoExportMenuProps {
  /** Entradas do caderno — shape compatível com getErrorNotebook() */
  entries: CadernoExportEntry[];
  /**
   * Variante visual do botão disparador.
   * @default "outline"
   */
  variant?: 'outline' | 'ghost' | 'secondary' | 'default';
  /**
   * Tamanho do botão disparador.
   * @default "sm"
   */
  size?: 'sm' | 'default' | 'lg' | 'icon';
  /** Classe CSS extra aplicada ao botão disparador. */
  className?: string;
}

// ---------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------

type ExportKind = 'pdf' | 'anki';

export function CadernoExportMenu({
  entries,
  variant = 'outline',
  size = 'sm',
  className,
}: CadernoExportMenuProps) {
  const [busy, setBusy] = useState<ExportKind | null>(null);

  const isEmpty = entries.length === 0;

  async function handleExport(kind: ExportKind) {
    if (busy) return;
    setBusy(kind);

    try {
      if (kind === 'pdf') {
        exportNotebookPdf(entries);
        trackEvent('caderno_export_pdf', { entry_count: entries.length });
        toast({
          title: 'PDF gerado com sucesso!',
          description: `${entries.length} ${entries.length === 1 ? 'entrada exportada' : 'entradas exportadas'}.`,
        });
      } else {
        exportNotebookAnkiCsv(entries);
        trackEvent('caderno_export_anki', { entry_count: entries.length });
        toast({
          title: 'CSV para Anki gerado!',
          description: 'Importe o arquivo no Anki via Arquivo → Importar.',
        });
      }
    } catch (err) {
      logger.error('[CadernoExportMenu] Erro ao exportar:', err);
      toast({
        title: 'Erro ao exportar',
        description: 'Não foi possível gerar o arquivo. Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setBusy(null);
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant={variant}
          size={size}
          className={className}
          disabled={isEmpty}
          aria-label="Opções de exportação do caderno de erros"
          aria-haspopup="menu"
        >
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <Download className="h-4 w-4" aria-hidden />
          )}
          <span className="ml-2">Exportar</span>
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>
          Exportar caderno
          {entries.length > 0 && (
            <span className="ml-1 text-muted-foreground font-normal">
              ({entries.length} {entries.length === 1 ? 'entrada' : 'entradas'})
            </span>
          )}
        </DropdownMenuLabel>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          onSelect={() => handleExport('pdf')}
          disabled={busy !== null || isEmpty}
          aria-label="Exportar caderno como PDF"
          className="gap-2 cursor-pointer"
        >
          {busy === 'pdf' ? (
            <Loader2 className="h-4 w-4 animate-spin shrink-0" aria-hidden />
          ) : (
            <FileText className="h-4 w-4 shrink-0" aria-hidden />
          )}
          <div className="flex flex-col">
            <span>Exportar PDF</span>
            <span className="text-xs text-muted-foreground">Agrupado por área</span>
          </div>
        </DropdownMenuItem>

        <DropdownMenuItem
          onSelect={() => handleExport('anki')}
          disabled={busy !== null || isEmpty}
          aria-label="Exportar caderno como CSV para o Anki"
          className="gap-2 cursor-pointer"
        >
          {busy === 'anki' ? (
            <Loader2 className="h-4 w-4 animate-spin shrink-0" aria-hidden />
          ) : (
            <BookOpen className="h-4 w-4 shrink-0" aria-hidden />
          )}
          <div className="flex flex-col">
            <span>Exportar para Anki (CSV)</span>
            <span className="text-xs text-muted-foreground">Frente e verso por questão</span>
          </div>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
