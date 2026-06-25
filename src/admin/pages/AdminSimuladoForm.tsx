import { AdminCapabilityGate } from '@/admin/components/AdminCapabilityGate'
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Check, Clock3, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AdminPageHeader } from '@/admin/components/ui/AdminPageHeader';
import { AdminPanel } from '@/admin/components/ui/AdminPanel';
import { AdminSectionHeader } from '@/admin/components/ui/AdminSectionHeader';
import { adminApi } from '../services/adminApi';
import { toast } from '@/hooks/use-toast';
import { logger } from '@/lib/logger';
import { validateWindows, windowWarnings } from '@/admin/lib/validateWindows';
import { localInputToUtcISO, utcISOToLocalInput, formatWindowSummary } from '@/admin/lib/timezone';
import { slugify } from '@/admin/lib/slugify';

/** Classes admin para inputs (tema control-room sem editar o componente shadcn) */
const inputCls = 'bg-admin-bg border-admin-line-strong text-admin-text placeholder:text-admin-faint';
const inputMonoCls = `${inputCls} font-mono`;

const empty = {
  title: '',
  slug: '',
  sequence_number: 1,
  description: '',
  duration_minutes: 300,
  questions_count: 0,
  execution_window_start: '',
  execution_window_end: '',
  results_release_at: '',
  theme_tags: '' as string,
  status: 'draft' as 'draft' | 'published' | 'test',
};

/** dd/mm rótulo curto a partir do valor do <input datetime-local> (hora de Brasília). */
function shortDate(local: string): string {
  if (!local) return '--/--';
  const [d] = local.split('T');
  const [, mo, da] = d.split('-');
  if (!mo || !da) return '--/--';
  return `${da}/${mo}`;
}

/**
 * Posição das marcas da linha do tempo (0 a 100).
 * Mantém uma folga antes da abertura e depois do fechamento para o trecho verde
 * "vale para ranking" ficar sempre visível e dentro da barra. A liberação de
 * resultados (quando posterior ao fim) aparece como marca no trecho da folga.
 */
function timelinePositions(start: string, end: string, release: string) {
  const PAD_LEFT = 18;
  const PAD_RIGHT = 18;
  const ts = start ? new Date(start).getTime() : NaN;
  const te = end ? new Date(end).getTime() : NaN;
  const tr = release ? new Date(release).getTime() : NaN;

  // Sem datas válidas: placeholder centralizado.
  if (!Number.isFinite(ts) || !Number.isFinite(te) || te <= ts) {
    return { startPct: PAD_LEFT, endPct: 100 - PAD_RIGHT, releasePct: null as number | null, ready: false };
  }

  const startPct = PAD_LEFT;
  const endPct = 100 - PAD_RIGHT;

  let releasePct: number | null = null;
  if (Number.isFinite(tr) && tr >= te) {
    // Escala: do início da janela até a liberação ocupa de PAD_LEFT até 100.
    const total = tr - ts;
    if (total > 0) {
      const usable = 100 - PAD_LEFT;
      releasePct = PAD_LEFT + ((tr - ts) / total) * usable;
      // Garante que o fim (te) caia na posição endPct reescalando o verde.
      const endScaled = PAD_LEFT + ((te - ts) / total) * usable;
      return { startPct, endPct: endScaled, releasePct: Math.min(releasePct, 98), ready: true };
    }
  }

  return { startPct, endPct, releasePct, ready: true };
}

function FormSkeleton() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="h-8 w-64 rounded bg-admin-raised" />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.3fr_1fr]">
        <div className="space-y-4">
          <div className="h-24 rounded-lg bg-admin-raised" />
          <div className="h-24 rounded-lg bg-admin-raised" />
          <div className="h-32 rounded-lg bg-admin-raised" />
        </div>
        <div className="space-y-4">
          <div className="h-40 rounded-lg bg-admin-raised" />
          <div className="h-28 rounded-lg bg-admin-raised" />
        </div>
      </div>
    </div>
  );
}

