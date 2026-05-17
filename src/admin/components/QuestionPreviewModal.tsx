import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { ExtractedImage } from '../utils/xlsxImageExtractor';

interface PreviewRow {
  numero: number;
  'Grande Área': string;
  Especialidade: string;
  Tema: string;
  Enunciado: string;
  'Alternativa A': string;
  'Alternativa B': string;
  'Alternativa C': string;
  'Alternativa D': string;
  Gabarito: string;
  'Comentário': string;
}

interface Props {
  row: PreviewRow | null;
  enunciadoImage?: ExtractedImage;
  comentarioImage?: ExtractedImage;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function toDataUrl(img?: ExtractedImage): string | null {
  if (!img) return null;
  return `data:${img.mimeType};base64,${img.base64}`;
}

export function QuestionPreviewModal({ row, enunciadoImage, comentarioImage, open, onOpenChange }: Props) {
  if (!row) return null;

  const gabarito = (row.Gabarito || '').toUpperCase();
  const enunciadoUrl = toDataUrl(enunciadoImage);
  const comentarioUrl = toDataUrl(comentarioImage);

  const options: Array<{ label: 'A' | 'B' | 'C' | 'D'; text: string }> = [
    { label: 'A', text: row['Alternativa A'] },
    { label: 'B', text: row['Alternativa B'] },
    { label: 'C', text: row['Alternativa C'] },
    { label: 'D', text: row['Alternativa D'] },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base">Preview da questão {row.numero}</DialogTitle>
        </DialogHeader>

        {/* Metadados admin */}
        <div className="flex flex-wrap items-center gap-2 pb-4 border-b">
          <Badge variant="secondary">{row['Grande Área']}</Badge>
          <Badge variant="outline">{row.Especialidade}</Badge>
          {row.Tema && <Badge variant="outline" className="text-muted-foreground">{row.Tema}</Badge>}
          <span className="ml-auto text-xs text-muted-foreground">Gabarito:</span>
          <Badge className="!text-white">{gabarito || '—'}</Badge>
        </div>

        {/* Preview modo prova */}
        <div className="pt-2">
          <p className="text-body font-bold text-primary tracking-tight mb-2">
            Questão {row.numero}
          </p>
          <p className="text-[17px] leading-[1.75] text-[hsl(var(--exam-text))] whitespace-pre-line">
            {row.Enunciado}
          </p>

          {enunciadoUrl && (
            <div className="mt-5 mb-2">
              <img
                src={enunciadoUrl}
                alt={`Imagem da questão ${row.numero}`}
                className="max-w-full rounded-lg border bg-muted/20"
              />
            </div>
          )}

          <div className="space-y-2.5 mt-6">
            {options.map((opt) => {
              const isCorrect = opt.label === gabarito;
              return (
                <div
                  key={opt.label}
                  className={cn(
                    'w-full text-left p-4 rounded-xl border-2 transition-colors',
                    isCorrect
                      ? 'border-success bg-success/10'
                      : 'border-transparent bg-[hsl(var(--exam-surface))]',
                  )}
                >
                  <div className="flex items-start gap-3">
                    <span
                      className={cn(
                        'flex-shrink-0 h-7 w-7 rounded-full flex items-center justify-center font-mono text-[13px] font-semibold',
                        isCorrect
                          ? 'bg-success text-success-foreground'
                          : 'bg-muted/60 text-muted-foreground',
                      )}
                    >
                      {opt.label}
                    </span>
                    <span className="text-[15px] leading-[1.6] text-[hsl(var(--exam-text))] pt-0.5 break-words">
                      {opt.text}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {(row['Comentário'] || comentarioUrl) && (
            <div className="mt-8 pt-6 border-t">
              <p className="text-body-sm font-semibold text-foreground mb-3">Comentário / Explicação</p>
              {row['Comentário'] && (
                <p className="text-[15px] leading-[1.7] text-muted-foreground whitespace-pre-line">
                  {row['Comentário']}
                </p>
              )}
              {comentarioUrl && (
                <div className="mt-4">
                  <img
                    src={comentarioUrl}
                    alt={`Imagem do comentário da questão ${row.numero}`}
                    className="max-w-full rounded-lg border bg-muted/20"
                  />
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}