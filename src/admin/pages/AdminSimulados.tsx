import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Plus, Pencil, Upload, Trash2 } from 'lucide-react';
import { adminApi } from '../services/adminApi';
import { toast } from '@/hooks/use-toast';

export default function AdminSimulados() {
  const navigate = useNavigate();
  const [simulados, setSimulados] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    adminApi.listSimulados().then(setSimulados).finally(() => setLoading(false));
  };

  useEffect(load, []);

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`Deletar simulado "${title}"? Esta ação é irreversível.`)) return;
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
                  <TableCell>
                    <div className="flex gap-1">
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
