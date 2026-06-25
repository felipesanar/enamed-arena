import { AdminCapabilityGate } from '@/admin/components/AdminCapabilityGate'
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Plus, Pencil, Upload, Trash2, BarChart3, Download, ClipboardList,
  FileEdit, Users, MoreVertical, AlertCircle, AlertTriangle,
} from 'lucide-react';
import { adminApi } from '../services/adminApi';
import { useAdminSimuladoEngagementMap } from '@/admin/hooks/useAdminSimuladosAnalytics';
import { exportQuestionRankingXlsx } from '@/admin/utils/exportQuestionRanking';
import { AdminPageHeader } from '@/admin/components/ui/AdminPageHeader';
import { AdminEmptyState } from '@/admin/components/ui/AdminEmptyState';
import { AdminConfirmDialog } from '@/admin/components/ui/AdminConfirmDialog';
import { formatInt } from '@/admin/lib/format';
import { logger } from '@/lib/logger';
import { toast } from '@/hooks/use-toast';

interface SimuladoListItem {
  id: string;
  title: string;
  sequence_number: number;
  status: string;
  questions_count: number;
  execution_window_start: string;
  execution_window_end: string;
}

// ─── Disponibilidade ─────────────────────────────────────────────────────────
// Os 4 estados que um operador entende, derivados do status interno
// (draft/published) somado à janela de execução e à hora atual.
// 'published' antes da janela = Agendado; dentro = Disponível; depois = Encerrado.
// 'draft'/'test' = Rascunho.

type Availability = 'available' | 'scheduled' | 'draft' | 'closed'

const AVAILABILITY_META: Record<Availability, { label: string; dotClass: string; pillClass: string }> = {
  available: {
    label: 'Disponível',
    dotClass: 'bg-admin-success',
    pillClass: 'bg-admin-success/10 text-admin-success border-admin-success/25',
  },
  scheduled: {
    label: 'Agendado',
    dotClass: 'bg-admin-info',
    pillClass: 'bg-admin-info/10 text-admin-info border-admin-info/25',
  },
  draft: {
    label: 'Rascunho',
    dotClass: 'bg-admin-faint',
    pillClass: 'bg-admin-raised text-admin-muted border-admin-line',
  },
  closed: {
    label: 'Encerrado',
    dotClass: 'bg-admin-warning',
    pillClass: 'bg-admin-warning/10 text-admin-warning border-admin-warning/25',
  },
}

function deriveAvailability(s: SimuladoListItem, now: number): Availability {
  if (s.status !== 'published') return 'draft'
  const start = s.execution_window_start ? new Date(s.execution_window_start).getTime() : null
  const end = s.execution_window_end ? new Date(s.execution_window_end).getTime() : null
  if (end != null && now > end) return 'closed'
  if (start != null && now < start) return 'scheduled'
  return 'available'
}

function AvailabilityBadge({ availability }: { availability: Availability }) {
  const meta = AVAILABILITY_META[availability]
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5',
        'text-[11px] font-semibold leading-none whitespace-nowrap',
        meta.pillClass,
      )}
    >
      <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', meta.dotClass)} aria-hidden />
      {meta.label}
    </span>
  )
}

// ─── Janela de execução ───────────────────────────────────────────────────────

function formatWindow(startIso: string, endIso: string): string | null {
  if (!startIso || !endIso) return null
  const start = new Date(startIso)
  const end = new Date(endIso)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null
  const dm = (d: Date) => d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
  const dmy = (d: Date) => d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })
  return `${dm(start)} → ${dmy(end)}`
}

// ─── Skeleton ──────────────────────────────────────────────────────────────

function ShimmerBar({ className }: { className?: string }) {
  return (
    <div className={cn('relative overflow-hidden rounded bg-admin-raised', className)}>
      <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.4s_infinite] bg-gradient-to-r from-transparent via-admin-surface/70 to-transparent" />
    </div>
  )
}

