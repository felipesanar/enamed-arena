import { AdminCapabilityGate } from '@/admin/components/AdminCapabilityGate'
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Upload,
  FileSpreadsheet,
  Trash2,
  CheckCircle2,
  Image as ImageIcon,
  Loader2,
  ScanSearch,
  Download,
  AlertCircle,
  RotateCcw,
} from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { AdminPageHeader } from '@/admin/components/ui/AdminPageHeader';
import { AdminPanel } from '@/admin/components/ui/AdminPanel';
import { AdminEmptyState } from '@/admin/components/ui/AdminEmptyState';
import { AdminConfirmDialog } from '@/admin/components/ui/AdminConfirmDialog';
import { adminApi, type QuestionVerifyFinding, type QuestionVerifyInput } from '../services/adminApi';
import { chunk } from '@/admin/lib/chunk';
import { downscaleImage } from '@/admin/utils/downscaleImage';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { logger } from '@/lib/logger';
import { extractImagesFromXlsx, type ExtractedImage } from '../utils/xlsxImageExtractor';
import { parseXlsxFirstWorksheetRows } from '../utils/xlsxTextParser';
import { QuestionPreviewModal } from '../components/QuestionPreviewModal';
import { VerifyFindingsPanel } from '../components/VerifyFindingsPanel';
import { validateQuestions } from '@/admin/lib/validateQuestions';
import { ENAMED_BLUEPRINT } from '@/lib/enamedBlueprint';

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

const COLUMNS_HINT ='numero, Grande Área, Especialidade, Tema, Enunciado, Imagem do Enunciado, Imagem 2 do Enunciado, Alternativa A, Alternativa B, Alternativa C, Alternativa D, Gabarito, Comentário';

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

// ── Validação por linha, com "o que está errado" + "como corrigir" ──────────

interface RowIssue {
  /** Linha da planilha (1 = cabeçalho), em mono no painel. */
  line: number;
  /** Resumo curto do problema. */
  what: string;
  /** Instrução de correção, com sugestão quando possível. */
  how: string;
}

const norm = (s: string): string =>
  (s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();

/** Distância de edição (Levenshtein) entre duas strings normalizadas. */
function editDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const prev = new Array(n + 1);
  const curr = new Array(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    for (let j = 0; j <= n; j++) prev[j] = curr[j];
  }
  return prev[n];
}

const VALID_AREAS = ENAMED_BLUEPRINT.map((a) => a.label);

/**
 * Tenta achar a grande área canônica mais próxima de um texto livre.
 * Retorna o rótulo sugerido quando há uma correspondência razoável, senão null.
 */
function suggestArea(value: string): string | null {
  const target = norm(value);
  if (!target) return null;

  // Casamento exato/canônico já resolvido em outro lugar; aqui buscamos o "quis dizer".
  let best: { label: string; dist: number } | null = null;
  for (const label of VALID_AREAS) {
    const dist = editDistance(target, norm(label));
    if (!best || dist < best.dist) best = { label, dist };
  }
  if (!best) return null;
  // Aceita sugestão só se a diferença for pequena (até ~35% do comprimento).
  const threshold = Math.max(2, Math.round(norm(best.label).length * 0.35));
  return best.dist <= threshold ? best.label : null;
}

function isKnownArea(value: string): boolean {
  const v = norm(value);
  if (!v) return false;
  return ENAMED_BLUEPRINT.some(
    (a) => norm(a.label) === v || a.matchers.some((m) => v.includes(norm(m)) || norm(m).includes(v)),
  );
}

/**
 * Valida as linhas para o painel de conferência, produzindo a linha da planilha,
 * o que está errado e como corrigir (com sugestão quando der).
 * Cada linha entra no máximo uma vez na lista; a primeira falha encontrada manda.
 */
