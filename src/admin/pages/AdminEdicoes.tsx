import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { AdminPageHeader } from '@/admin/components/ui/AdminPageHeader';
import { EditionsUiGate } from '@/admin/components/EditionsUiGate';
import { EditionForm } from '@/admin/components/editions/EditionForm';
import { editionStatusLabels } from '@/admin/components/editions/constants';
import { adminEditionsApi } from '@/admin/services/adminEditionsApi';
import { validateExamFormat } from '@/lib/edition-format';
import type { ExamEdition, ExamBlueprint } from '@/types/edition';
import type { EditionDraft } from '@/types/edition-admin';
import '@/admin/components/editions/editions.css';

const blank: EditionDraft = { code: '', year: 2027, term: null, label: '', status: 'planned', exam_date: null,
  exam_date_confirmed: false, official_results_at: null, format: { questions: 100, options: 4, duration_minutes: 300, scoring: 'tri' }, blueprint_id: null, cutoff_reference_label: null };

function Content() {
  const [editions, setEditions] = useState<ExamEdition[]>([]);
  const [blueprints, setBlueprints] = useState<ExamBlueprint[]>([]);
  const [draft, setDraft] = useState<EditionDraft | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const trigger = useRef<HTMLButtonElement | null>(null);
  const load = () => {
    setLoading(true); setError('');
    Promise.all([adminEditionsApi.list(), adminEditionsApi.blueprints()]).then(([e,b]) => { setEditions(e); setBlueprints(b); })
      .catch(() => setError('Não foi possível carregar as edições. Tente novamente.')).finally(() => setLoading(false));
  };
  useEffect(load, []);
  const close = () => { setDraft(null); requestAnimationFrame(() => trigger.current?.focus()); };
  return <div className="editions-experience">
    <AdminPageHeader title="Edições" subtitle="Organize o calendário e o formato de cada edição." actions={!draft && <Button disabled={loading || !!error} onClick={e => { trigger.current=e.currentTarget; setSaved(false); setDraft(blank); }}>Nova edição</Button>} />
    {saved && <p role="status" className="mb-5 rounded-md border border-admin-line bg-admin-raised p-4 text-sm">Edição salva.</p>}
    {draft ? <EditionForm initial={draft} blueprints={blueprints} onCancel={close} onSaved={() => { close(); setSaved(true); load(); }} />
      : loading ? <div role="status" className="min-h-[276px] rounded-xl border border-admin-line bg-admin-surface p-7">Carregando edições...</div>
      : error ? <div role="alert" className="rounded-xl border border-admin-line bg-admin-surface p-7"><p>{error}</p><Button className="mt-4" variant="outline" onClick={load}>Tentar novamente</Button></div>
      : editions.length === 0 ? <div className="min-h-[276px] rounded-xl border border-admin-line bg-admin-surface p-7"><h2 className="text-xl font-bold">Nenhuma edição cadastrada</h2><p className="mt-2 text-sm text-admin-muted">Use Nova edição para preparar o calendário.</p></div>
      : <div className="min-h-[276px] rounded-xl border border-admin-line bg-admin-surface"><table className="editions-table"><caption>Calendário oficial e preparação das edições</caption><colgroup>{['13%','29%','17%','27%','14%'].map(w => <col key={w} style={{ width: w }} />)}</colgroup><thead><tr>{['Código','Edição','Status','Data da prova','Ação'].map(h => <th scope="col" key={h}>{h}</th>)}</tr></thead><tbody>{editions.map(edition => <tr key={edition.id}>
        <td className="font-bold tabular-nums"><span className="editions-cell-label">Código</span>{edition.code}</td><td><span className="editions-cell-label">Edição</span>{edition.label}</td><td><span className="editions-cell-label">Status</span>{editionStatusLabels[edition.status]}</td><td className="tabular-nums"><span className="editions-cell-label">Data da prova</span>{edition.exam_date ? `${edition.exam_date.split('-').reverse().join('/')}${edition.exam_date_confirmed ? ' · Confirmada' : ' · Não confirmada'}` : 'Aguardando divulgação do Inep'}</td><td><Button variant="ghost" aria-label={`Editar ${edition.code}`} onClick={e => {
          const format = validateExamFormat(edition.format);
          if (!format.valid) { setError('Formato da edição inválido. Revise os dados antes de editar.'); return; }
          trigger.current=e.currentTarget; setSaved(false); setDraft({ ...edition, format: format.value, blueprint_id: edition.blueprint_id ?? null, cutoff_reference_label: edition.cutoff_reference_label ?? null });
        }}>Editar</Button></td>
      </tr>)}</tbody></table></div>}
  </div>;
}

export default function AdminEdicoes() { return <EditionsUiGate><Content /></EditionsUiGate>; }
