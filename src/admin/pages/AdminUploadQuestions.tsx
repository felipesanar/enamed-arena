import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Upload, FileSpreadsheet, Trash2, CheckCircle, Image as ImageIcon } from 'lucide-react';
import { adminApi } from '../services/adminApi';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { extractImagesFromXlsx, type ExtractedImage } from '../utils/xlsxImageExtractor';

interface ParsedRow {
  numero: number;
  'Grande Área': string;
  Especialidade: string;
  Tema: string;
  Enunciado: string;
  'Imagem do Enunciado': string;
  'Alternativa A': string;
  'Alternativa B': string;
  'Alternativa C': string;
  'Alternativa D': string;
  Gabarito: string;
  'Comentário': string;
  'Imagem do Comentário': string;
}

interface NormalizedQuestion {
  numero: number;
  texto: string;
  area: string;
  tema: string;
  dificuldade: string;
  explicacao: string;
  image_url: string;
  alternativa_a: string;
  alternativa_b: string;
  alternativa_c: string;
  alternativa_d: string;
  correta: string;
}

function normalizeRow(row: ParsedRow): NormalizedQuestion {
  const especialidade = row.Especialidade || '';
  const tema = row.Tema || '';
  const composedTheme = especialidade && tema
    ? `${especialidade} > ${tema}`
    : especialidade || tema || '';

  return {
    numero: Number(row.numero),
    texto: row.Enunciado || '',
    area: row['Grande Área'] || '',
    tema: composedTheme,
    dificuldade: 'medium',
    explicacao: row['Comentário'] || '',
    image_url: row['Imagem do Enunciado'] || '',
    alternativa_a: row['Alternativa A'] || '',
    alternativa_b: row['Alternativa B'] || '',
    alternativa_c: row['Alternativa C'] || '',
    alternativa_d: row['Alternativa D'] || '',
    correta: (row.Gabarito || '').toUpperCase(),
  };
}

export default function AdminUploadQuestions() {
  const { id: simuladoId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [simulado, setSimulado] = useState<any>(null);
  const [existingCount, setExistingCount] = useState(0);
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [enunciadoImages, setEnunciadoImages] = useState<Map<number, ExtractedImage>>(new Map());
  const [comentarioImages, setComentarioImages] = useState<Map<number, ExtractedImage>>(new Map());
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ step: string; percent: number } | null>(null);
  const [fileName, setFileName] = useState('');

  useEffect(() => {
    if (!simuladoId) return;
    adminApi.getSimulado(simuladoId).then(setSimulado);
    adminApi.getQuestionsCount(simuladoId).then(setExistingCount);
  }, [simuladoId]);

  const handleFile = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);

    const arrayBuffer = await file.arrayBuffer();

    // Parse text data with SheetJS
    const wb = XLSX.read(arrayBuffer, { type: 'array' });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<ParsedRow>(sheet);
    setParsedRows(rows);

    // Extract embedded images with JSZip
    const { enunciadoImages: eImgs, comentarioImages: cImgs } = await extractImagesFromXlsx(arrayBuffer);
    setEnunciadoImages(eImgs);
    setComentarioImages(cImgs);

    if (eImgs.size > 0 || cImgs.size > 0) {
      toast({ title: `${eImgs.size + cImgs.size} imagens extraídas da planilha` });
    }
  }, []);

  const handleUpload = async () => {
    if (!simuladoId || parsedRows.length === 0) return;
    setUploading(true);
    setUploadProgress({ step: 'Preparando imagens...', percent: 5 });

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Não autenticado');

      const normalized = parsedRows.map(normalizeRow);

      // Build images payload: { [questionNumber]: { enunciado?: {...}, comentario?: {...} } }
      const images: Record<number, {
        enunciado?: { data: string; mime: string };
        comentario?: { data: string; mime: string };
      }> = {};

      parsedRows.forEach((row, index) => {
        const qNum = Number(row.numero);
        const eImg = enunciadoImages.get(index);
        const cImg = comentarioImages.get(index);
        if (eImg || cImg) {
          images[qNum] = {};
          if (eImg) images[qNum].enunciado = { data: eImg.base64, mime: eImg.mimeType };
          if (cImg) images[qNum].comentario = { data: cImg.base64, mime: cImg.mimeType };
        }
      });

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const res = await fetch(`${supabaseUrl}/functions/v1/admin-upload-questions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ simulado_id: simuladoId, questions: normalized, images }),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Erro no upload');

      toast({ title: `${result.inserted} questões inseridas com sucesso!` });
      setParsedRows([]);
      setFileName('');
      setEnunciadoImages(new Map());
      setComentarioImages(new Map());
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

  const totalImages = enunciadoImages.size + comentarioImages.size;

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Upload de Questões</h1>
          <p className="text-muted-foreground">#{simulado.sequence_number} — {simulado.title}</p>
        </div>
        <Button variant="outline" onClick={() => navigate('/admin/simulados')}>Voltar</Button>
      </div>

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

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FileSpreadsheet className="h-4 w-4" />
            Importar planilha XLSX
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Colunas esperadas: <code className="text-xs bg-muted px-1 rounded">numero, Grande Área, Especialidade, Tema, Enunciado, Imagem do Enunciado, Alternativa A, Alternativa B, Alternativa C, Alternativa D, Gabarito, Comentário</code>
          </p>

          <div className="flex items-center gap-4">
            <label className="cursor-pointer">
              <input type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFile} />
              <div className="flex items-center gap-2 px-4 py-2 border border-dashed border-border rounded-lg hover:bg-muted/50 transition-colors">
                <Upload className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">{fileName || 'Selecionar arquivo'}</span>
              </div>
            </label>

            {parsedRows.length > 0 && (
              <div className="flex items-center gap-3">
                {totalImages > 0 && (
                  <Badge variant="secondary" className="flex items-center gap-1">
                    <ImageIcon className="h-3 w-3" />
                    {totalImages} imagens
                  </Badge>
                )}
                <Button onClick={handleUpload} disabled={uploading}>
                  {uploading ? 'Enviando...' : `Enviar ${parsedRows.length} questões`}
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {parsedRows.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Preview — {parsedRows.length} questões</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="border rounded-lg overflow-auto max-h-[500px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">#</TableHead>
                    <TableHead className="min-w-[300px]">Enunciado</TableHead>
                    <TableHead>Grande Área</TableHead>
                    <TableHead>Especialidade</TableHead>
                    <TableHead>Gabarito</TableHead>
                    <TableHead className="w-16">Img</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsedRows.map((q, i) => {
                    const hasEnunciado = enunciadoImages.has(i);
                    const hasComentario = comentarioImages.has(i);
                    return (
                      <TableRow key={i}>
                        <TableCell>{q.numero}</TableCell>
                        <TableCell className="text-xs max-w-[400px] truncate">{q.Enunciado}</TableCell>
                        <TableCell><Badge variant="secondary" className="text-xs">{q['Grande Área']}</Badge></TableCell>
                        <TableCell className="text-xs">{q.Especialidade}</TableCell>
                        <TableCell><Badge>{q.Gabarito}</Badge></TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            {hasEnunciado && (
                              <span title="Imagem do enunciado">
                                <ImageIcon className="h-3.5 w-3.5 text-primary" />
                              </span>
                            )}
                            {hasComentario && (
                              <span title="Imagem do comentário">
                                <ImageIcon className="h-3.5 w-3.5 text-muted-foreground" />
                              </span>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