function buildRowIssues(rows: ParsedRow[]): Map<number, RowIssue> {
  const issues = new Map<number, RowIssue>();

  rows.forEach((row, index) => {
    const line = index + 2; // 1 = cabeçalho

    const enunciado = norm(row.Enunciado || '');
    const gabarito = (row.Gabarito || '').trim().toUpperCase();
    const options = [
      ['A', row['Alternativa A']],
      ['B', row['Alternativa B']],
      ['C', row['Alternativa C']],
      ['D', row['Alternativa D']],
    ] as const;
    const emptyOptions = options.filter(([, t]) => norm(t || '') === '').map(([l]) => l);
    const area = row['Grande Área'] || '';

    let issue: RowIssue | null = null;

    if (!Number.isFinite(Number(row.numero)) || String(row.numero).trim() === '') {
      issue = {
        line,
        what: 'Número da questão vazio ou inválido',
        how: 'Preencha a coluna "numero" com um número inteiro.',
      };
    } else if (enunciado === '') {
      issue = {
        line,
        what: 'Enunciado vazio',
        how: 'A coluna "Enunciado" não pode ficar em branco.',
      };
    } else if (emptyOptions.length > 0) {
      issue = {
        line,
        what: emptyOptions.length === 1 ? 'Alternativa vazia' : 'Alternativas vazias',
        how: `Preencha a(s) alternativa(s) ${emptyOptions.join(', ')}.`,
      };
    } else if (!['A', 'B', 'C', 'D'].includes(gabarito)) {
      issue = {
        line,
        what: gabarito === '' ? 'Sem gabarito' : 'Gabarito inválido',
        how:
          gabarito === ''
            ? 'Indique a alternativa correta (A, B, C ou D) na coluna "Gabarito".'
            : `"${row.Gabarito}" não vale. Use A, B, C ou D na coluna "Gabarito".`,
      };
    } else if (area.trim() !== '' && !isKnownArea(area)) {
      const suggestion = suggestArea(area);
      issue = {
        line,
        what: 'Área não reconhecida',
        how: suggestion
          ? `"${area.trim()}" não existe. Você quis dizer "${suggestion}"?`
          : `"${area.trim()}" não existe. Use uma das áreas: ${VALID_AREAS.join(', ')}.`,
      };
    }

    if (issue) issues.set(index, issue);
  });

  return issues;
}

