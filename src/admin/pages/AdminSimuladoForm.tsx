import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { adminApi } from '../services/adminApi';
import { toast } from '@/hooks/use-toast';

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

export default function AdminSimuladoForm() {
  const { id } = useParams();
  const isEdit = !!id && id !== 'novo';
  const navigate = useNavigate();
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isEdit) return;
    adminApi.getSimulado(id!).then(s => {
      setForm({
        title: s.title,
        slug: s.slug,
        sequence_number: s.sequence_number,
        description: s.description,
        duration_minutes: s.duration_minutes,
        questions_count: s.questions_count,
        execution_window_start: s.execution_window_start.slice(0, 16),
        execution_window_end: s.execution_window_end.slice(0, 16),
        results_release_at: s.results_release_at.slice(0, 16),
        theme_tags: s.theme_tags.join(', '),
        status: s.status as 'draft' | 'published',
      });
    });
  }, [id, isEdit]);

  const set = (k: string, v: any) => setForm(prev => ({ ...prev, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    const payload = {
      title: form.title,
      slug: form.slug,
      sequence_number: Number(form.sequence_number),
      description: form.description,
      duration_minutes: Number(form.duration_minutes),
      questions_count: Number(form.questions_count),
      execution_window_start: new Date(form.execution_window_start).toISOString(),
      execution_window_end: new Date(form.execution_window_end).toISOString(),
      results_release_at: new Date(form.results_release_at).toISOString(),
      theme_tags: (form.theme_tags as string).split(',').map(t => t.trim()).filter(Boolean),
      status: form.status as 'draft' | 'published',
    };

    try {
      if (isEdit) {
        await adminApi.updateSimulado(id!, payload);
        toast({ title: 'Simulado atualizado' });
      } else {
        await adminApi.createSimulado(payload);
        toast({ title: 'Simulado criado' });
      }
      navigate('/admin/simulados');
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold text-foreground">{isEdit ? 'Editar' : 'Novo'} Simulado</h1>

      <Card>
        <CardHeader><CardTitle className="text-base">Configuração</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Título</Label>
                <Input value={form.title} onChange={e => set('title', e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>Slug</Label>
                <Input value={form.slug} onChange={e => set('slug', e.target.value)} required placeholder="simulado-1" />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Nº sequencial</Label>
                <Input type="number" value={form.sequence_number} onChange={e => set('sequence_number', e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>Duração (min)</Label>
                <Input type="number" value={form.duration_minutes} onChange={e => set('duration_minutes', e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>Nº questões</Label>
                <Input type="number" value={form.questions_count} onChange={e => set('questions_count', e.target.value)} />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Descrição</Label>
              <Input value={form.description} onChange={e => set('description', e.target.value)} />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Início da janela</Label>
                <Input type="datetime-local" value={form.execution_window_start} onChange={e => set('execution_window_start', e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>Fim da janela</Label>
                <Input type="datetime-local" value={form.execution_window_end} onChange={e => set('execution_window_end', e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>Liberação resultados</Label>
                <Input type="datetime-local" value={form.results_release_at} onChange={e => set('results_release_at', e.target.value)} required />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Tags de tema (separadas por vírgula)</Label>
              <Input value={form.theme_tags} onChange={e => set('theme_tags', e.target.value)} placeholder="Clínica Médica, Cirurgia" />
            </div>

            <div className="space-y-2">
              <Label>Status</Label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={form.status}
                onChange={e => set('status', e.target.value)}
              >
                <option value="draft">Rascunho</option>
                <option value="published">Publicado</option>
                <option value="test">Teste (só admins)</option>
              </select>
            </div>

            <div className="flex gap-2 pt-2">
              <Button type="submit" disabled={saving}>{saving ? 'Salvando...' : isEdit ? 'Atualizar' : 'Criar'}</Button>
              <Button type="button" variant="outline" onClick={() => navigate('/admin/simulados')}>Cancelar</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
