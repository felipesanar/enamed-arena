import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Plus, Pencil, Upload, Trash2 } from 'lucide-react';
import { adminApi } from '../services/adminApi';
import { useAdminSimuladoEngagementMap } from '@/admin/hooks/useAdminSimuladosAnalytics';
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

export default function AdminSimulados() {
  const navigate = useNavigate();
  const { data: engagementMap } = useAdminSimuladoEngagementMap();
  const [simulados, setSimulados] = useState<SimuladoListItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    adminApi.listSimulados().then(setSimulados).finally(() => setLoading(false));
  };

  useEffect(load, []);

  const handleDelete = async (id: string, title: string) => {
    // Admin-only destructive action — use native confirm to keep the admin panel simple
    // eslint-disable-next-line no-alert
    if (!window.confirm(`Deletar simulado "${title}"? Esta ação é irreversível.`)) return;
    try {
      await adminApi.deleteQuestionsForSimulado(id);
      await adminApi.deleteSimulado(id);
      toast({ title: 'Simulado deletado' });
      load();
    } catch (err: any) {
      toast({ title: 'Erro ao deletar', description: err.message, variant: 'destructive' });
    }
  };

  const fmt = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Simulados</h1>
        <Button onClick={() => navigate('/admin/simulados/novo')}>
          <Plus className="h-4 w-4 mr-1" /> Novo Simulado
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><div className="h-8 w-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" /></div>
      ) : simulados.length === 0 ? (
        <p className="text-muted-foreground text-center py-12">Nenhum simulado cadastrado.</p>
      ) : (
        <div className="border rounded-lg">
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
                    <Badge variant={s.status === 'published' ? 'default' : 'secondary'}>
                      {s.status}
                    </Badge>
                  </TableCell>
                  <TableCell>{s.questions_count}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {fmt(s.execution_window_start)} — {fmt(s.execution_window_end)}
                  </TableCell>
                  {(() => {
                    const eng = engagementMap?.get(s.id)
                    if (!eng) return (
                      <>
                        <TableCell className="text-right text-muted-foreground/40 text-xs">—</TableCell>
                        <TableCell className="text-right text-muted-foreground/40 text-xs">—</TableCell>
                        <TableCell className="text-right text-muted-foreground/40 text-xs">—</TableCell>
                        <TableCell className="text-right text-muted-foreground/40 text-xs">—</TableCell>
                      </>
                    )
                    return (
                      <>
                        <TableCell className="text-right text-xs font-medium">{eng.participants.toLocaleString('pt-BR')}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <div className="w-12 h-1 bg-muted rounded-full overflow-hidden">
                              <div className="h-1 bg-success rounded-full" style={{ width: `${Math.min(100, eng.completion_rate)}%` }} />
                            </div>
                            <span className="text-xs font-medium">{eng.completion_rate.toFixed(1)}%</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <div className="w-12 h-1 bg-muted rounded-full overflow-hidden">
                              <div className="h-1 bg-primary rounded-full" style={{ width: `${Math.min(100, eng.avg_score)}%` }} />
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
                        size="sm"
                        title="Analytics"
                        disabled={!engagementMap?.get(s.id)?.participants}
                        onClick={() => navigate(`/admin/simulados/${s.id}/analytics`)}
                      >
                        📊
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => navigate(`/admin/simulados/${s.id}`)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => navigate(`/admin/simulados/${s.id}/questoes`)}>
                        <Upload className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => handleDelete(s.id, s.title)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
