import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Upload, FileSpreadsheet, Trash2, CheckCircle } from 'lucide-react';
import { adminApi } from '../services/adminApi';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface ParsedQuestion {
  numero: number;
  texto: string;
  area: string;
  tema: string;
  dificuldade: string;
  explicacao: string;
  alternativa_a: string;
  alternativa_b: string;
  alternativa_c: string;
  alternativa_d: string;
  alternativa_e: string;
  correta: string; // A, B, C, D ou E
}

export default function AdminUploadQuestions() {
  const { id: simuladoId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [simulado, setSimulado] = useState<any>(null);
  const [existingCount, setExistingCount] = useState(0);
  const [parsed, setParsed] = useState<ParsedQuestion[]>([]);
  const [uploading, setUploading] = useState(false);
  const [fileName, setFileName] = useState('');

  useEffect(() => {
    if (!simuladoId) return;
    adminApi.getSimulado(simuladoId).then(setSimulado);
    adminApi.getQuestionsCount(simuladoId).then(setExistingCount);
  }, [simuladoId]);

  const handleFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (ev) => {
      const wb = XLSX.read(ev.target?.result, { type: 'array' });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<ParsedQuestion>(sheet);
      setParsed(rows);
    };
    reader.readAsArrayBuffer(file);
  }, []);

  const handleUpload = async () => {
    if (!simuladoId || parsed.length === 0) return;
    setUploading(true);

    try {
      // Get session token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Não autenticado');

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const res = await fetch(`${supabaseUrl}/functions/v1/admin-upload-questions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ simulado_id: simuladoId, questions: parsed }),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Erro no upload');

      toast({ title: `${result.inserted} questões inseridas com sucesso!` });
      setParsed([]);
      setFileName('');
      setExistingCount(result.inserted);
    } catch (err: any) {
      toast({ title: 'Erro no upload', description: err.message, variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteExisting = async () => {
    if (!simuladoId) return;
    if (!confirm('Deletar todas as questões existentes deste simulado?')) return;
    try {
      await adminApi.deleteQuestionsForSimulado(simuladoId);
      setExistingCount(0);
      toast({ title: 'Questões deletadas' });
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    }
  };

  if (!simulado) {
    return <div className="flex justify-center py-12"><div className="h-8 w-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" /></div>;
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Upload de Questões</h1>
          <p className="text-muted-foreground">#{simulado.sequence_number} — {simulado.title}</p>
        </div>
        <Button variant="outline" onClick={() => navigate('/admin/simulados')}>Voltar</Button>
      </div>

      {/* Existing questions info */}
      <Card>
        <CardContent className="flex items-center justify-between py-4">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-foreground">{existingCount} questões cadastradas</span>
          </div>
          {existingCount > 0 && (
            <Button size="sm" variant="destructive" onClick={handleDeleteExisting}>
              <Trash2 className="h-3 w-3 mr-1" /> Limpar questões
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Upload area */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FileSpreadsheet className="h-4 w-4" />
            Importar planilha XLSX
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Colunas esperadas: <code className="text-xs bg-muted px-1 rounded">numero, texto, area, tema, dificuldade, explicacao, alternativa_a, alternativa_b, alternativa_c, alternativa_d, alternativa_e, correta</code>
          </p>

          <div className="flex items-center gap-4">
            <label className="cursor-pointer">
              <input type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFile} />
              <div className="flex items-center gap-2 px-4 py-2 border border-dashed border-border rounded-lg hover:bg-muted/50 transition-colors">
                <Upload className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">{fileName || 'Selecionar arquivo'}</span>
              </div>
            </label>

            {parsed.length > 0 && (
              <Button onClick={handleUpload} disabled={uploading}>
                {uploading ? 'Enviando...' : `Enviar ${parsed.length} questões`}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Preview */}
      {parsed.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Preview — {parsed.length} questões</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="border rounded-lg overflow-auto max-h-[500px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">#</TableHead>
                    <TableHead className="min-w-[300px]">Texto</TableHead>
                    <TableHead>Área</TableHead>
                    <TableHead>Tema</TableHead>
                    <TableHead>Correta</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsed.map((q, i) => (
                    <TableRow key={i}>
                      <TableCell>{q.numero}</TableCell>
                      <TableCell className="text-xs max-w-[400px] truncate">{q.texto}</TableCell>
                      <TableCell><Badge variant="secondary" className="text-xs">{q.area}</Badge></TableCell>
                      <TableCell className="text-xs">{q.tema}</TableCell>
                      <TableCell><Badge>{q.correta}</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
