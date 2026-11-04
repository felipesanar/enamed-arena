import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { useAdminCan } from '@/admin/contexts/AdminAccessContext';
import { editionAnalysisApi } from '@/services/editionAnalysisApi';
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

function RankingPolicyForm({ editions }: { editions: ExamEdition[] }) {
  const content = useAdminCan('content.manage');
  const intel = useAdminCan('intel.view');
  return content && intel ? <RankingPolicyFields editions={editions} /> : null;
}

function RankingPolicyFields({ editions }: { editions: ExamEdition[] }) {
  const { user } = useAuth();
  const client = useQueryClient();
  const [editionId, setEditionId] = useState('');
  const [bestN, setBestN] = useState('');
  const [minimum, setMinimum] = useState('');
  const [enabled, setEnabled] = useState(false);
  const [reason, setReason] = useState('');
  const [pending, setPending] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [message, setMessage] = useState('');
  const [saved, setSaved] = useState(false);
  const lock = useRef(false);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (lock.current || uncertain || !user) return;
    const n = Number(bestN), min = Number(minimum);
    if (!editionId || !editions.some(edition => edition.id === editionId) || !Number.isSafeInteger(n) || !Number.isSafeInteger(min) || n < 1 || min < 1 || min > n || !reason.trim()) { setSaved(false); setMessage('Selecione a edição, informe N e mínimo positivos (mínimo ≤ N) e justifique a política.'); return; }
    lock.current = true; setPending(true); setMessage(''); setSaved(false);
    try {
      await editionAnalysisApi.configureRanking(user.id, { editionId, bestN: n, minimumSimulados: min, enabled, reason: reason.trim() });
      void client.invalidateQueries({ queryKey: ['edition-ranking'], refetchType: 'none' });
      setSaved(true); setMessage('Política salva.');
    } catch (failure) {
      const code = failure && typeof failure === 'object' && 'code' in failure ? String(failure.code) : '';
      const known = ['55P03','22023','42501','P0003'].includes(code);
      setUncertain(!known);
      setMessage(known ? 'Não foi possível salvar a política. Revise a oferta de simulados, os parâmetros e sua permissão antes de repetir.' : 'Não foi possível confirmar a política. Atualize a página e confira o ranking antes de uma nova operação.');
    } finally { lock.current = false; setPending(false); }
  };
  const inputClass = 'min-h-11 w-full rounded-lg border border-admin-line bg-admin-surface px-3 text-body text-admin-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-admin-accent';
  return <section className="mt-6 rounded-xl border border-admin-line bg-admin-surface p-5 md:p-6"><h2 className="text-xl font-semibold text-admin-text">Política do ranking da edição</h2><p className="mt-2 max-w-[75ch] text-sm text-admin-muted">Informe todos os parâmetros. Eles substituem a política desta edição e a alteração fica registrada com sua justificativa. Sem uma regra ativa não há classificação.</p>
    <form onSubmit={event => void submit(event)} className="mt-5 space-y-4"><div className="grid gap-4 md:grid-cols-3"><div><label htmlFor="ranking-policy-edition" className="mb-2 block text-caption font-medium">Edição da política</label><select id="ranking-policy-edition" value={editionId} disabled={pending} onChange={event => setEditionId(event.target.value)} className={inputClass}><option value="">Selecione uma edição</option>{editions.map(edition => <option key={edition.id} value={edition.id}>{edition.label} ({edition.code})</option>)}</select></div><div><label htmlFor="ranking-policy-n" className="mb-2 block text-caption font-medium">Melhores simulados (N)</label><input id="ranking-policy-n" type="number" min="1" step="1" max="2147483647" value={bestN} onChange={event => setBestN(event.target.value)} disabled={pending} className={inputClass} /></div><div><label htmlFor="ranking-policy-minimum" className="mb-2 block text-caption font-medium">Mínimo de participações</label><input id="ranking-policy-minimum" type="number" min="1" step="1" max="2147483647" value={minimum} onChange={event => setMinimum(event.target.value)} disabled={pending} className={inputClass} /></div></div>
      <label className="flex min-h-11 items-center gap-3 text-body"><input type="checkbox" checked={enabled} onChange={event => setEnabled(event.target.checked)} disabled={pending} className="h-5 w-5" />Ranking ativo</label>
      <div><label htmlFor="ranking-policy-reason" className="mb-2 block text-caption font-medium">Justificativa da política</label><textarea id="ranking-policy-reason" value={reason} onChange={event => setReason(event.target.value)} maxLength={2000} disabled={pending} className={`${inputClass} min-h-24 py-3`} /></div>
      {message && <p role={saved ? 'status' : 'alert'} className={`text-caption ${saved ? 'text-admin-text' : 'text-destructive'}`}>{message}</p>}
      <Button type="submit" className="min-h-11" disabled={pending || uncertain || !user}>{pending ? 'Salvando...' : 'Salvar política'}</Button>
    </form>
  </section>;
}

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
    {!draft && !loading && !error && <RankingPolicyForm editions={editions} />}
  </div>;
}

export default function AdminEdicoes() { return <EditionsUiGate><Content /></EditionsUiGate>; }
