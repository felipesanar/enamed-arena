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
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-admin-surface border-admin-line text-admin-text">
        <DialogHeader>
          <DialogTitle className="text-base text-admin-text">Preview da questão {row.numero}</DialogTitle>
        </DialogHeader>

        {/* Metadados admin */}
        <div className="flex flex-wrap items-center gap-2 pb-4 border-b border-admin-line">
          <Badge variant="secondary" className="bg-admin-raised text-admin-text border border-admin-line">{row['Grande Área']}</Badge>
          <Badge variant="outline" className="border-admin-line-strong text-admin-muted">{row.Especialidade}</Badge>
          {row.Tema && <Badge variant="outline" className="border-admin-line-strong text-admin-muted">{row.Tema}</Badge>}
          <span className="ml-auto text-xs text-admin-muted">Gabarito:</span>
          <Badge className="bg-admin-accent text-admin-accent-contrast hover:bg-admin-accent">{gabarito || '—'}</Badge>
        </div>

        {/* Preview modo prova */}
        <div className="pt-2">
          <p className="text-body font-bold text-admin-accent tracking-tight mb-2">
            Questão {row.numero}
          </p>
          <p className="text-[17px] leading-[1.75] text-admin-text whitespace-pre-line">
            {row.Enunciado}
          </p>

          {enunciadoUrl && (
            <div className="mt-5 mb-2">
              <img
                src={enunciadoUrl}
                alt={`Imagem da questão ${row.numero}`}
                className="max-w-full rounded-lg border border-admin-line bg-admin-raised/40"
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
                      ? 'border-admin-success bg-admin-success/10'
                      : 'border-transparent bg-admin-raised/60',
                  )}
                >
                  <div className="flex items-start gap-3">
                    <span
                      className={cn(
                        'flex-shrink-0 h-7 w-7 rounded-full flex items-center justify-center font-mono text-[13px] font-semibold',
                        isCorrect
                          ? 'bg-admin-success text-white'
                          : 'bg-admin-raised text-admin-muted',
                      )}
                    >
                      {opt.label}
                    </span>
                    <span className="text-[15px] leading-[1.6] text-admin-text pt-0.5 break-words">
                      {opt.text}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {(row['Comentário'] || comentarioUrl) && (
            <div className="mt-8 pt-6 border-t border-admin-line">
              <p className="text-body-sm font-semibold text-admin-text mb-3">Comentário / Explicação</p>
              {row['Comentário'] && (
                <p className="text-[15px] leading-[1.7] text-admin-muted whitespace-pre-line">
                  {row['Comentário']}
                </p>
              )}
              {comentarioUrl && (
                <div className="mt-4">
                  <img
                    src={comentarioUrl}
                    alt={`Imagem do comentário da questão ${row.numero}`}
                    className="max-w-full rounded-lg border border-admin-line bg-admin-raised/40"
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
