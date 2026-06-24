import { AdminCapabilityGate } from '@/admin/components/AdminCapabilityGate'
import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Upload, FileSpreadsheet, Trash2, CheckCircle, Image as ImageIcon, Loader2, ScanSearch } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { AdminPageHeader } from '@/admin/components/ui/AdminPageHeader';
import { adminApi, type QuestionVerifyFinding } from '../services/adminApi';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { extractImagesFromXlsx, type ExtractedImage } from '../utils/xlsxImageExtractor';
import { parseXlsxFirstWorksheetRows } from '../utils/xlsxTextParser';
import { QuestionPreviewModal } from '../components/QuestionPreviewModal';
import { VerifyFindingsPanel } from '../components/VerifyFindingsPanel';
import { validateQuestions } from '@/admin/lib/validateQuestions';

interface ParsedRow {
  numero: number;
  'Grande Área': string;
  Especialidade: string;
  Tema: string;
  Enunciado: string;
  'Imagem do Enunciado': string;
  'Imagem 2 do Enunciado': string;
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
  image_url_2: string;
  alternativa_a: string;
  alternativa_b: string;
  alternativa_c: string;
  alternativa_d: string;
  correta: string;
}

function normalizeStoragePublicUrl(value: string | undefined | null): string {
  const raw = value?.trim();
  if (!raw) return '';

  const toPublicUrl = (path: string) => supabase.storage.from('question-images').getPublicUrl(path).data.publicUrl;

  if (raw.startsWith('http://') || raw.startsWith('https://')) {
    try {
      const url = new URL(raw);
      const objectMarker = '/storage/v1/object/';
      const publicMarker = '/storage/v1/object/public/';

      if (url.pathname.includes(publicMarker)) return raw;

      if (url.pathname.includes(objectMarker)) {
        const storagePath = url.pathname.split(objectMarker)[1] ?? '';
        const [, ...pathParts] = storagePath.split('/');
        const objectPath = pathParts.join('/');
        return objectPath ? toPublicUrl(objectPath) : raw;
      }
    } catch {
      return raw;
    }

    return raw;
  }

  const objectPath = raw.replace(/^question-images\//, '').replace(/^\/+/, '');
  return objectPath ? toPublicUrl(objectPath) : '';
}

/** Normaliza um cabeçalho para comparação: remove acentos, baixa caixa, trim. */
function normalizeHeader(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

/**
 * Mapa de cabeçalhos canônicos → variações aceitas (já normalizadas).
 * Torna o import tolerante a variações de acento/caixa (ex.: "Número" vs "numero").
 */
const HEADER_ALIASES: Record<keyof ParsedRow, string[]> = {
  numero: ['numero', 'questao'],
  'Grande Área': ['grande area', 'area'],
  Especialidade: ['especialidade'],
  Tema: ['tema', 'assunto'],
  Enunciado: ['enunciado'],
  'Imagem do Enunciado': ['imagem do enunciado'],
  'Imagem 2 do Enunciado': ['imagem 2 do enunciado', 'imagem 2 enunciado', 'imagem 2', 'img 2', 'imagem secundaria', 'segunda imagem'],
  'Alternativa A': ['alternativa a'],
  'Alternativa B': ['alternativa b'],
  'Alternativa C': ['alternativa c'],
  'Alternativa D': ['alternativa d'],
  Gabarito: ['gabarito', 'resposta', 'resposta correta'],
  'Comentário': ['comentario'],
  'Imagem do Comentário': ['imagem do comentario'],
};

/**
 * Remapeia linhas cruas (chaveadas pelo texto exato do cabeçalho da planilha)
 * para as chaves canônicas que o restante do pipeline espera.
 * Sem isso, um cabeçalho "Número" não casa com `row.numero` e quebra
 * numeração + associação de imagens (vira NaN → question_number 0, sem imagem).
 */
function canonicalizeRows(rawRows: Record<string, string>[]): ParsedRow[] {
  return rawRows.map((raw) => {
    const byNormalizedKey = new Map<string, string>();
    for (const [key, value] of Object.entries(raw)) {
      byNormalizedKey.set(normalizeHeader(key), value);
    }

    const out = {} as Record<string, string>;
    for (const [canonical, aliases] of Object.entries(HEADER_ALIASES)) {
      let value = '';
      for (const alias of aliases) {
        const hit = byNormalizedKey.get(normalizeHeader(alias));
        if (hit != null && hit !== '') {
          value = hit;
          break;
        }
      }
      out[canonical] = value;
    }
    return out as unknown as ParsedRow;
  });
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
    image_url: normalizeStoragePublicUrl(row['Imagem do Enunciado']),
    image_url_2: normalizeStoragePublicUrl(row['Imagem 2 do Enunciado']),
    alternativa_a: row['Alternativa A'] || '',
    alternativa_b: row['Alternativa B'] || '',
    alternativa_c: row['Alternativa C'] || '',
    alternativa_d: row['Alternativa D'] || '',
    correta: (row.Gabarito || '').toUpperCase(),
  };
}

function AdminUploadQuestionsContent() {
  const { id: simuladoId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [simulado, setSimulado] = useState<any>(null);
  const [existingCount, setExistingCount] = useState(0);
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [enunciadoImages, setEnunciadoImages] = useState<Map<number, ExtractedImage>>(new Map());
  const [enunciado2Images, setEnunciado2Images] = useState<Map<number, ExtractedImage>>(new Map());
  const [comentarioImages, setComentarioImages] = useState<Map<number, ExtractedImage>>(new Map());
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ step: string; percent: number } | null>(null);
  const [fileName, setFileName] = useState('');
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const [findings, setFindings] = useState<QuestionVerifyFinding[]>([]);
  const [structuralFindings, setStructuralFindings] = useState<QuestionVerifyFinding[]>([]);
  const [verifying, setVerifying] = useState(false);
  const [verifyRan, setVerifyRan] = useState(false);

  useEffect(() => {
    if (!simuladoId) return;
    adminApi.getSimulado(simuladoId).then(setSimulado);
    adminApi.getQuestionsCount(simuladoId).then(setExistingCount);
  }, [simuladoId]);

  const handleFile = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setFindings([]);
    setStructuralFindings([]);
    setVerifyRan(false);

    const arrayBuffer = await file.arrayBuffer();

    const rawRows = await parseXlsxFirstWorksheetRows(arrayBuffer);
    const rows = canonicalizeRows(rawRows);
    setParsedRows(rows);
    setStructuralFindings(validateQuestions(rows.map((r) => ({
      numero: Number(r.numero),
      enunciado: r.Enunciado || '',
      alternativaA: r['Alternativa A'] || '',
      alternativaB: r['Alternativa B'] || '',
      alternativaC: r['Alternativa C'] || '',
      alternativaD: r['Alternativa D'] || '',
      gabarito: r.Gabarito || '',
    }))));

    // Extract embedded images with JSZip
    const { enunciadoImages: eImgs, enunciado2Images: e2Imgs, comentarioImages: cImgs } = await extractImagesFromXlsx(arrayBuffer);
    setEnunciadoImages(eImgs);
    setEnunciado2Images(e2Imgs);
    setComentarioImages(cImgs);

    if (eImgs.size > 0 || e2Imgs.size > 0 || cImgs.size > 0) {
      toast({ title: `${eImgs.size + e2Imgs.size + cImgs.size} imagens extraídas da planilha` });
    }
  }, []);

  const runVerify = async () => {
    setVerifying(true);
    try {
      const inputs = parsedRows.map((row, i) => ({
        question_number: Number(row.numero),
        enunciado_text: row.Enunciado || '',
        comentario_text: row['Comentário'] || '',
        has_image: enunciadoImages.has(i),
        has_image_2: enunciado2Images.has(i),
        has_explanation_image: comentarioImages.has(i),
      }));
      const result = await adminApi.verifyQuestions(inputs);
      setFindings(result);
      setVerifyRan(true);
    } catch (err: any) {
      toast({ title: 'Erro ao verificar', description: err.message, variant: 'destructive' });
    } finally {
      setVerifying(false);
    }
  };

  const handleUpload = async () => {
    if (!simuladoId || parsedRows.length === 0) return;
    setUploading(true);
    setUploadProgress({ step: 'Preparando upload...', percent: 2 });

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Não autenticado');

      const normalized = parsedRows.map(normalizeRow);

      // Collect images to upload
      const imageJobs: Array<{ qNum: number; kind: 'enunciado' | 'enunciado2' | 'comentario'; img: ExtractedImage }> = [];
      parsedRows.forEach((row, index) => {
        const qNum = Number(row.numero);
        const eImg = enunciadoImages.get(index);
        const e2Img = enunciado2Images.get(index);
        const cImg = comentarioImages.get(index);
        if (eImg) imageJobs.push({ qNum, kind: 'enunciado', img: eImg });
        if (e2Img) imageJobs.push({ qNum, kind: 'enunciado2', img: e2Img });
        if (cImg) imageJobs.push({ qNum, kind: 'comentario', img: cImg });
      });

      const imageUrls: Record<number, { enunciado_url?: string; enunciado2_url?: string; comentario_url?: string }> = {};

      const mimeToExt = (mime: string) => {
        if (mime.includes('jpeg') || mime.includes('jpg')) return 'jpg';
        if (mime.includes('png')) return 'png';
        if (mime.includes('gif')) return 'gif';
        if (mime.includes('webp')) return 'webp';
        return 'png';
      };

      const base64ToBytes = (b64: string) => {
        const bin = atob(b64);
        const arr = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
        return arr;
      };

      // Upload images in parallel (limit concurrency = 4)
      let done = 0;
      const total = imageJobs.length;
      const concurrency = 4;
      let cursor = 0;

      async function worker() {
        while (cursor < imageJobs.length) {
          const my = cursor++;
          const job = imageJobs[my];
          if (!job) return;
          const ext = mimeToExt(job.img.mimeType);
          const path = `${simuladoId}/${job.qNum}_${job.kind}.${ext}`;
          const bytes = base64ToBytes(job.img.base64);
          const blob = new Blob([bytes], { type: job.img.mimeType });
          const { error } = await supabase.storage
            .from('question-images')
            .upload(path, blob, { contentType: job.img.mimeType, upsert: true });
          if (error) throw new Error(`Falha ao enviar imagem ${job.qNum} (${job.kind}): ${error.message}`);
          const { data: pub } = supabase.storage.from('question-images').getPublicUrl(path);
          if (!imageUrls[job.qNum]) imageUrls[job.qNum] = {};
          if (job.kind === 'enunciado') imageUrls[job.qNum].enunciado_url = pub.publicUrl;
          else if (job.kind === 'enunciado2') imageUrls[job.qNum].enunciado2_url = pub.publicUrl;
          else imageUrls[job.qNum].comentario_url = pub.publicUrl;
          done++;
          if (total > 0) {
            setUploadProgress({
              step: `Enviando imagens (${done}/${total})...`,
              percent: 5 + Math.round((done / total) * 60),
            });
          }
        }
      }
      await Promise.all(Array.from({ length: Math.min(concurrency, imageJobs.length || 1) }, worker));

      setUploadProgress({ step: 'Salvando questões no servidor...', percent: 75 });

      const { data: result, error: invokeError } = await supabase.functions.invoke('admin-upload-questions', {
        body: {
          simulado_id: simuladoId,
          questions: normalized,
          image_urls: imageUrls,
        },
      });

      if (invokeError) {
        throw new Error(invokeError.message || 'Falha ao salvar questões no servidor');
      }
      if (!result || typeof result.inserted !== 'number') {
        throw new Error('Resposta inválida da função de upload');
      }

      setUploadProgress({ step: 'Finalizado!', percent: 100 });
      toast({ title: `${result.inserted} questões inseridas com sucesso!` });
      setParsedRows([]);
      setFileName('');
      setEnunciadoImages(new Map());
      setEnunciado2Images(new Map());
      setComentarioImages(new Map());
      setExistingCount(result.inserted);
    } catch (err: any) {
      toast({ title: 'Erro no upload', description: err.message, variant: 'destructive' });
    } finally {
      setUploading(false);
      setTimeout(() => setUploadProgress(null), 2000);
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
    return <div className="flex justify-center py-12"><div className="h-8 w-8 border-2 border-admin-accent/30 border-t-admin-accent rounded-full animate-spin" /></div>;
  }

  const totalImages = enunciadoImages.size + enunciado2Images.size + comentarioImages.size;

  return (
    <div className="space-y-6 max-w-5xl">
      <AdminPageHeader
        title="Upload de Questões"
        subtitle={`#${simulado.sequence_number} — ${simulado.title}`}
        actions={
          <Button
            variant="outline"
            className="border-admin-line bg-transparent text-admin-muted hover:bg-admin-raised hover:text-admin-text"
            onClick={() => navigate('/admin/simulados')}
          >
            Voltar
          </Button>
        }
      />

      <Card className="bg-admin-surface border-admin-line text-admin-text">
        <CardContent className="flex items-center justify-between py-4">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-admin-muted" />
            <span className="text-sm text-admin-text">{existingCount} questões cadastradas</span>
          </div>
          {existingCount > 0 && (
            <Button size="sm" variant="destructive" onClick={handleDeleteExisting}>
              <Trash2 className="h-3 w-3 mr-1" /> Limpar questões
            </Button>
          )}
        </CardContent>
      </Card>

      <Card className="bg-admin-surface border-admin-line text-admin-text">
        <CardHeader>
          <CardTitle className="text-base text-admin-text flex items-center gap-2">
            <FileSpreadsheet className="h-4 w-4" />
            Importar planilha XLSX
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-admin-muted">
            Colunas esperadas: <code className="text-xs bg-admin-raised px-1 rounded">numero, Grande Área, Especialidade, Tema, Enunciado, Imagem do Enunciado, Imagem 2 do Enunciado, Alternativa A, Alternativa B, Alternativa C, Alternativa D, Gabarito, Comentário</code>
          </p>

          <div className="flex items-center gap-4">
            <label className="cursor-pointer">
              <input type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFile} />
              <div className="flex items-center gap-2 px-4 py-2 border border-dashed border-admin-line rounded-lg hover:bg-admin-raised/50 transition-colors">
                <Upload className="h-4 w-4 text-admin-muted" />
                <span className="text-sm">{fileName || 'Selecionar arquivo'}</span>
              </div>
            </label>

            {parsedRows.length > 0 && (
              <div className="flex items-center gap-3 flex-wrap">
                {totalImages > 0 && (
                  <Badge variant="outline" className="flex items-center gap-1 bg-admin-raised text-admin-muted border-admin-line">
                    <ImageIcon className="h-3 w-3" />
                    {totalImages} imagens
                  </Badge>
                )}
                <Button
                  variant="outline"
                  className="border-admin-line bg-transparent text-admin-muted hover:bg-admin-raised hover:text-admin-text"
                  onClick={runVerify}
                  disabled={verifying || uploading}
                >
                  {verifying ? (
                    <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  ) : (
                    <ScanSearch className="h-3.5 w-3.5 mr-1.5" />
                  )}
                  {verifying ? 'Verificando...' : 'Verificar com IA'}
                </Button>
                <Button onClick={handleUpload} disabled={uploading}>
                  {uploading ? 'Enviando...' : `Enviar ${parsedRows.length} questões`}
                </Button>
              </div>
            )}
          </div>

          {uploadProgress && (
            <div className="space-y-2 pt-2">
              <div className="flex items-center gap-2">
                {uploadProgress.percent < 100 && <Loader2 className="h-3.5 w-3.5 animate-spin text-admin-accent" />}
                {uploadProgress.percent === 100 && <CheckCircle className="h-3.5 w-3.5 text-admin-success" />}
                <span className="text-sm text-admin-muted">{uploadProgress.step}</span>
              </div>
              <Progress value={uploadProgress.percent} className="h-2 bg-admin-raised" />
            </div>
          )}
        </CardContent>
      </Card>

      {parsedRows.length > 0 && (
        <Card className="bg-admin-surface border-admin-line text-admin-text">
          <CardHeader>
            <CardTitle className="text-base text-admin-text">Preview — {parsedRows.length} questões</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="border border-admin-line rounded-lg overflow-auto max-h-[500px]">
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
                    const hasEnunciado2 = enunciado2Images.has(i);
                    const hasComentario = comentarioImages.has(i);
                    return (
                      <TableRow
                        key={i}
                        onClick={() => setPreviewIndex(i)}
                        className="cursor-pointer hover:bg-admin-raised/40"
                      >
                        <TableCell>{q.numero}</TableCell>
                        <TableCell className="text-xs max-w-[400px] truncate">{q.Enunciado}</TableCell>
                        <TableCell><Badge variant="outline" className="text-xs bg-admin-raised text-admin-muted border-admin-line">{q['Grande Área']}</Badge></TableCell>
                        <TableCell className="text-xs">{q.Especialidade}</TableCell>
                        <TableCell><Badge variant="outline" className="bg-admin-accent/10 text-admin-accent border-admin-accent/30">{q.Gabarito}</Badge></TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            {hasEnunciado && (
                              <span title="Imagem do enunciado">
                                <ImageIcon className="h-3.5 w-3.5 text-admin-accent" />
                              </span>
                            )}
                            {hasEnunciado2 && (
                              <span title="Imagem 2 do enunciado">
                                <ImageIcon className="h-3.5 w-3.5 text-admin-accent/60" />
                              </span>
                            )}
                            {hasComentario && (
                              <span title="Imagem do comentário">
                                <ImageIcon className="h-3.5 w-3.5 text-admin-muted" />
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

      {parsedRows.length > 0 && (
        <VerifyFindingsPanel findings={[...structuralFindings, ...findings]} loading={verifying} />
      )}

      <QuestionPreviewModal
        open={previewIndex !== null}
        onOpenChange={(open) => !open && setPreviewIndex(null)}
        row={previewIndex !== null ? parsedRows[previewIndex] : null}
        enunciadoImage={previewIndex !== null ? enunciadoImages.get(previewIndex) : undefined}
        enunciado2Image={previewIndex !== null ? enunciado2Images.get(previewIndex) : undefined}
        comentarioImage={previewIndex !== null ? comentarioImages.get(previewIndex) : undefined}
      />
    </div>
  );
}

export default function AdminUploadQuestions() {
  return (
    <AdminCapabilityGate capability="content.manage">
      <AdminUploadQuestionsContent />
    </AdminCapabilityGate>
  )
}
