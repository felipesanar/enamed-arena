import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { EditionsUiGate } from '@/admin/components/EditionsUiGate';
import { AdminPageHeader } from '@/admin/components/ui/AdminPageHeader';
import { QuestionBankVersionDialog } from '@/admin/components/QuestionBankVersionDialog';
import { questionBankApi } from '@/services/questionBankApi';
import { Button } from '@/components/ui/button';
import type { QuestionBankListItem } from '@/types/question-bank';

function BankContent() {
  const { user, loading } = useAuth();
  const [draftSearch, setDraftSearch] = useState('');
  const [search, setSearch] = useState('');
  const [offset, setOffset] = useState(0);
  const [selection, setSelection] = useState<{ userId: string; bank: QuestionBankListItem } | null>(null);
  const enabled = !!user && !loading;
  const query = useQuery({ queryKey: ['question-bank', user?.id ?? null, search, offset], enabled,
    queryFn: () => questionBankApi.list(user!.id, { search, offset }), staleTime: 5 * 60 * 1000, retry: false });
  const page = enabled && query.isSuccess ? query.data : undefined;
  const selectedBank = selection && selection.userId === user?.id ? selection.bank : null;
  return <div className="min-w-0">
    <AdminPageHeader title="Banco de questões" subtitle="Identidades, versões observadas e reuso explícito em rascunhos." />
    <form className="mb-5 flex max-w-2xl flex-wrap items-end gap-3" onSubmit={event => { event.preventDefault(); setSearch(draftSearch.trim()); setOffset(0); }}>
      <div className="min-w-0 flex-1"><label htmlFor="question-bank-search" className="mb-2 block text-caption font-medium">Buscar pelo enunciado</label><input id="question-bank-search" value={draftSearch} onChange={event => setDraftSearch(event.target.value)} maxLength={500} placeholder="Buscar pelo enunciado" className="min-h-11 w-full rounded-lg border border-admin-line bg-admin-surface px-3 text-body text-admin-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-admin-accent" /></div><Button type="submit" variant="outline" className="min-h-11">Buscar</Button>
    </form>
    {!enabled ? <p className="text-body text-admin-muted">Faça login para consultar o banco de questões.</p>
      : query.isPending ? <div role="status" className="min-h-60 rounded-xl border border-admin-line bg-admin-surface p-6">Carregando banco de questões...</div>
      : query.isError ? <div role="alert" className="rounded-xl border border-admin-line bg-admin-surface p-6"><p>Não foi possível carregar o banco de questões.</p><Button className="mt-4 min-h-11" variant="outline" onClick={() => void query.refetch()}>Tentar novamente</Button></div>
      : <section className="min-w-0 rounded-xl border border-admin-line bg-admin-surface p-5 md:p-6">
        <p className="mb-4 text-caption text-admin-muted">{page?.total ?? 0} identidades encontradas. Textos iguais não mesclam identidades.</p>
        {!page?.items.length ? <p className="py-8 text-body text-admin-muted">Nenhuma questão encontrada neste contexto.</p> : <table className="w-full table-fixed text-caption text-admin-text"><caption className="sr-only">Identidades preservadas no banco</caption><thead className="sr-only md:not-sr-only"><tr>{['Questão','Versão observada','Usos ativos','Ação'].map(label => <th key={label} scope="col" className="border-b border-admin-line py-3 text-left font-medium text-admin-muted">{label}</th>)}</tr></thead><tbody>{page.items.map(bank => <tr key={bank.bank_id} className="block border-b border-admin-line py-3 last:border-0 md:table-row">
          <td className="grid grid-cols-[104px_minmax(0,1fr)] gap-3 py-1.5 pr-3 md:table-cell md:py-3"><span className="text-admin-muted md:hidden">Questão</span><span className="break-words">{bank.title || 'Enunciado indisponível'}</span></td>
          <td className="grid grid-cols-[104px_minmax(0,1fr)] gap-3 py-1.5 pr-3 md:table-cell md:py-3"><span className="text-admin-muted md:hidden">Versão</span><span className="tabular-nums">{bank.latest_version_number}<span className="mt-1 block text-admin-muted">{bank.latest_state === 'incomplete' ? 'Incompleta' : 'Completa'}</span></span></td>
          <td className="grid grid-cols-[104px_minmax(0,1fr)] gap-3 py-1.5 pr-3 md:table-cell md:py-3"><span className="text-admin-muted md:hidden">Usos ativos</span><span className="tabular-nums">{bank.usage_count}</span></td>
          <td className="grid grid-cols-[104px_minmax(0,1fr)] gap-3 py-1.5 md:table-cell md:py-3"><span className="text-admin-muted md:hidden">Ação</span><Button variant="outline" className="min-h-11" aria-label={`Ver versões: ${bank.title || 'questão'}`} onClick={() => setSelection({ userId: user!.id, bank })}>Ver versões</Button></td>
        </tr>)}</tbody></table>}
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3"><p className="text-caption text-admin-muted">Página {Math.floor(offset / 50) + 1} • 50 por página</p><div className="flex gap-2"><Button variant="outline" className="min-h-11" disabled={offset === 0} onClick={() => setOffset(value => Math.max(0,value-50))}>Anterior</Button><Button variant="outline" className="min-h-11" disabled={!page || offset + 50 >= page.total} onClick={() => setOffset(value => value+50)}>Próxima</Button></div></div>
      </section>}
    {selectedBank && user && <QuestionBankVersionDialog key={`${user.id}:${selectedBank.bank_id}`} bank={selectedBank} open onOpenChange={open => { if (!open) setSelection(null); }} />}
  </div>;
}

export default function AdminQuestionBank() { return <EditionsUiGate><BankContent /></EditionsUiGate>; }
