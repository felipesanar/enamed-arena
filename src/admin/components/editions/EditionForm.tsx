import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import type { EditionDraft } from '@/types/edition-admin';
import type { ExamBlueprint, EditionStatus } from '@/types/edition';
import { adminEditionsApi } from '@/admin/services/adminEditionsApi';
import { editionStatusLabels } from '@/admin/components/editions/constants';

export function EditionForm({ initial, blueprints, onCancel, onSaved }: {
  initial: EditionDraft; blueprints: ExamBlueprint[]; onCancel: () => void; onSaved: () => void;
}) {
  const [draft, setDraft] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const errorRef = useRef<HTMLParagraphElement>(null);
  const set = <K extends keyof EditionDraft>(key: K, value: EditionDraft[K]) => setDraft(d => ({ ...d, [key]: value }));
  const field = (key: 'code' | 'label' | 'year' | 'exam_date' | 'official_results_at' | 'cutoff_reference_label', label: string, type = 'text', required = false) => (
    <div className="editions-field">
      <label htmlFor={`edition-${key}`}>{label}</label>
      <input autoFocus={key === 'code'} id={`edition-${key}`} type={type} required={required} value={draft[key] ?? ''}
        onChange={e => {
          if (key === 'year') set('year', Number(e.target.value));
          else if (key === 'exam_date') setDraft(d => ({ ...d, exam_date: e.target.value || null, exam_date_confirmed: e.target.value ? d.exam_date_confirmed : false }));
          else set(key, e.target.value || (required ? '' : null));
        }} />
    </div>
  );
  return <form className="rounded-xl border border-admin-line bg-admin-surface p-4 sm:p-7" onSubmit={async e => {
    e.preventDefault(); if (saving) return;
    setSaving(true); setError('');
    try { await adminEditionsApi.upsert(draft); onSaved(); }
    catch { setError('Não foi possível salvar a edição. Confira os campos e tente salvar novamente. Seus valores foram mantidos.'); requestAnimationFrame(() => errorRef.current?.focus()); }
    finally { setSaving(false); }
  }}>
    <h2 className="text-xl font-bold">{initial.id ? 'Editar edição' : 'Nova edição'}</h2>
    {error && <p ref={errorRef} tabIndex={-1} role="alert" className="mt-4 text-sm text-admin-text">{error}</p>}
    <fieldset disabled={saving}><legend>Identificação</legend><div className="editions-fields">
      {field('code', 'Código', 'text', true)}{field('label', 'Rótulo', 'text', true)}{field('year', 'Ano', 'number', true)}
      <div className="editions-field"><label htmlFor="edition-term">Termo</label><select id="edition-term" value={draft.term ?? ''} onChange={e => set('term', e.target.value ? Number(e.target.value) as 1 | 2 : null)}><option value="">Sem termo</option><option value="1">1</option><option value="2">2</option></select></div>
      <div className="editions-field"><label htmlFor="edition-status">Status</label><select id="edition-status" value={draft.status} onChange={e => set('status', e.target.value as EditionStatus)}>{Object.entries(editionStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
    </div></fieldset>
    <fieldset disabled={saving}><legend>Calendário oficial</legend><p className="mb-4 text-sm text-admin-muted">Estas datas não são a janela de execução dos simulados. Sem data: aguardando divulgação do Inep.</p><div className="editions-fields">
      {field('exam_date', 'Data da prova', 'date')}{field('official_results_at', 'Resultado oficial', 'date')}
      <div className="flex items-center gap-3"><input id="edition-confirmed" type="checkbox" disabled={!draft.exam_date || saving} checked={draft.exam_date_confirmed} onChange={e => set('exam_date_confirmed', e.target.checked)} /><label htmlFor="edition-confirmed">Data confirmada</label></div>
    </div></fieldset>
    <fieldset disabled={saving}><legend>Formato</legend><div className="editions-fields">
      {([['questions','Questões'],['options','Alternativas'],['duration_minutes','Duração (minutos)']] as const).map(([key,label]) => <div key={key} className="editions-field"><label htmlFor={`edition-${key}`}>{label}</label><input id={`edition-${key}`} type="number" min="1" step="1" required value={draft.format[key]} onChange={e => set('format', { ...draft.format, [key]: Number(e.target.value) })} /></div>)}
      <div className="editions-field"><label htmlFor="edition-scoring">Pontuação oficial</label><select id="edition-scoring" value={draft.format.scoring} onChange={e => set('format', { ...draft.format, scoring: e.target.value as 'tri' | 'raw' })}><option value="tri">TRI</option><option value="raw">Acertos</option></select></div>
      <div className="editions-field"><label htmlFor="edition-proficient">Referência de proficiência (opcional)</label><input id="edition-proficient" type="number" min="0" step="any" value={draft.format.proficient_min ?? ''} onChange={e => {
        const format = { ...draft.format }; if (e.target.value === '') delete format.proficient_min; else format.proficient_min = Number(e.target.value); set('format', format);
      }} /></div>
    </div><p className="mt-4 text-sm text-admin-muted">TRI oficial não significa nota calibrada do simulado.</p></fieldset>
    <fieldset disabled={saving}><legend>Referências</legend><div className="editions-fields">
      <div className="editions-field"><label htmlFor="edition-blueprint">Matriz</label><select id="edition-blueprint" value={draft.blueprint_id ?? ''} onChange={e => set('blueprint_id', e.target.value || null)}><option value="">Não definida</option>{blueprints.map(b => <option key={b.id} value={b.id}>{b.label}{b.weights_provisional ? ' (pesos provisórios)' : ''}</option>)}</select></div>
      {field('cutoff_reference_label', 'Referência do corte (opcional)')}
    </div></fieldset>
    <div className="mt-7 flex flex-col-reverse justify-end gap-3 sm:flex-row"><Button type="button" variant="outline" disabled={saving} onClick={onCancel}>Cancelar</Button><Button type="submit" disabled={saving}>{saving ? 'Salvando...' : 'Salvar edição'}</Button></div>
  </form>;
}
