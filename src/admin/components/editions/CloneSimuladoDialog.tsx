import { useRef, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { adminEditionsApi } from '@/admin/services/adminEditionsApi';
import { brasiliaInputToISO } from '@/admin/lib/brasiliaDateTime';
import type { ExamEdition } from '@/types/edition';
import '@/admin/components/editions/editions.css';

export function CloneSimuladoDialog({ source, editions, onClose, onCloned }: {
  source: { id: string; title: string }; editions: ExamEdition[]; onClose: () => void; onCloned: (id: string) => void;
}) {
  const [editionId, setEditionId] = useState('');
  const [windowStart, setWindowStart] = useState('');
  const [windowEnd, setWindowEnd] = useState('');
  const [resultsReleaseAt, setResultsReleaseAt] = useState('');
  const [copyQuestions, setCopyQuestions] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const errorRef = useRef<HTMLParagraphElement>(null);
  return <Dialog open onOpenChange={open => { if (!open && !saving) onClose(); }}><DialogContent className="editions-experience max-h-[calc(100dvh-32px)] w-[calc(100%-32px)] max-w-[520px] overflow-y-auto border-admin-line bg-admin-surface p-5 sm:p-7" onCloseAutoFocus={e => {
    e.preventDefault(); document.getElementById(`simulado-actions-${source.id}`)?.focus();
  }}>
    <DialogTitle>Clonar como rascunho</DialogTitle><DialogDescription className="text-admin-muted break-words">Origem: {source.title}. A origem e as tentativas serão preservadas.</DialogDescription>
    <form onSubmit={async e => {
      e.preventDefault(); if (saving) return;
      setError('');
      try {
        const start = brasiliaInputToISO(windowStart); const end = brasiliaInputToISO(windowEnd); const release = brasiliaInputToISO(resultsReleaseAt);
        if (!(start < end && end <= release)) throw new Error('Confira a janela: abertura antes do fechamento, resultado após o fechamento.');
        setSaving(true);
        const id = await adminEditionsApi.clone({ sourceSimuladoId: source.id, editionId, windowStart: start, windowEnd: end, resultsReleaseAt: release, copyQuestions });
        onCloned(id);
      } catch {
        setError('Não foi possível clonar. Confira a edição e a janela e tente novamente. Seus valores foram mantidos.');
        requestAnimationFrame(() => errorRef.current?.focus());
      }
      finally { setSaving(false); }
    }} className="space-y-5">
      {error && <p ref={errorRef} tabIndex={-1} role="alert" className="text-sm text-admin-text">{error}</p>}
      <div className="editions-field"><label htmlFor="clone-edition">Edição de destino</label><select id="clone-edition" required value={editionId} onChange={e => setEditionId(e.target.value)} disabled={saving}><option value="">Selecione a edição</option>{editions.map(edition => <option key={edition.id} value={edition.id}>{edition.code} · {edition.label}</option>)}</select></div>
      {([['clone-start','Abre em',windowStart,setWindowStart],['clone-end','Fecha em',windowEnd,setWindowEnd],['clone-release','Libera resultados',resultsReleaseAt,setResultsReleaseAt]] as const).map(([id,label,value,set]) => <div key={id} className="editions-field"><label htmlFor={id}>{label} (horário de Brasília)</label><input id={id} type="datetime-local" required value={value} disabled={saving} onChange={e => set(e.target.value)} /></div>)}
      <div className="flex items-center gap-3"><input id="clone-copy" type="checkbox" checked={copyQuestions} disabled={saving} onChange={e => setCopyQuestions(e.target.checked)} /><label htmlFor="clone-copy" className="text-sm">Copiar questões e alternativas com novos IDs</label></div>
      <p className="text-xs text-admin-muted">Áreas não resolvidas na matriz de destino ficam pendentes no rascunho e impedem a publicação.</p>
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end"><Button variant="outline" type="button" disabled={saving} onClick={onClose}>Cancelar</Button><Button type="submit" disabled={saving}>{saving ? 'Clonando...' : 'Clonar como rascunho'}</Button></div>
    </form>
  </DialogContent></Dialog>;
}
