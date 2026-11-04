import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { EditionsUiGate } from '@/admin/components/EditionsUiGate';
import { AdminPageHeader } from '@/admin/components/ui/AdminPageHeader';
import { adminEditionsApi } from '@/admin/services/adminEditionsApi';
import { adminCutoffApi } from '@/admin/services/adminCutoffApi';
import { cutoffIssueMessage, cutoffRowLabel, parseCutoffFile, validateCutoffRows } from '@/admin/lib/cutoffImport';
import { toast } from '@/hooks/use-toast';
import type { ExamEdition } from '@/types/edition';
import type { CutoffCatalog, CutoffIssue, CutoffPreview } from '@/types/admin-operations';

function Content() {
  const [editions, setEditions] = useState<ExamEdition[]>([]);
  const [catalog, setCatalog] = useState<CutoffCatalog | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [reference, setReference] = useState('');
  const [source, setSource] = useState('');
  const [raw, setRaw] = useState<Record<string, string>[]>([]);
  const [filename, setFilename] = useState('');
  const [preview, setPreview] = useState<CutoffPreview | null>(null);
  const [serverErrors, setServerErrors] = useState<CutoffIssue[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const lock = useRef(false);
  const completed = useRef(new Set<string>());
  const feedback = useRef<HTMLDivElement>(null);
  const fingerprint = JSON.stringify([reference, source.trim(), raw]);
  const saved = completed.current.has(fingerprint);
  const edition = editions.find(item => item.id === reference);
  const invalidate = () => { setPreview(null); setServerErrors([]); setMessage(''); };
  const focusFeedback = () => requestAnimationFrame(() => feedback.current?.focus());

  const load = async () => {
    setLoading(true); setLoadError('');
    try {
      const e = await adminEditionsApi.list();
      const c = await adminCutoffApi.catalog();
      setEditions(e); setCatalog(c);
    } catch { setLoadError('Não foi possível carregar o catálogo. Seus campos foram mantidos.'); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, []);

  const upload = async (file?: File) => {
    if (!file || lock.current) return;
    lock.current = true; setBusy(true); invalidate();
    try {
      const rows = await parseCutoffFile(file);
      setRaw(rows); setFilename(file.name);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível ler o arquivo. Envie novamente.'); focusFeedback();
    } finally { lock.current = false; setBusy(false); }
  };

  const check = async () => {
    if (lock.current || saved || !catalog) return;
    invalidate();
    if (!edition || !source.trim() || !raw.length) {
      setMessage('Selecione uma edição, declare a fonte e carregue um lote não vazio.'); focusFeedback(); return;
    }
    lock.current = true; setBusy(true);
    try {
      // Always refresh both canonical names and conflicts, including after uncertain outcomes.
      const current = await adminCutoffApi.catalog();
      const existing = await adminCutoffApi.existing(reference);
      setCatalog(current);
      setPreview(validateCutoffRows(raw, current, existing));
      focusFeedback();
    } catch {
      setMessage('Falha na conferência do banco. Nenhum envio foi iniciado. Confira sua conexão e tente conferir novamente.'); focusFeedback();
    } finally { lock.current = false; setBusy(false); }
  };

  const confirm = async () => {
    if (lock.current || saved || !preview || preview.errors.length || !edition || !source.trim()) return;
    lock.current = true; setBusy(true); setMessage(''); setServerErrors([]);
    try {
      const result = await adminCutoffApi.import(reference, source, preview.rows);
      if (result.ok) {
        completed.current.add(fingerprint);
        setMessage(`${result.imported} registro(s) importado(s).`);
        toast({ title: 'Lote de cortes importado', description: 'Todos os registros foram confirmados pelo servidor.' });
      } else {
        setServerErrors(result.errors); setPreview(null);
        setMessage('Lote recusado pelo servidor. 0 registros importados. Corrija o arquivo e confira novamente.');
      }
    } catch {
      setPreview(null);
      setMessage('Resultado incerto. Confira os registros e a auditoria antes de tentar novamente. Use Conferir lote para revalidar a disponibilidade no banco; não houve repetição automática.');
    } finally { lock.current = false; setBusy(false); focusFeedback(); }
  };

  return <div className="max-w-[1200px] space-y-6 text-admin-text">
    <AdminPageHeader title="Importar cortes" subtitle="Confira a origem e o lote completo antes de importar." />
    <p className="text-sm text-admin-muted">Cortes são estimativas de referência. Escalas e provas distintas não são diretamente comparáveis. Nenhum registro legado será sobrescrito ou atribuído a outro processo.</p>
    {loading ? <p role="status">Carregando catálogo...</p> : loadError ? <div role="alert"><p>{loadError}</p><Button variant="outline" onClick={load}>Tentar novamente</Button></div>
      : !editions.length || !catalog?.institutions.length || !catalog?.specialties.length ? <div className="rounded-xl border border-admin-line bg-admin-surface p-6"><h2 className="font-semibold">Catálogo indisponível para importação</h2><p className="mt-2 text-sm">Cadastre edições, instituições e especialidades antes de importar cortes.</p><Button variant="outline" className="mt-4" onClick={load}>Recarregar catálogo</Button></div>
      : <>
        <fieldset disabled={busy} className="min-w-0 space-y-5 rounded-xl border border-admin-line bg-admin-surface p-4 sm:p-6">
          <legend className="px-1 font-semibold">1. Origem e arquivo</legend>
          <div className="grid gap-5 md:grid-cols-2">
            <div><label className="mb-2 block text-sm font-medium" htmlFor="cutoff-reference">Edição de referência</label>
              <select id="cutoff-reference" className="min-h-11 w-full rounded-md border border-admin-line bg-admin-surface px-3 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-admin-accent" value={reference} onChange={e => { setReference(e.target.value); invalidate(); }}>
                <option value="">Selecione explicitamente</option>{editions.map(e => <option key={e.id} value={e.id}>{e.label}</option>)}
              </select></div>
            <div><label className="mb-2 block text-sm font-medium" htmlFor="cutoff-source">Fonte declarada</label><Input id="cutoff-source" className="min-h-11" value={source} onChange={e => { setSource(e.target.value); invalidate(); }} aria-describedby="cutoff-source-help" /><p id="cutoff-source-help" className="mt-2 text-sm text-admin-muted">Informe o processo e a publicação de origem. Não há fonte oficial preenchida automaticamente.</p></div>
          </div>
          {edition && <p className="break-words text-sm">Referência/processo no catálogo: <strong>{edition.cutoff_reference_label || 'Não informado no catálogo'}</strong>. Destino: <strong>{edition.label}</strong>.</p>}
          <div><label htmlFor="cutoff-file" className="mb-2 block text-sm font-medium">Arquivo CSV ou XLSX</label><input id="cutoff-file" type="file" accept=".csv,.xlsx" className="block min-h-11 w-full min-w-0 text-sm file:mr-3 file:min-h-11 file:rounded-md file:border file:border-admin-line file:bg-admin-raised file:px-3 file:text-admin-text" onChange={e => { void upload(e.target.files?.[0]); e.target.value = ''; }} aria-describedby="cutoff-format" />
            <p id="cutoff-format" className="mt-2 break-words text-sm text-admin-muted">Cabeçalhos: instituicao; especialidade; cenario; ampla; cotas; vagas. Use nomes completos do catálogo. XLSX: primeira aba. Cotas e vagas são opcionais; vagas vazias viram 0.</p>
            {filename && <p className="mt-2 break-all text-sm">{filename} · {raw.length} registro(s)</p>}</div>
          <Button className="min-h-11" variant="outline" disabled={saved} onClick={check}>{busy ? 'Processando...' : 'Conferir lote'}</Button>
        </fieldset>
        <div ref={feedback} tabIndex={-1} className="space-y-3 rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-admin-accent" aria-live="polite">
          {message && <p role={saved ? 'status' : 'alert'} className="rounded-lg border border-admin-line bg-admin-raised p-4 text-sm">{message}</p>}
          {serverErrors.length > 0 && <ul className="space-y-2 text-sm" aria-label="Erros do servidor">{serverErrors.map((issue, index) => <li key={index}>{issue.row ? `${cutoffRowLabel(raw, issue.row)} · ` : ''}{cutoffIssueMessage(issue)}</li>)}</ul>}
          {preview && <section className="space-y-4 rounded-xl border border-admin-line bg-admin-surface p-4 sm:p-6" aria-label="Prévia do lote">
            <h2 className="font-semibold">2. Conferência do lote</h2>
            <p className="break-words text-sm">{edition?.label} · {source} · {filename}. Uma linha inválida bloqueia todo o lote. Conflitos não serão sobrescritos.</p>
            {preview.errors.length ? <ul className="space-y-2 text-sm" role="alert">{preview.errors.map((issue, index) => <li key={index}>{issue.row ? `${cutoffRowLabel(raw, issue.row)} · ${issue.field}: ` : ''}{issue.message}</li>)}</ul> : <p className="text-sm">Lote válido na conferência. O servidor fará a validação final.</p>}
            <div className="max-h-[480px] overflow-auto rounded-lg border border-admin-line" tabIndex={0} role="region" aria-label="Registros conferidos">
              <table className="w-full text-left text-sm"><caption className="p-3 text-left">Nomes canônicos e valores que serão enviados, com a localização original no arquivo.</caption><thead><tr>{['Origem', 'Instituição', 'Especialidade', 'Cenário', 'Ampla', 'Cotas', 'Vagas'].map(label => <th className="p-3" scope="col" key={label}>{label}</th>)}</tr></thead><tbody>{preview.rows.map((row, index) => <tr key={index} className="border-t border-admin-line align-top">
                <td className="p-3 tabular-nums">{cutoffRowLabel(raw, index + 1)}</td><td className="min-w-40 break-words p-3">{catalog.institutions.find(i => i.id === row.institution_id)?.name || 'Sem correspondência'}</td><td className="min-w-36 break-words p-3">{catalog.specialties.find(s => s.id === row.specialty_id)?.name || 'Sem correspondência'}</td><td className="p-3">{row.practice_scenario || 'Sem cenário'}</td><td className="p-3 tabular-nums">{Number.isFinite(row.cutoff_score_general) ? row.cutoff_score_general : 'Inválido'}</td><td className="p-3 tabular-nums">{row.cutoff_score_quota ?? 'Não informado'}</td><td className="p-3 tabular-nums">{row.vagas}</td>
              </tr>)}</tbody></table>
            </div>
            {!preview.errors.length && !saved && <Button className="min-h-11" disabled={busy} onClick={confirm}>{busy ? 'Importando...' : 'Confirmar importação do lote'}</Button>}
          </section>}
        </div>
      </>}
  </div>;
}

export default function AdminCutoffImport() { return <EditionsUiGate><Content /></EditionsUiGate>; }