function AdminSimuladoFormContent() {
  const { id } = useParams();
  const isEdit = !!id && id !== 'novo';
  const navigate = useNavigate();
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(isEdit);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [slugTouched, setSlugTouched] = useState(false);
  const [realCount, setRealCount] = useState<number | null>(null);

  const loadSimulado = () => {
    if (!isEdit) return;
    setLoading(true);
    setLoadError(null);
    adminApi.getSimulado(id!)
      .then(s => {
        setForm({
          title: s.title,
          slug: s.slug,
          sequence_number: s.sequence_number,
          description: s.description,
          duration_minutes: s.duration_minutes,
          questions_count: s.questions_count,
          execution_window_start: utcISOToLocalInput(s.execution_window_start),
          execution_window_end: utcISOToLocalInput(s.execution_window_end),
          results_release_at: utcISOToLocalInput(s.results_release_at),
          theme_tags: s.theme_tags.join(', '),
          status: s.status as 'draft' | 'published' | 'test',
        });
      })
      .catch((err: any) => {
        logger.error('[AdminSimuladoForm] Falha ao carregar simulado:', err);
        setLoadError('Não foi possível carregar este simulado. Tente novamente.');
      })
      .finally(() => setLoading(false));
    adminApi.getQuestionsCount(id!).then(setRealCount).catch(() => setRealCount(null));
  };

  useEffect(loadSimulado, [id, isEdit]);

  const set = (k: string, v: any) => setForm(prev => ({ ...prev, [k]: v }));

  const handleTitleChange = (v: string) => {
    set('title', v);
    if (!isEdit && !slugTouched) {
      set('slug', slugify(v));
    }
  };

  const handleSlugChange = (v: string) => {
    setSlugTouched(true);
    set('slug', v);
  };

  // Avaliação ao vivo da janela para alimentar o painel "O que o aluno vê".
  const windowError = validateWindows(
    form.execution_window_start,
    form.execution_window_end,
    form.results_release_at,
  );
  const positions = useMemo(
    () => timelinePositions(form.execution_window_start, form.execution_window_end, form.results_release_at),
    [form.execution_window_start, form.execution_window_end, form.results_release_at],
  );
  const hasWindow = !!form.execution_window_start && !!form.execution_window_end && positions.ready;

  const persist = async (statusOverride?: 'draft' | 'published') => {
    const status = statusOverride ?? form.status;

    if (windowError) {
      toast({ title: windowError, variant: 'destructive' });
      return;
    }

    // Converte para UTC antes de avaliar avisos: o check "começa no passado" compara
    // contra agora e precisa do instante real (independe do fuso da máquina do admin).
    const warnings = windowWarnings(
      localInputToUtcISO(form.execution_window_start),
      localInputToUtcISO(form.execution_window_end),
      localInputToUtcISO(form.results_release_at),
      Number(form.duration_minutes),
    );
    if (warnings.length > 0) {
      toast({ title: 'Avisos sobre a janela', description: warnings.join(' ') });
    }

    setSaving(true);

    const payload = {
      title: form.title,
      slug: form.slug,
      sequence_number: Number(form.sequence_number),
      description: form.description,
      duration_minutes: Number(form.duration_minutes),
      // Em edição, persiste a contagem REAL de questões quando conhecida, evitando
      // re-gravar um valor defasado (o upload de questões já mantém este campo).
      questions_count: Number(isEdit && realCount != null ? realCount : form.questions_count),
      execution_window_start: localInputToUtcISO(form.execution_window_start),
      execution_window_end: localInputToUtcISO(form.execution_window_end),
      results_release_at: localInputToUtcISO(form.results_release_at),
      theme_tags: (form.theme_tags as string).split(',').map(t => t.trim()).filter(Boolean),
      status,
    };

    try {
      if (isEdit) {
        await adminApi.updateSimulado(id!, payload);
      } else {
        await adminApi.createSimulado(payload);
      }
      setForm(prev => ({ ...prev, status }));
      toast({
        title: status === 'published' ? 'Simulado publicado' : 'Rascunho salvo',
        description: status === 'published'
          ? 'Já fica visível para os alunos na janela de execução.'
          : 'Suas alterações foram guardadas. O aluno ainda não vê este simulado.',
      });
      navigate('/admin/simulados');
    } catch (err: any) {
      logger.error('[AdminSimuladoForm] Falha ao salvar:', err);
      toast({ title: 'Erro ao salvar', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void persist();
  };

  if (loading) {
    return <FormSkeleton />;
  }

  if (loadError) {
    return (
      <div className="max-w-5xl">
        <AdminPageHeader title="Editar simulado" subtitle="Dados da prova, janela de execução e publicação" />
        <AdminPanel className="border-admin-destructive/30">
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-admin-destructive/10">
              <AlertTriangle className="h-5 w-5 text-admin-destructive" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-admin-text">{loadError}</p>
              <div className="mt-3 flex gap-2">
                <Button type="button" onClick={loadSimulado}>Tentar de novo</Button>
                <Button
                  type="button"
                  variant="outline"
                  className="border-admin-line bg-transparent text-admin-muted hover:bg-admin-raised hover:text-admin-text"
                  onClick={() => navigate('/admin/simulados')}
                >
                  Voltar para a lista
                </Button>
              </div>
            </div>
          </div>
        </AdminPanel>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-5xl">
      <AdminPageHeader
        title={isEdit ? 'Editar simulado' : 'Novo simulado'}
        subtitle="Dados da prova, janela de execução e o que o aluno vê"
        actions={
          <>
            <Button
              type="button"
              variant="ghost"
              className="text-admin-muted hover:bg-admin-raised hover:text-admin-text"
              disabled={saving}
              onClick={() => void persist('draft')}
            >
              Salvar rascunho
            </Button>
            <Button
              type="button"
              disabled={saving}
              onClick={() => void persist('published')}
            >
              {saving ? 'Salvando...' : 'Publicar simulado'}
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.3fr_1fr]">
        {/* ─────────── Esquerda: formulário ─────────── */}
        <AdminPanel className="space-y-7">
          {/* Dados da prova */}
          <div className="space-y-4">
            <AdminSectionHeader title="Dados da prova" />
            <div className="space-y-2">
              <Label htmlFor="simulado-title">Título</Label>
              <Input
                id="simulado-title"
                className={inputCls}
                value={form.title}
                onChange={e => handleTitleChange(e.target.value)}
                required
              />
              <p className="text-xs text-admin-muted">É o nome que o aluno vê na lista de provas.</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Identificador (slug)</Label>
                <Input
                  className={inputMonoCls}
                  value={form.slug}
                  onChange={e => handleSlugChange(e.target.value)}
                  required
                  placeholder="simulado-1"
                />
              </div>
              <div className="space-y-2">
                <Label>Número da prova</Label>
                <Input
                  className={inputMonoCls}
                  type="number"
                  value={form.sequence_number}
                  onChange={e => set('sequence_number', e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tempo de prova (minutos)</Label>
                <Input
                  className={inputMonoCls}
                  type="number"
                  value={form.duration_minutes}
                  onChange={e => set('duration_minutes', e.target.value)}
                  required
                />
              </div>
              {isEdit && (
                <div className="space-y-2">
                  <Label>Número de questões</Label>
                  <Input
                    className={inputMonoCls}
                    type="number"
                    value={realCount ?? form.questions_count}
                    readOnly
                  />
                  <p className="text-xs text-admin-muted">Definido pelo upload de questões.</p>
                  {realCount != null && realCount !== form.questions_count && (
                    <p className="text-xs text-admin-warning">
                      O valor salvo ({form.questions_count}) difere do real ({realCount}).
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label>Descrição</Label>
              <Input
                className={inputCls}
                value={form.description}
                onChange={e => set('description', e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Tags de tema (separadas por vírgula)</Label>
              <Input
                className={inputCls}
                value={form.theme_tags}
                onChange={e => set('theme_tags', e.target.value)}
                placeholder="Clínica Médica, Cirurgia"
              />
            </div>
          </div>

          {/* Janela de execução */}
          <div className="space-y-3">
            <AdminSectionHeader title="Janela de execução" />
            <p className="text-[12.5px] leading-relaxed text-admin-muted">
              O período em que a prova vale para o ranking. Dentro da janela, a nota conta. Fora dela, o
              aluno ainda pode treinar, mas o resultado não entra na classificação.
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="window-start">Abre em <span className="font-normal text-admin-muted">(Brasília)</span></Label>
                <Input
                  id="window-start"
                  className={inputMonoCls}
                  type="datetime-local"
                  value={form.execution_window_start}
                  onChange={e => set('execution_window_start', e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="window-end">Fecha em <span className="font-normal text-admin-muted">(Brasília)</span></Label>
                <Input
                  id="window-end"
                  className={inputMonoCls}
                  type="datetime-local"
                  value={form.execution_window_end}
                  onChange={e => set('execution_window_end', e.target.value)}
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="results-release">Libera resultados em <span className="font-normal text-admin-muted">(Brasília)</span></Label>
              <Input
                id="results-release"
                className={inputMonoCls}
                type="datetime-local"
                value={form.results_release_at}
                onChange={e => set('results_release_at', e.target.value)}
                required
              />
            </div>
            {windowError && (
              <p className="flex items-center gap-1.5 text-xs text-admin-destructive">
                <AlertTriangle className="h-3.5 w-3.5" />
                {windowError}
              </p>
            )}
            {hasWindow && !windowError && (
              <p className="text-xs text-admin-muted">
                {formatWindowSummary(
                  localInputToUtcISO(form.execution_window_start),
                  localInputToUtcISO(form.execution_window_end),
                  localInputToUtcISO(form.results_release_at),
                )}
              </p>
            )}
          </div>
        </AdminPanel>

        {/* ─────────── Direita: O que o aluno vê ─────────── */}
        <div className="space-y-4">
          <AdminSectionHeader title="O que o aluno vê" />

          {/* Dois estados */}
          <AdminPanel flush className="overflow-hidden">
            <div className="flex items-start gap-3 border-b border-admin-line/60 p-4">
              <span className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-lg bg-admin-success/10">
                <Check className="h-4 w-4 text-admin-success" strokeWidth={2.2} />
              </span>
              <div>
                <div className="text-[13px] font-bold text-admin-text">Dentro da janela</div>
                <div className="mt-0.5 text-xs leading-relaxed text-admin-muted">
                  A nota conta para o ranking. O aluno aparece na classificação.
                </div>
              </div>
            </div>
            <div className="flex items-start gap-3 p-4">
              <span className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-lg bg-admin-warning/10">
                <Clock3 className="h-4 w-4 text-admin-warning" />
              </span>
              <div>
                <div className="text-[13px] font-bold text-admin-text">Fora da janela</div>
                <div className="mt-0.5 text-xs leading-relaxed text-admin-muted">
                  Vale como treino. O resultado não entra na classificação.
                </div>
              </div>
            </div>
          </AdminPanel>

          {/* Linha do tempo */}
          <AdminPanel>
            <div className="text-xs font-bold text-admin-text">Linha do tempo</div>
            {hasWindow ? (
              <>
                <div className="relative my-5 h-1.5 rounded-full bg-admin-raised">
                  {/* trecho verde: vale para ranking */}
                  <div
                    className="absolute top-0 h-1.5 rounded-full bg-admin-success"
                    style={{ left: `${positions.startPct}%`, width: `${Math.max(0, positions.endPct - positions.startPct)}%` }}
                  />
                  {/* marca de abertura */}
                  <div
                    className="absolute top-[-5px] h-4 w-0.5 bg-admin-success"
                    style={{ left: `${positions.startPct}%` }}
                  />
                  {/* marca de fechamento */}
                  <div
                    className="absolute top-[-5px] h-4 w-0.5 bg-admin-success"
                    style={{ left: `${positions.endPct}%` }}
                  />
                  {/* marca de liberação de resultados (quando posterior ao fim) */}
                  {positions.releasePct != null && (
                    <div
                      className="absolute top-[-3px] h-[11px] w-0.5 bg-admin-faint"
                      style={{ left: `${positions.releasePct}%` }}
                    />
                  )}
                </div>
                <div className="flex justify-between font-mono text-[10.5px] text-admin-faint">
                  <span>{shortDate(form.execution_window_start)}</span>
                  <span className="font-semibold text-admin-success">vale para ranking</span>
                  <span>{shortDate(form.execution_window_end)}</span>
                </div>
                {positions.releasePct != null && (
                  <p className="mt-3 text-[11px] text-admin-muted">
                    Resultados liberados em {shortDate(form.results_release_at)}, depois do fim da janela.
                  </p>
                )}
              </>
            ) : (
              <div className="my-4 rounded-lg border border-dashed border-admin-line bg-admin-bg/40 px-4 py-6 text-center">
                <p className="text-xs text-admin-muted">
                  Defina quando a prova abre e fecha para ver aqui o período que vale para o ranking.
                </p>
              </div>
            )}
          </AdminPanel>
        </div>
      </div>

      {/* Por que assim */}
      <div className="mt-6 max-w-5xl rounded-xl border border-admin-accent/20 bg-admin-accent/[0.06] px-4 py-3.5 text-[12.5px] leading-relaxed text-admin-text">
        <strong className="font-bold">Por que assim:</strong>{' '}
        em vez de só dois campos de data, o painel à direita mostra na hora a consequência da configuração:
        dentro da janela conta para o ranking, fora vale como treino. A linha do tempo dá a mesma informação
        em forma visual, então ninguém precisa adivinhar o efeito da janela.
      </div>

      {/* Rodapé: cancelar (a publicação fica na topbar) */}
      <div className="mt-4 flex max-w-5xl gap-2">
        <Button
          type="button"
          variant="outline"
          className="border-admin-line bg-transparent text-admin-muted hover:bg-admin-raised hover:text-admin-text"
          onClick={() => navigate('/admin/simulados')}
        >
          Cancelar
        </Button>
      </div>
    </form>
  );
}

export default function AdminSimuladoForm() {
  return (
    <AdminCapabilityGate capability="content.manage">
      <AdminSimuladoFormContent />
    </AdminCapabilityGate>
  )
}