function AdminUploadQuestionsContent() {
  const { id: simuladoId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [simulado, setSimulado] = useState<any>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [existingCount, setExistingCount] = useState(0);
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [parsing, setParsing] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
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
  const [confirmClearOpen, setConfirmClearOpen] = useState(false);
  const [clearing, setClearing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!simuladoId) return;
    setLoadError(null);
    adminApi.getSimulado(simuladoId).then(setSimulado).catch((err) => {
      logger.error('[AdminUploadQuestions] Falha ao carregar simulado:', err);
      setLoadError(err?.message || 'Não foi possível carregar o simulado.');
    });
    adminApi.getQuestionsCount(simuladoId).then(setExistingCount).catch((err) => {
      logger.error('[AdminUploadQuestions] Falha ao contar questões:', err);
    });
  }, [simuladoId]);

  const rowIssues = useMemo(() => buildRowIssues(parsedRows), [parsedRows]);
  const errorCount = rowIssues.size;
  const readyCount = parsedRows.length - errorCount;
  const issueList = useMemo(
    () => [...rowIssues.values()].sort((a, b) => a.line - b.line),
    [rowIssues],
  );

  const resetParsedState = useCallback(() => {
    setParsedRows([]);
    setFileName('');
    setFileError(null);
    setFindings([]);
    setStructuralFindings([]);
    setVerifyRan(false);
    setEnunciadoImages(new Map());
    setEnunciado2Images(new Map());
    setComentarioImages(new Map());
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  const ingestFile = useCallback(async (file: File) => {
    setFileError(null);
    const lower = file.name.toLowerCase();
    if (!lower.endsWith('.xlsx') && !lower.endsWith('.xls')) {
      setFileError('Formato não aceito. Envie um arquivo .xlsx.');
      return;
    }
    // Sem limite de tamanho: o parsing é client-side e as imagens vão direto pro
    // Storage (limite global 50 MB/arquivo, bucket sem limite). A planilha em si
    // nunca trafega inteira pra edge function — só texto + URLs.
    setFileName(file.name);
    setFindings([]);
    setStructuralFindings([]);
    setVerifyRan(false);
    setParsing(true);

    try {
      const arrayBuffer = await file.arrayBuffer();

      const rawRows = await parseXlsxFirstWorksheetRows(arrayBuffer);
      const rows = canonicalizeRows(rawRows);

      if (rows.length === 0) {
        setParsedRows([]);
        setFileError('A planilha não tem nenhuma questão. Confira se há linhas abaixo do cabeçalho.');
        return;
      }

      setParsedRows(rows);
      setStructuralFindings(
        validateQuestions(
          rows.map((r) => ({
            numero: Number(r.numero),
            enunciado: r.Enunciado || '',
            alternativaA: r['Alternativa A'] || '',
            alternativaB: r['Alternativa B'] || '',
            alternativaC: r['Alternativa C'] || '',
            alternativaD: r['Alternativa D'] || '',
            gabarito: r.Gabarito || '',
          })),
        ),
      );

      const { enunciadoImages: eImgs, enunciado2Images: e2Imgs, comentarioImages: cImgs } =
        await extractImagesFromXlsx(arrayBuffer);
      setEnunciadoImages(eImgs);
      setEnunciado2Images(e2Imgs);
      setComentarioImages(cImgs);

      const totalImgs = eImgs.size + e2Imgs.size + cImgs.size;
      if (totalImgs > 0) {
        toast({ title: `${totalImgs} ${totalImgs === 1 ? 'imagem extraída' : 'imagens extraídas'} da planilha` });
      }
    } catch (err: any) {
      logger.error('[AdminUploadQuestions] Falha ao ler planilha:', err);
      setParsedRows([]);
      setFileError('Não foi possível ler a planilha. Confira o arquivo e tente de novo.');
    } finally {
      setParsing(false);
    }
  }, []);

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) ingestFile(file);
    },
    [ingestFile],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files?.[0];
      if (file) ingestFile(file);
    },
    [ingestFile],
  );

  const downloadTemplate = useCallback(() => {
    const headers = COLUMNS_HINT.split(', ');
    const example = [
      '1',
      'Pediatria',
      'Pediatria',
      'Aleitamento',
      'Recém-nascido a termo com icterícia nas primeiras 24 horas. Conduta inicial?',
      '',
      '',
      'Fototerapia',
      'Observação',
      'Exsanguineotransfusão',
      'Suspender aleitamento',
      'A',
      'Icterícia nas primeiras 24h é sempre patológica.',
    ];
    const csv = [headers.join(';'), example.join(';')].join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'modelo-questoes.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, []);

  const runVerify = async () => {
    setVerifying(true);
    try {
      const inputs: QuestionVerifyInput[] = await Promise.all(parsedRows.map(async (row, i) => {
        const imgs: QuestionVerifyInput['images'] = [];
        const e = enunciadoImages.get(i);
        const e2 = enunciado2Images.get(i);
        const c = comentarioImages.get(i);
        if (e) { const d = await downscaleImage(e.base64, e.mimeType); imgs.push({ slot: 'enunciado', mime: d.mime, base64: d.base64 }); }
        if (e2) { const d = await downscaleImage(e2.base64, e2.mimeType); imgs.push({ slot: 'enunciado2', mime: d.mime, base64: d.base64 }); }
        if (c) { const d = await downscaleImage(c.base64, c.mimeType); imgs.push({ slot: 'comentario', mime: d.mime, base64: d.base64 }); }
        return {
          question_number: Number(row.numero),
          enunciado_text: row.Enunciado || '',
          comentario_text: row['Comentário'] || '',
          images: imgs,
        };
      }));

      const batches = chunk(inputs, 7);
      const results: QuestionVerifyFinding[] = [];
      let done = 0;
      const concurrency = 4;
      let cursor = 0;

      async function worker() {
        while (cursor < batches.length) {
          const my = cursor++;
          const batch = batches[my];
          if (!batch) return;
          const part = await adminApi.verifyQuestions(batch);
          results.push(...part);
          done++;
          setUploadProgress({ step: `Verificando com a IA (lote ${done} de ${batches.length})...`, percent: Math.round((done / batches.length) * 100) });
        }
      }
      await Promise.all(Array.from({ length: Math.min(concurrency, batches.length || 1) }, worker));

      setFindings(results);
      setVerifyRan(true);
    } catch (err: any) {
      logger.error('[AdminUploadQuestions] Falha ao verificar com IA:', err);
      toast({ title: 'Erro ao verificar', description: err.message, variant: 'destructive' });
    } finally {
      setVerifying(false);
      setTimeout(() => setUploadProgress(null), 1500);
    }
  };

  const handleUpload = async () => {
    if (!simuladoId || parsedRows.length === 0) return;
    setUploading(true);
    setUploadProgress({ step: 'Preparando envio...', percent: 2 });

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Sessão expirada. Entre de novo e repita o envio.');

      // Importa só as linhas sem erro.
      const readyEntries = parsedRows
        .map((row, index) => ({ row, index }))
        .filter(({ index }) => !rowIssues.has(index));

      const normalized = readyEntries.map(({ row }) => normalizeRow(row));

      const imageJobs: Array<{ qNum: number; kind: 'enunciado' | 'enunciado2' | 'comentario'; img: ExtractedImage }> = [];
      readyEntries.forEach(({ row, index }) => {
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
          if (error) throw new Error(`Falha ao enviar imagem da questão ${job.qNum} (${job.kind}): ${error.message}`);
          const { data: pub } = supabase.storage.from('question-images').getPublicUrl(path);
          if (!imageUrls[job.qNum]) imageUrls[job.qNum] = {};
          if (job.kind === 'enunciado') imageUrls[job.qNum].enunciado_url = pub.publicUrl;
          else if (job.kind === 'enunciado2') imageUrls[job.qNum].enunciado2_url = pub.publicUrl;
          else imageUrls[job.qNum].comentario_url = pub.publicUrl;
          done++;
          if (total > 0) {
            setUploadProgress({
              step: `Enviando imagens (${done} de ${total})...`,
              percent: 5 + Math.round((done / total) * 60),
            });
          }
        }
      }
      await Promise.all(Array.from({ length: Math.min(concurrency, imageJobs.length || 1) }, worker));

      setUploadProgress({ step: 'Salvando questões...', percent: 75 });

      const { data: result, error: invokeError } = await supabase.functions.invoke('admin-upload-questions', {
        body: {
          simulado_id: simuladoId,
          questions: normalized,
          image_urls: imageUrls,
        },
      });

      if (invokeError) {
        throw new Error(invokeError.message || 'Falha ao salvar as questões.');
      }
      if (!result || typeof result.inserted !== 'number') {
        throw new Error('Resposta inesperada do servidor ao salvar.');
      }

      setUploadProgress({ step: 'Pronto!', percent: 100 });
      toast({ title: `${result.inserted} ${result.inserted === 1 ? 'questão importada' : 'questões importadas'}` });
      resetParsedState();
      setExistingCount((prev) => prev + result.inserted);
    } catch (err: any) {
      logger.error('[AdminUploadQuestions] Falha no envio:', err);
      toast({ title: 'Erro no envio', description: err.message, variant: 'destructive' });
    } finally {
      setUploading(false);
      setTimeout(() => setUploadProgress(null), 2000);
    }
  };

  const handleDeleteExisting = async () => {
    if (!simuladoId) return;
    setClearing(true);
    try {
      await adminApi.deleteQuestionsForSimulado(simuladoId);
      setExistingCount(0);
      toast({ title: 'Questões removidas' });
      setConfirmClearOpen(false);
    } catch (err: any) {
      logger.error('[AdminUploadQuestions] Falha ao remover questões:', err);
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    } finally {
      setClearing(false);
    }
  };

  // ── Estado de erro ao carregar o simulado ──────────────────────────────
  if (loadError) {
    return (
      <div className="max-w-5xl">
        <AdminPanel>
          <AdminEmptyState
            tone="error"
            icon={AlertCircle}
            eyebrow="Erro"
            title="Não foi possível carregar este simulado"
            description={loadError}
            action={
              <Button
                variant="outline"
                className="border-admin-line bg-admin-surface text-admin-text hover:bg-admin-raised"
                onClick={() => navigate('/admin/simulados')}
              >
                Voltar para Simulados
              </Button>
            }
          />
        </AdminPanel>
      </div>
    );
  }

  // ── Estado de carregamento do simulado (skeleton com shimmer) ──────────
  if (!simulado) {
    return (
      <div className="max-w-5xl space-y-5">
        <div className="space-y-2">
          <div className="relative h-7 w-64 overflow-hidden rounded bg-admin-raised">
            <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.4s_infinite] bg-gradient-to-r from-transparent via-admin-surface/70 to-transparent" />
          </div>
          <div className="relative h-4 w-40 overflow-hidden rounded bg-admin-raised">
            <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.4s_infinite] bg-gradient-to-r from-transparent via-admin-surface/70 to-transparent" />
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {[0, 1].map((i) => (
            <div key={i} className="h-64 rounded-xl border border-admin-line/80 bg-admin-surface p-5">
              <div className="relative h-3 w-32 overflow-hidden rounded bg-admin-raised">
                <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.4s_infinite] bg-gradient-to-r from-transparent via-admin-surface/70 to-transparent" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const totalImages = enunciadoImages.size + enunciado2Images.size + comentarioImages.size;
  const hasFile = parsedRows.length > 0;

  return (
    <div className="max-w-5xl space-y-6">
      <AdminPageHeader
        title="Subir questões"
        subtitle={`#${simulado.sequence_number} · ${simulado.title}`}
        actions={
          <Button
            variant="outline"
            className="border-admin-line bg-admin-surface text-admin-text hover:bg-admin-raised"
            onClick={() => navigate('/admin/simulados')}
          >
            Voltar
          </Button>
        }
      />

      {/* Linha de contexto: questões já cadastradas */}
      <AdminPanel className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
        <div className="flex items-center gap-2 text-sm text-admin-text">
          <CheckCircle2 className="h-4 w-4 text-admin-muted" aria-hidden />
          <span>
            <span className="font-semibold tabular-nums">{existingCount}</span>{' '}
            {existingCount === 1 ? 'questão já cadastrada' : 'questões já cadastradas'} neste simulado
          </span>
        </div>
        {existingCount > 0 && (
          <Button
            size="sm"
            variant="outline"
            className="border-admin-destructive/30 bg-admin-surface text-admin-destructive hover:bg-admin-destructive/10"
            onClick={() => setConfirmClearOpen(true)}
          >
            <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Limpar questões
          </Button>
        )}
      </AdminPanel>

      {/* Grid 1fr / 1fr: Passo 1 (enviar) + Passo 2 (conferir) */}
      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
        {/* ── Passo 1 · Enviar arquivo ── */}
        <AdminPanel flush className="overflow-hidden">
          <div className="border-b border-admin-line-subtle px-5 py-4">
            <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-admin-faint">
              Passo 1 · Enviar arquivo
            </span>
          </div>
          <div className="space-y-3.5 bg-admin-bg p-5">
            <label
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
              className={cn(
                'flex cursor-pointer flex-col items-center rounded-xl border-[1.5px] border-dashed px-5 py-8 text-center transition-colors',
                dragging
                  ? 'border-admin-accent bg-admin-accent/5'
                  : 'border-admin-line bg-admin-surface hover:border-admin-line-strong hover:bg-admin-raised/40',
              )}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={handleFileInput}
              />
              <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-admin-accent/10">
                {parsing ? (
                  <Loader2 className="h-5 w-5 animate-spin text-admin-accent" aria-hidden />
                ) : (
                  <Upload className="h-5 w-5 text-admin-accent" aria-hidden />
                )}
              </div>
              <p className="text-[13.5px] font-semibold text-admin-text">
                {parsing ? 'Lendo a planilha...' : fileName ? fileName : 'Arraste a planilha aqui'}
              </p>
              <p className="mt-1 text-xs text-admin-muted">Formato .xlsx · sem limite de tamanho</p>
              {!parsing && (
                <span className="mt-3.5 inline-flex items-center rounded-md border border-admin-line bg-admin-surface px-3.5 py-2 text-[12.5px] font-semibold text-admin-text">
                  {fileName ? 'Escolher outro arquivo' : 'Escolher arquivo'}
                </span>
              )}
            </label>

            {fileError && (
              <div className="flex items-start gap-2 rounded-lg border border-admin-destructive/30 bg-admin-destructive/10 px-3.5 py-2.5">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-admin-destructive" aria-hidden />
                <p className="text-[12.5px] leading-relaxed text-admin-destructive">{fileError}</p>
              </div>
            )}

            <button
              type="button"
              onClick={downloadTemplate}
              className="flex w-full items-center gap-3 rounded-lg border border-admin-line bg-admin-surface px-3.5 py-2.5 text-left transition-colors hover:bg-admin-raised/50"
            >
              <FileSpreadsheet className="h-4 w-4 shrink-0 text-admin-muted" aria-hidden />
              <span className="flex-1">
                <span className="block text-[12.5px] font-semibold text-admin-text">Baixar planilha modelo</span>
                <span className="block text-[11px] text-admin-muted">Use as colunas certas e evite erros</span>
              </span>
              <Download className="h-4 w-4 shrink-0 text-admin-muted" aria-hidden />
            </button>

            <p className="text-[11px] leading-relaxed text-admin-faint">
              Colunas esperadas: <span className="font-mono text-[10.5px] text-admin-muted">{COLUMNS_HINT}</span>
            </p>
          </div>
        </AdminPanel>

        {/* ── Passo 2 · Conferir antes de importar ── */}
        <AdminPanel flush className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-admin-line-subtle px-5 py-4">
            <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-admin-faint">
              Passo 2 · Conferir antes de importar
            </span>
            {fileName && (
              <span className="truncate pl-3 font-mono text-[11.5px] text-admin-muted">{fileName}</span>
            )}
          </div>

          <div className="bg-admin-bg p-5">
            {!hasFile ? (
              <AdminEmptyState
                icon={FileSpreadsheet}
                title="Nada para conferir ainda"
                description="Envie uma planilha no Passo 1 para ver aqui o que está pronto e o que precisa de ajuste."
              />
            ) : (
              <div className="space-y-4">
                {/* Dois contadores */}
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="rounded-xl border border-admin-line bg-admin-surface px-3.5 py-3">
                    <p className="mb-1 text-[11px] text-admin-muted">Prontas</p>
                    <p className="text-xl font-extrabold tabular-nums text-admin-success">{readyCount}</p>
                  </div>
                  <div
                    className={cn(
                      'rounded-xl border bg-admin-surface px-3.5 py-3',
                      errorCount > 0 ? 'border-admin-destructive/30' : 'border-admin-line',
                    )}
                  >
                    <p className="mb-1 text-[11px] text-admin-muted">Com erro</p>
                    <p
                      className={cn(
                        'text-xl font-extrabold tabular-nums',
                        errorCount > 0 ? 'text-admin-destructive' : 'text-admin-muted',
                      )}
                    >
                      {errorCount}
                    </p>
                  </div>
                </div>

                {errorCount === 0 ? (
                  <div className="flex items-start gap-2.5 rounded-xl border border-admin-success/30 bg-admin-success/10 px-4 py-3">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-admin-success" aria-hidden />
                    <p className="text-[12.5px] leading-relaxed text-admin-text">
                      Tudo certo. As {readyCount} questões estão prontas para importar.
                    </p>
                  </div>
                ) : (
                  <>
                    <p className="text-[12px] font-semibold text-admin-text">
                      {errorCount === 1
                        ? 'Corrija esta linha para importar tudo:'
                        : `Corrija estas ${errorCount} linhas para importar tudo:`}
                    </p>
                    <div className="overflow-hidden rounded-xl border border-admin-line bg-admin-surface">
                      {issueList.map((issue, i) => (
                        <div
                          key={issue.line}
                          className={cn(
                            'flex items-start gap-3 px-3.5 py-3',
                            i < issueList.length - 1 && 'border-b border-admin-line-subtle',
                          )}
                        >
                          <span className="shrink-0 rounded-md bg-admin-destructive/10 px-1.5 py-0.5 font-mono text-[11px] font-bold text-admin-destructive">
                            L{issue.line}
                          </span>
                          <div className="min-w-0">
                            <p className="text-[12.5px] font-semibold text-admin-text">{issue.what}</p>
                            <p className="mt-0.5 text-[11.5px] leading-relaxed text-admin-muted">{issue.how}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                {/* Ações */}
                <div className="flex flex-wrap items-center gap-2.5 pt-1">
                  <Button
                    variant="outline"
                    className="border-admin-line bg-admin-surface text-admin-text hover:bg-admin-raised"
                    onClick={resetParsedState}
                    disabled={uploading || parsing}
                  >
                    <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                    Enviar de novo
                  </Button>
                  <Button
                    className="bg-admin-accent text-admin-accent-contrast hover:bg-admin-accent/90"
                    onClick={handleUpload}
                    disabled={uploading || parsing || readyCount === 0}
                  >
                    {uploading ? (
                      <>
                        <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                        Importando...
                      </>
                    ) : (
                      `Importar ${readyCount} ${readyCount === 1 ? 'pronta' : 'prontas'}`
                    )}
                  </Button>
                  {totalImages > 0 && (
                    <Badge
                      variant="outline"
                      className="flex items-center gap-1 border-admin-line bg-admin-raised text-admin-muted"
                    >
                      <ImageIcon className="h-3 w-3" />
                      {totalImages} {totalImages === 1 ? 'imagem' : 'imagens'}
                    </Badge>
                  )}
                </div>

                {/* Verificação por IA (opcional, checa imagens e coerência) */}
                <div className="border-t border-admin-line-subtle pt-3.5">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-admin-muted hover:bg-admin-raised hover:text-admin-text"
                    onClick={runVerify}
                    disabled={verifying || uploading || parsing}
                  >
                    {verifying ? (
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <ScanSearch className="mr-1.5 h-3.5 w-3.5" />
                    )}
                    {verifying ? 'Verificando com a IA...' : 'Verificar imagens com a IA'}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </AdminPanel>
      </div>

      {/* Barra de progresso de envio/verificação */}
      {uploadProgress && (
        <AdminPanel className="space-y-2 px-4 py-3.5">
          <div className="flex items-center gap-2">
            {uploadProgress.percent < 100 && <Loader2 className="h-3.5 w-3.5 animate-spin text-admin-accent" />}
            {uploadProgress.percent === 100 && <CheckCircle2 className="h-3.5 w-3.5 text-admin-success" />}
            <span className="text-sm text-admin-muted">{uploadProgress.step}</span>
          </div>
          <Progress value={uploadProgress.percent} className="h-2 bg-admin-raised" />
        </AdminPanel>
      )}

      {/* Pré-visualização das questões lidas */}
      {hasFile && (
        <AdminPanel flush className="overflow-hidden">
          <div className="border-b border-admin-line-subtle px-5 py-4">
            <span className="text-base font-bold text-admin-text">
              Pré-visualização · {parsedRows.length} {parsedRows.length === 1 ? 'questão' : 'questões'}
            </span>
          </div>
          <div className="max-h-[500px] overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead className="min-w-[300px]">Enunciado</TableHead>
                  <TableHead>Grande Área</TableHead>
                  <TableHead>Especialidade</TableHead>
                  <TableHead>Gabarito</TableHead>
                  <TableHead className="w-16">Imagem</TableHead>
                  <TableHead className="w-20">Situação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {parsedRows.map((q, i) => {
                  const hasEnunciado = enunciadoImages.has(i);
                  const hasEnunciado2 = enunciado2Images.has(i);
                  const hasComentario = comentarioImages.has(i);
                  const issue = rowIssues.get(i);
                  return (
                    <TableRow
                      key={i}
                      onClick={() => setPreviewIndex(i)}
                      className="cursor-pointer hover:bg-admin-raised/40"
                    >
                      <TableCell>{q.numero}</TableCell>
                      <TableCell className="max-w-[400px] truncate text-xs">{q.Enunciado}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="border-admin-line bg-admin-raised text-xs text-admin-muted">
                          {q['Grande Área']}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs">{q.Especialidade}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="border-admin-accent/30 bg-admin-accent/10 text-admin-accent">
                          {q.Gabarito}
                        </Badge>
                      </TableCell>
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
                      <TableCell>
                        {issue ? (
                          <Badge variant="outline" className="border-admin-destructive/30 bg-admin-destructive/10 text-[10.5px] text-admin-destructive">
                            Com erro
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="border-admin-success/30 bg-admin-success/10 text-[10.5px] text-admin-success">
                            Pronta
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </AdminPanel>
      )}

      {/* Verificação por IA (imagens) */}
      {hasFile && (
        <VerifyFindingsPanel findings={[...structuralFindings, ...findings]} loading={verifying} aiRan={verifyRan} />
      )}

      <QuestionPreviewModal
        open={previewIndex !== null}
        onOpenChange={(open) => !open && setPreviewIndex(null)}
        row={previewIndex !== null ? parsedRows[previewIndex] : null}
        enunciadoImage={previewIndex !== null ? enunciadoImages.get(previewIndex) : undefined}
        enunciado2Image={previewIndex !== null ? enunciado2Images.get(previewIndex) : undefined}
        comentarioImage={previewIndex !== null ? comentarioImages.get(previewIndex) : undefined}
      />

      <AdminConfirmDialog
        open={confirmClearOpen}
        onOpenChange={setConfirmClearOpen}
        title="Limpar todas as questões?"
        description={`Isto remove as ${existingCount} questões já cadastradas neste simulado. Não dá para desfazer.`}
        confirmLabel="Limpar questões"
        destructive
        loading={clearing}
        onConfirm={handleDeleteExisting}
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
