import { useId } from 'react';
import { useAppConfig } from '@/hooks/useAppConfig';
import { useExamEditions } from '@/hooks/useExamEditions';
import { resolveUserEdition } from '@/lib/editions';
import { Button } from '@/components/ui/button';
import type { EditionTargetProfile } from '@/types/edition';

export type EditionTargetValue = Required<Pick<EditionTargetProfile, 'expectedGraduationTerm'>> & {
  targetEditionId: string | null | undefined;
};

type Props = { value: EditionTargetValue; onChange: (value: EditionTargetValue) => void; disabled?: boolean };

export function EditionTargetPicker(props: Props) {
  const enabled = useAppConfig('editions_ui');
  return enabled ? <Picker {...props} /> : null;
}

function Picker({ value, onChange, disabled = false }: Props) {
  const id = useId();
  const query = useExamEditions();
  const editions = query.isSuccess ? query.data ?? [] : [];
  const [year = '', term = ''] = value.expectedGraduationTerm?.split('.') ?? [];
  const suggestion = query.isSuccess ? resolveUserEdition(editions, {
    targetEditionId: null, expectedGraduationTerm: /^\d{4}\.[12]$/.test(value.expectedGraduationTerm ?? '') ? value.expectedGraduationTerm : null,
  }, query.now) : null;
  const updateGraduation = (nextYear: string, nextTerm: string) => onChange({
    ...value, expectedGraduationTerm: nextYear || nextTerm ? `${nextYear}.${nextTerm}` : null,
  });
  const fieldClass = 'min-h-11 w-full min-w-0 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60';
  return <div className="min-w-0 space-y-5">
    <fieldset disabled={disabled} className="min-w-0 space-y-3">
      <legend className="text-sm font-semibold">Quando você conclui o curso? <span className="font-normal text-muted-foreground">Opcional</span></legend>
      <p id={`${id}-graduation-help`} className="text-xs text-muted-foreground">Preencha ano e semestre, ou deixe os dois em branco.</p>
      <div className="grid grid-cols-2 gap-3">
        <label className="min-w-0 space-y-2 text-sm"> <span className="block">Ano de conclusão</span>
          <input className={fieldClass} inputMode="numeric" maxLength={4} value={year} aria-describedby={`${id}-graduation-help`} onChange={event => updateGraduation(event.target.value.replace(/\D/g, ''), term)} />
        </label>
        <label className="min-w-0 space-y-2 text-sm"><span className="block">Semestre de conclusão</span>
          <select className={fieldClass} value={term} aria-describedby={`${id}-graduation-help`} onChange={event => updateGraduation(year, event.target.value)}>
            <option value="">Não informar</option><option value="1">1º semestre</option><option value="2">2º semestre</option>
          </select>
        </label>
      </div>
    </fieldset>
    <p role="status" className="min-h-16 rounded-xl bg-muted p-3 text-xs leading-relaxed text-muted-foreground [overflow-wrap:anywhere]">
      {suggestion ? <>Sugestão: <strong className="text-foreground">{suggestion.label}</strong>. Confira sua escolha abaixo. A sugestão não seleciona uma edição nem confirma calendário ou edital.</> : 'Sem sugestão no catálogo disponível. Você pode escolher uma edição ou Ainda não sei.'}
    </p>
    <fieldset disabled={disabled} className="min-w-0 space-y-3" aria-describedby={`${id}-choice-help`}>
      <legend className="text-sm font-semibold">Qual edição é o seu alvo?</legend>
      <p id={`${id}-choice-help`} className="text-xs text-muted-foreground">Escolha uma edição ou marque Ainda não sei. Você pode alterar depois nas configurações.</p>
      <div className="min-h-44 space-y-2" aria-busy={query.isPending}>
        {!query.isSuccess || editions.length === 0 ? <div className="min-h-44 rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
          <p>{query.isPending ? 'Carregando edições…' : query.isError ? 'Não foi possível carregar as edições.' : 'Nenhuma edição disponível no catálogo.'}</p>
          <p className="mt-1 text-xs">Ainda não sei continua disponível.</p>
          {!query.isPending && <Button type="button" variant="outline" className="mt-3 min-h-11" onClick={() => void query.refetch()}>Tentar novamente</Button>}
        </div> : editions.map(edition => <label key={edition.id} className="flex min-h-16 min-w-0 cursor-pointer items-start gap-3 rounded-xl border border-border p-4 has-[:checked]:border-primary has-[:checked]:bg-accent">
          <input type="radio" className="mt-1 h-4 w-4 shrink-0 accent-primary focus-visible:outline-ring" name={`${id}-edition`} value={edition.id} checked={value.targetEditionId === edition.id} onChange={() => onChange({ ...value, targetEditionId: edition.id })} />
          <span className="min-w-0 [overflow-wrap:anywhere]"><strong className="block text-sm">{edition.label}</strong><span className="block text-xs text-muted-foreground">{edition.code}{!edition.exam_date_confirmed ? ' · Aguardando divulgação do Inep' : ''}</span></span>
        </label>)}
      </div>
      <label className="flex min-h-16 cursor-pointer items-start gap-3 rounded-xl border border-border p-4 has-[:checked]:border-primary has-[:checked]:bg-accent">
        <input type="radio" className="mt-1 h-4 w-4 shrink-0 accent-primary focus-visible:outline-ring" name={`${id}-edition`} checked={value.targetEditionId === null} onChange={() => onChange({ ...value, targetEditionId: null })} />
        <span><strong className="block text-sm">Ainda não sei</strong><span className="text-xs text-muted-foreground">Tudo bem decidir depois.</span></span>
      </label>
    </fieldset>
  </div>;
}

export function EditionTargetSummary({ value }: { value: EditionTargetValue }) {
  const query = useExamEditions();
  const edition = query.isSuccess ? query.data?.find(item => item.id === value.targetEditionId) : null;
  return <dl className="space-y-1 rounded-xl border border-border p-4 text-sm [overflow-wrap:anywhere]">
    <dt className="text-muted-foreground">Edição-alvo</dt><dd>{value.targetEditionId ? edition?.label ?? 'Edição selecionada' : 'Ainda não sei'}</dd>
    <dt className="text-muted-foreground">Conclusão prevista</dt><dd>{value.expectedGraduationTerm ?? 'Não informada'}</dd>
  </dl>;
}