const GRID_COLS = '48px minmax(0,2fr) 130px 90px 200px 44px'

function LoadingTable() {
  return (
    <div className="overflow-hidden rounded-xl border border-admin-line bg-admin-surface">
      <div
        className="grid border-b border-admin-line bg-admin-bg-outer px-1 text-[10.5px] font-bold uppercase tracking-[0.06em] text-admin-faint"
        style={{ gridTemplateColumns: GRID_COLS }}
      >
        {['#', 'Título', 'Disponibilidade', 'Questões', 'Janela de execução', ''].map((h, i) => (
          <div key={i} className="px-3 py-3">{h}</div>
        ))}
      </div>
      {[0, 1, 2, 3, 4].map(i => (
        <div
          key={i}
          className="grid items-center border-b border-admin-line-subtle px-1 last:border-0"
          style={{ gridTemplateColumns: GRID_COLS }}
        >
          <div className="px-3 py-3.5"><ShimmerBar className="h-3 w-5" /></div>
          <div className="px-3 py-3.5"><ShimmerBar className="h-3.5 w-2/3" /></div>
          <div className="px-3 py-3.5"><ShimmerBar className="h-4 w-20 rounded-full" /></div>
          <div className="px-3 py-3.5"><ShimmerBar className="h-3 w-8" /></div>
          <div className="px-3 py-3.5"><ShimmerBar className="h-3 w-28" /></div>
          <div className="px-3 py-3.5"><ShimmerBar className="h-4 w-4 rounded" /></div>
        </div>
      ))}
    </div>
  )
}

// ─── Conteúdo ──────────────────────────────────────────────────────────────

