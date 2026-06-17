import { AdminCapabilityGate } from '@/admin/components/AdminCapabilityGate'
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Plus, Pencil, Upload, Trash2, BarChart3, Download, ClipboardList, FileEdit, Users } from 'lucide-react';
import { adminApi } from '../services/adminApi';
import { useAdminSimuladoEngagementMap } from '@/admin/hooks/useAdminSimuladosAnalytics';
import { exportQuestionRankingXlsx } from '@/admin/utils/exportQuestionRanking';
import { AdminPageHeader } from '@/admin/components/ui/AdminPageHeader';
import { AdminEmptyState } from '@/admin/components/ui/AdminEmptyState';
import { AdminConfirmDialog } from '@/admin/components/ui/AdminConfirmDialog';
import { formatInt } from '@/admin/lib/format';
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

function AdminSimuladosContent() {
  const navigate = useNavigate();
  const { data: engagementMap } = useAdminSimuladoEngagementMap();
  const [simulados, setSimulados] = useState<SimuladoListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<SimuladoListItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = () => {
    setLoading(true);
    adminApi.listSimulados().then(setSimulados).finally(() => setLoading(false));
  };

  useEffect(load, []);

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await adminApi.deleteQuestionsForSimulado(deleteTarget.id);
      await adminApi.deleteSimulado(deleteTarget.id);
      toast({ title: 'Simulado deletado' });
      setDeleteTarget(null);
      load();
    } catch (err: any) {
      toast({ title: 'Erro ao deletar', description: err.message, variant: 'destructive' });
    } finally {
      setDeleting(false);
    }
  };

  const handleExportXlsx = async (id: string, title: string) => {
    try {
      toast({ title: 'Gerando planilha…' });
      const stats = await adminApi.getSimuladoQuestionStats(id);
      exportQuestionRankingXlsx(stats, title);
      toast({ title: 'Download iniciado!' });
    } catch (err: any) {
      toast({ title: 'Erro ao exportar', description: err.message, variant: 'destructive' });
    }
  };

  const fmt = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Simulados"
        subtitle={loading ? 'Carregando…' : `${formatInt(simulados.length)} simulados cadastrados`}
        actions={
          <Button onClick={() => navigate('/admin/simulados/novo')}>
            <Plus className="h-4 w-4 mr-1" /> Novo Simulado
          </Button>
        }
      />

      {loading ? (
        <div className="flex justify-center py-12"><div className="h-8 w-8 border-2 border-admin-accent/30 border-t-admin-accent rounded-full animate-spin" /></div>
      ) : simulados.length === 0 ? (
        <AdminEmptyState
          icon={ClipboardList}
          title="Nenhum simulado cadastrado"
          description="Crie o primeiro simulado para liberar provas, ranking e analytics."
          action={
            <Button size="sm" onClick={() => navigate('/admin/simulados/novo')}>
              <Plus className="h-4 w-4 mr-1" /> Novo Simulado
            </Button>
          }
        />
      ) : (
        <div className="border border-admin-line rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">#</TableHead>
                <TableHead>Título</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Questões</TableHead>
                <TableHead>Janela</TableHead>
                <TableHead className="text-right">Participantes</TableHead>
                <TableHead className="text-right">Conclusão</TableHead>
                <TableHead className="text-right">Média</TableHead>
                <TableHead className="text-right">Abandono</TableHead>
                <TableHead className="w-32">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {simulados.map(s => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{s.sequence_number}</TableCell>
                  <TableCell>{s.title}</TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={s.status === 'published'
                        ? 'bg-admin-success/10 text-admin-success border-admin-success/30'
                        : 'bg-admin-raised text-admin-muted border-admin-line'}
                    >
                      {s.status}
                    </Badge>
                  </TableCell>
                  <TableCell>{s.questions_count}</TableCell>
                  <TableCell className="text-xs text-admin-muted">
                    {fmt(s.execution_window_start)} — {fmt(s.execution_window_end)}
                  </TableCell>
                  {(() => {
                    const eng = engagementMap?.get(s.id)
                    if (!eng) return (
                      <>
                        <TableCell className="text-right text-admin-muted/40 text-xs">—</TableCell>
                        <TableCell className="text-right text-admin-muted/40 text-xs">—</TableCell>
                        <TableCell className="text-right text-admin-muted/40 text-xs">—</TableCell>
                        <TableCell className="text-right text-admin-muted/40 text-xs">—</TableCell>
                      </>
                    )
                    return (
                      <>
                        <TableCell className="text-right text-xs font-medium">{formatInt(eng.participants)}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <div className="w-12 h-1 bg-admin-raised rounded-full overflow-hidden">
                              <div className="h-1 bg-admin-success rounded-full" style={{ width: `${Math.min(100, eng.completion_rate)}%` }} />
                            </div>
                            <span className="text-xs font-medium">{eng.completion_rate.toFixed(1)}%</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <div className="w-12 h-1 bg-admin-raised rounded-full overflow-hidden">
                              <div className="h-1 bg-admin-accent rounded-full" style={{ width: `${Math.min(100, eng.avg_score)}%` }} />
                            </div>
                            <span className="text-xs font-medium">{eng.avg_score.toFixed(1)}%</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right text-xs font-medium">{eng.abandonment_rate.toFixed(1)}%</TableCell>
                      </>
                    )
                  })()}
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Exportar XLSX"
                        className="h-8 w-8"
                        disabled={!engagementMap?.get(s.id)?.participants}
                        onClick={() => handleExportXlsx(s.id, s.title)}
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Analytics"
                        className="h-8 w-8"
                        disabled={!engagementMap?.get(s.id)?.participants}
                        onClick={() => navigate(`/admin/simulados/${s.id}/analytics`)}
                      >
                        <BarChart3 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Resultados"
                        className="h-8 w-8"
                        disabled={!engagementMap?.get(s.id)?.participants}
                        onClick={() => navigate(`/admin/simulados/${s.id}/resultados`)}
                      >
                        <Users className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => navigate(`/admin/simulados/${s.id}`)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" title="Enviar questões (planilha)" onClick={() => navigate(`/admin/simulados/${s.id}/questoes`)}>
                        <Upload className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" title="Editar questões" onClick={() => navigate(`/admin/simulados/${s.id}/questoes/editar`)}>
                        <FileEdit className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => setDeleteTarget(s)}>
                        <Trash2 className="h-4 w-4 text-admin-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <AdminConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}
        title="Deletar simulado"
        description={deleteTarget ? `Deletar o simulado "${deleteTarget.title}" e todas as suas questões? Esta ação é irreversível.` : ''}
        confirmLabel="Deletar"
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
