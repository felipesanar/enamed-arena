import { AdminCapabilityGate } from '@/admin/components/AdminCapabilityGate'
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { AdminPageHeader } from '@/admin/components/ui/AdminPageHeader';
import { AdminSectionHeader } from '@/admin/components/ui/AdminSectionHeader';
import { adminApi } from '../services/adminApi';
import { toast } from '@/hooks/use-toast';
import { validateWindows, windowWarnings } from '@/admin/lib/validateWindows';
import { localInputToUtcISO, utcISOToLocalInput, formatWindowSummary } from '@/admin/lib/timezone';
import { slugify } from '@/admin/lib/slugify';

/** Classes admin para inputs (tema control-room sem editar o componente shadcn) */
const inputCls = 'bg-admin-bg border-admin-line-strong text-admin-text placeholder:text-admin-faint';

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

function AdminSimuladoFormContent() {
  const { id } = useParams();
  const isEdit = !!id && id !== 'novo';
  const navigate = useNavigate();
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [slugTouched, setSlugTouched] = useState(false);
  const [realCount, setRealCount] = useState<number | null>(null);

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
        execution_window_start: utcISOToLocalInput(s.execution_window_start),
        execution_window_end: utcISOToLocalInput(s.execution_window_end),
        results_release_at: utcISOToLocalInput(s.results_release_at),
        theme_tags: s.theme_tags.join(', '),
        status: s.status as 'draft' | 'published' | 'test',
      });
    });
    adminApi.getQuestionsCount(id!).then(setRealCount);
  }, [id, isEdit]);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const windowError = validateWindows(
      form.execution_window_start,
      form.execution_window_end,
      form.results_release_at,
    );
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
      status: form.status as 'draft' | 'published' | 'test',
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
      <AdminPageHeader
        title={`${isEdit ? 'Editar' : 'Novo'} Simulado`}
        subtitle="Metadados, janela de execução e publicação"
      />

      <Card className="bg-admin-surface border-admin-line text-admin-text">
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-6">

            {/* ── Identificação ── */}
            <div className="space-y-4">
              <AdminSectionHeader title="Identificação" />
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Título</Label>
                  <Input
                    className={inputCls}
                    value={form.title}
                    onChange={e => handleTitleChange(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Slug</Label>
                  <Input
                    className={inputCls}
                    value={form.slug}
                    onChange={e => handleSlugChange(e.target.value)}
                    required
                    placeholder="simulado-1"
                  />
                </div>
              </div>
              <div className="w-40 space-y-2">
                <Label>Nº sequencial</Label>
                <Input
                  className={inputCls}
                  type="number"
                  value={form.sequence_number}
                  onChange={e => set('sequence_number', e.target.value)}
                  required
                />
              </div>
            </div>

            {/* ── Conteúdo ── */}
            <div className="space-y-4">
              <AdminSectionHeader title="Conteúdo" />
              <div className="space-y-2">
                <Label>Descrição</Label>
                <Input
                  className={inputCls}
                  value={form.description}
                  onChange={e => set('description', e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Duração (min)</Label>
                  <Input
                    className={inputCls}
                    type="number"
                    value={form.duration_minutes}
                    onChange={e => set('duration_minutes', e.target.value)}
                    required
                  />
                </div>
                {isEdit ? (
                  <div className="space-y-2">
                    <Label>Nº questões</Label>
                    <Input
                      className={inputCls}
                      type="number"
                      value={realCount ?? form.questions_count}
                      readOnly
                    />
                    <p className="text-xs text-admin-muted">
                      Definido automaticamente pelo upload de questões.
                    </p>
                    {realCount != null && realCount !== form.questions_count && (
                      <p className="text-xs text-amber-500">
                        O valor salvo ({form.questions_count}) difere do real ({realCount}).
                      </p>
                    )}
                  </div>
                ) : null}
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

            {/* ── Agenda ── */}
            <div className="space-y-4">
              <AdminSectionHeader title="Agenda" />
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Início da janela <span className="text-admin-muted font-normal">(Brasília)</span></Label>
                  <Input
                    className={inputCls}
                    type="datetime-local"
                    value={form.execution_window_start}
                    onChange={e => set('execution_window_start', e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Fim da janela <span className="text-admin-muted font-normal">(Brasília)</span></Label>
                  <Input
                    className={inputCls}
                    type="datetime-local"
                    value={form.execution_window_end}
                    onChange={e => set('execution_window_end', e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Liberação resultados <span className="text-admin-muted font-normal">(Brasília)</span></Label>
                  <Input
                    className={inputCls}
                    type="datetime-local"
                    value={form.results_release_at}
                    onChange={e => set('results_release_at', e.target.value)}
                    required
                  />
                </div>
              </div>
              {form.execution_window_start && form.execution_window_end && form.results_release_at && (
                <p className="text-xs text-admin-muted">
                  {formatWindowSummary(
                    localInputToUtcISO(form.execution_window_start),
                    localInputToUtcISO(form.execution_window_end),
                    localInputToUtcISO(form.results_release_at),
                  )}
                </p>
              )}
            </div>

            {/* ── Publicação ── */}
            <div className="space-y-4">
              <AdminSectionHeader title="Publicação" />
              <div className="space-y-2">
                <Label>Status</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-admin-line-strong bg-admin-bg text-admin-text px-3 py-2 text-sm"
                  value={form.status}
                  onChange={e => set('status', e.target.value)}
                >
                  <option value="draft">Rascunho</option>
                  <option value="published">Publicado</option>
                  <option value="test">Teste (só admins)</option>
                </select>
                <p className="text-xs text-admin-muted">
                  Rascunho: não aparece para o aluno. · Publicado: visível na janela de execução. · Teste: visível apenas para admins.
                </p>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <Button type="submit" disabled={saving}>{saving ? 'Salvando...' : isEdit ? 'Atualizar' : 'Criar'}</Button>
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
        </CardContent>
      </Card>
    </div>
  );
}

export default function AdminSimuladoForm() {
  return (
    <AdminCapabilityGate capability="content.manage">
      <AdminSimuladoFormContent />
    </AdminCapabilityGate>
  )
}