function AdminSimuladosContent() {
  const navigate = useNavigate();
  const { data: engagementMap } = useAdminSimuladoEngagementMap();
  const [simulados, setSimulados] = useState<SimuladoListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SimuladoListItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = () => {
    setLoading(true);
    setLoadError(null);
    adminApi.listSimulados()
      .then(setSimulados)
      .catch((err: any) => {
        logger.error('[AdminSimulados] Erro ao carregar simulados:', err)
        setLoadError(err?.message ?? 'Não foi possível carregar os simulados.')
      })
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await adminApi.deleteQuestionsForSimulado(deleteTarget.id);
      await adminApi.deleteSimulado(deleteTarget.id);
      toast({ title: 'Simulado excluído' });
      setDeleteTarget(null);
      load();
    } catch (err: any) {
      logger.error('[AdminSimulados] Erro ao excluir simulado:', err)
      toast({ title: 'Erro ao excluir', description: err.message, variant: 'destructive' });
    } finally {
      setDeleting(false);
    }
  };

  const handleExportXlsx = async (id: string, title: string) => {
    try {
      toast({ title: 'Gerando planilha…' });
      const stats = await adminApi.getSimuladoQuestionStats(id);
      exportQuestionRankingXlsx(stats, title);
      toast({ title: 'Download iniciado' });
    } catch (err: any) {
      logger.error('[AdminSimulados] Erro ao exportar:', err)
      toast({ title: 'Erro ao exportar', description: err.message, variant: 'destructive' });
    }
  };

  const now = Date.now()
  const availableNow = simulados.filter(s => deriveAvailability(s, now) === 'available').length

  const subtitle = loading
    ? 'Carregando simulados…'
    : loadError
      ? 'Não foi possível carregar a lista'
      : simulados.length === 0
        ? 'Nenhuma prova cadastrada ainda'
        : `${formatInt(simulados.length)} ${simulados.length === 1 ? 'prova cadastrada' : 'provas cadastradas'} · ${availableNow} ${availableNow === 1 ? 'disponível agora' : 'disponíveis agora'}`

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Simulados"
        subtitle={subtitle}
        actions={
          <Button onClick={() => navigate('/admin/simulados/novo')}>
            <Plus className="mr-1 h-4 w-4" /> Novo simulado
          </Button>
        }
      />

      {loading ? (
        <LoadingTable />
      ) : loadError ? (
        <div className="overflow-hidden rounded-xl border border-admin-line bg-admin-surface">
          <AdminEmptyState
            icon={AlertTriangle}
            tone="error"
            eyebrow="Erro"
            title="Não foi possível carregar os simulados"
            description={loadError}
            action={
              <Button size="sm" variant="outline" onClick={load}>
                Tentar de novo
              </Button>
            }
          />
        </div>
      ) : simulados.length === 0 ? (
        <div className="overflow-hidden rounded-xl border border-admin-line bg-admin-surface">
          <AdminEmptyState
            icon={ClipboardList}
            title="Nenhum simulado cadastrado"
            description="Crie a primeira prova para liberar simulados, ranking e análise para os alunos."
            action={
              <Button size="sm" onClick={() => navigate('/admin/simulados/novo')}>
                <Plus className="mr-1 h-4 w-4" /> Novo simulado
              </Button>
            }
          />
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-admin-line bg-admin-surface">
          {/* Cabeçalho */}
          <div
            className="grid border-b border-admin-line bg-admin-bg-outer text-[10.5px] font-bold uppercase tracking-[0.06em] text-admin-faint"
            style={{ gridTemplateColumns: GRID_COLS }}
          >
            <div className="px-4 py-3">#</div>
            <div className="px-3 py-3">Título</div>
            <div className="px-3 py-3">Disponibilidade</div>
            <div className="px-3 py-3">Questões</div>
            <div className="px-3 py-3">Janela de execução</div>
            <div className="px-3 py-3" aria-hidden />
          </div>

          {/* Linhas */}
          {simulados.map((s, idx) => {
            const availability = deriveAvailability(s, now)
            const isDraftEmpty = availability === 'draft' && s.questions_count === 0
            const windowLabel = formatWindow(s.execution_window_start, s.execution_window_end)
            const hasResults = Boolean(engagementMap?.get(s.id)?.participants)
            const seq = String(s.sequence_number).padStart(2, '0')

            return (
              <div
                key={s.id}
                className={cn(
                  'grid items-center border-b border-admin-line-subtle last:border-0',
                  'motion-safe:transition-colors hover:bg-admin-raised/40',
                  idx % 2 === 1 && 'bg-admin-bg-outer/60',
                )}
                style={{ gridTemplateColumns: GRID_COLS }}
              >
                <div className="px-4 py-3.5 font-mono text-[12.5px] text-admin-faint">{seq}</div>

                <div className="px-3 py-3.5">
                  <button
                    type="button"
                    onClick={() => navigate(`/admin/simulados/${s.id}`)}
                    className="text-left text-[13px] font-semibold text-admin-text motion-safe:transition-colors hover:text-admin-accent"
                  >
                    {s.title}
                    {availability === 'draft' && (
                      <span className="ml-1.5 text-[11px] font-medium text-admin-faint">(rascunho)</span>
                    )}
                  </button>
                </div>

                <div className="px-3 py-3.5">
                  <AvailabilityBadge availability={availability} />
                </div>

                <div className="px-3 py-3.5">
                  {isDraftEmpty ? (
                    <span
                      className="inline-flex items-center gap-1.5 font-mono text-[12.5px] tabular-nums text-admin-warning"
                      title="Rascunho sem questões. Importe questões antes de publicar."
                    >
                      <AlertCircle className="h-3 w-3" aria-hidden />
                      0
                    </span>
                  ) : (
                    <span className="font-mono text-[12.5px] tabular-nums text-admin-text">
                      {formatInt(s.questions_count)}
                    </span>
                  )}
                </div>

                <div className="px-3 py-3.5">
                  {windowLabel ? (
                    <span className="font-mono text-[12px] text-admin-muted">{windowLabel}</span>
                  ) : (
                    <span className="text-[12px] text-admin-faint">não definida</span>
                  )}
                </div>

                <div className="flex justify-center px-2 py-2.5">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        aria-label={`Ações do simulado ${s.title}`}
                        className="flex h-7 w-7 items-center justify-center rounded-md text-admin-faint motion-safe:transition-colors hover:bg-admin-raised hover:text-admin-text focus:outline-none focus-visible:ring-2 focus-visible:ring-admin-accent/30"
                      >
                        <MoreVertical className="h-4 w-4" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align="end"
                      className="w-52 rounded-xl border-admin-line bg-admin-surface p-1.5 text-admin-text shadow-[0_4px_14px_rgba(26,23,21,0.1)]"
                    >
                      <DropdownMenuItem
                        className="gap-2.5 rounded-lg px-2.5 py-2 text-[13px] text-admin-text focus:bg-admin-raised focus:text-admin-text"
                        onClick={() => navigate(`/admin/simulados/${s.id}`)}
                      >
                        <Pencil className="h-4 w-4 text-admin-faint" /> Editar simulado
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="gap-2.5 rounded-lg px-2.5 py-2 text-[13px] text-admin-text focus:bg-admin-raised focus:text-admin-text"
                        onClick={() => navigate(`/admin/simulados/${s.id}/questoes`)}
                      >
                        <Upload className="h-4 w-4 text-admin-faint" /> Enviar questões
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="gap-2.5 rounded-lg px-2.5 py-2 text-[13px] text-admin-text focus:bg-admin-raised focus:text-admin-text"
                        onClick={() => navigate(`/admin/simulados/${s.id}/questoes/editar`)}
                      >
                        <FileEdit className="h-4 w-4 text-admin-faint" /> Editar questões
                      </DropdownMenuItem>

                      <DropdownMenuSeparator className="my-1.5 bg-admin-line-subtle" />

                      <DropdownMenuItem
                        disabled={!hasResults}
                        className="gap-2.5 rounded-lg px-2.5 py-2 text-[13px] text-admin-text focus:bg-admin-raised focus:text-admin-text"
                        onClick={() => navigate(`/admin/simulados/${s.id}/resultados`)}
                      >
                        <Users className="h-4 w-4 text-admin-faint" /> Ver resultados
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        disabled={!hasResults}
                        className="gap-2.5 rounded-lg px-2.5 py-2 text-[13px] text-admin-text focus:bg-admin-raised focus:text-admin-text"
                        onClick={() => navigate(`/admin/simulados/${s.id}/analytics`)}
                      >
                        <BarChart3 className="h-4 w-4 text-admin-faint" /> Análise por questão
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        disabled={!hasResults}
                        className="gap-2.5 rounded-lg px-2.5 py-2 text-[13px] text-admin-text focus:bg-admin-raised focus:text-admin-text"
                        onClick={() => handleExportXlsx(s.id, s.title)}
                      >
                        <Download className="h-4 w-4 text-admin-faint" /> Exportar planilha
                      </DropdownMenuItem>

                      <DropdownMenuSeparator className="my-1.5 bg-admin-line-subtle" />

                      <DropdownMenuItem
                        className="gap-2.5 rounded-lg px-2.5 py-2 text-[13px] text-admin-destructive focus:bg-admin-destructive/10 focus:text-admin-destructive"
                        onClick={() => setDeleteTarget(s)}
                      >
                        <Trash2 className="h-4 w-4" /> Excluir simulado
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <AdminConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}
        title="Excluir simulado"
        description={deleteTarget ? `Excluir o simulado "${deleteTarget.title}" e todas as questões dele? Esta ação não pode ser desfeita.` : ''}
        confirmLabel="Excluir simulado"
        destructive
        loading={deleting}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}

export default function AdminSimulados() {
  return (
    <AdminCapabilityGate capability="content.manage">
      <AdminSimuladosContent />
    </AdminCapabilityGate>
  )
}
