# Admin Simulados Fase 4 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tornar a inserção de simulados confiável (imagem 2, fuso/validação de datas, UX do cadastro, verificador de IA de imagem faltando) e entregar uma tela de dados/ranking de concluintes ordenável, filtrável e com drill-down.

**Architecture:** Frontend React+Vite com `@/` alias; serviços via `adminApi` chamando RPCs Supabase `SECURITY DEFINER` (capability-gated por `admin_require`) e Edge Functions Deno. Lógica pura isolada em `src/admin/lib` e `src/admin/utils` (testável com Vitest). Migrations aditivas aplicadas direto no banco de produção via MCP Supabase; **a fonte da verdade do schema é `supabase/migrations-log.md`** — registrar cada migration lá. Worktree: `.claude/worktrees/admin-simulados-fase4`, branch `feat/admin-simulados-fase4`.

**Tech Stack:** TypeScript 5.8, React 18, React Router 6, TanStack Query 5, shadcn/ui, Tailwind (tokens `--admin-*`), Vitest 3, Supabase (Postgres+RLS+RPC, Edge Functions Deno), Gemini API (`gemini-2.5-flash`).

**Spec:** `docs/superpowers/specs/2026-06-17-admin-simulados-fase4-design.md`

**Convenções de teste deste projeto:** arquivos `*.test.ts(x)` ao lado do código; rodar com `npm run test -- <path>`; `npm run lint`; `npx tsc --noEmit`. Edge functions Deno não rodam no Vitest — testar apenas helpers puros extraídos (ver Tasks B1, A1).

**Pré-flight (rodar uma vez antes da Task A1):** garantir deps no worktree. Se `node_modules` não existir, criar junction conforme memória do projeto (worktree compartilha deps do checkout principal) ou `npm ci`. Validar com `npm run test -- src/lib/simulado-helpers.test.ts` (deve passar).

---

## GRUPO A — Imagem 2 (planilha → banco)

Pipeline atual de imagens (já mapeado):
- `src/admin/utils/xlsxImageExtractor.ts` — extrai imagens coladas, mapeia por âncora→coluna. Hoje só reconhece `enunciadoCol`/`comentarioCol` e tem um fallback `Math.abs(col-known)<=1` que **vaza** imagem pra coluna errada.
- `src/admin/pages/AdminUploadQuestions.tsx` — orquestra parse+extração+upload pro bucket `question-images`, monta `image_urls` e chama a Edge Function.
- `supabase/functions/admin-upload-questions/index.ts` — insere `questions`, mapeia `enunciado_url`→`image_url`, `comentario_url`→`explanation_image_url`. **Falta** `enunciado2_url`→`image_url_2` (coluna já existe na tabela).
- `src/admin/components/QuestionPreviewModal.tsx` — preview por questão.

### Task A1: Extrator reconhece a 3ª coluna (imagem 2) e para de vazar

**Files:**
- Modify: `src/admin/utils/xlsxImageExtractor.ts`
- Test: `src/admin/utils/xlsxImageExtractor.test.ts` (criar)

**Objetivo:** detectar a coluna "imagem 2 do enunciado" no cabeçalho, retornar um 3º mapa `enunciado2Images`, e tornar a atribuição imagem→slot **estrita** (sem o fallback ±1 que confunde imagem 2 com enunciado).

- [ ] **Step 1 — Refatorar para expor a lógica testável.** Extrair de `findImageColumns` uma função pura exportada que mapeia headers→colunas suportando a 3ª coluna, e uma função pura que decide o slot a partir do índice de coluna. Adicionar ao topo do arquivo:

```ts
export type ImageSlot = 'enunciado' | 'enunciado2' | 'comentario';

export interface ImageColumns {
  enunciadoCol: number;
  enunciado2Col: number;
  comentarioCol: number;
}

/** Aliases normalizados (sem acento, minúsculo) por slot. */
const IMAGE_HEADER_ALIASES: Record<ImageSlot, string[]> = {
  enunciado: ['imagem do enunciado', 'imagem enunciado', 'imagem'],
  enunciado2: ['imagem 2 do enunciado', 'imagem 2 enunciado', 'imagem 2', 'img 2', 'imagem secundaria', 'segunda imagem'],
  comentario: ['imagem do comentario', 'imagem comentario', 'imagem do comentário'],
};

/** Decide o slot de uma imagem a partir do índice de coluna. Estrito: sem tolerância ±1. */
export function slotForColumn(col: number, cols: ImageColumns): ImageSlot | null {
  if (cols.enunciado2Col >= 0 && col === cols.enunciado2Col) return 'enunciado2';
  if (cols.enunciadoCol >= 0 && col === cols.enunciadoCol) return 'enunciado';
  if (cols.comentarioCol >= 0 && col === cols.comentarioCol) return 'comentario';
  return null;
}

/** Casa o texto de um header de coluna com um slot, via aliases normalizados. */
export function slotForHeader(headerText: string): ImageSlot | null {
  const n = normalize(headerText);
  // ordem importa: 'imagem 2' antes de 'imagem' pra não ser engolido
  for (const slot of ['enunciado2', 'comentario', 'enunciado'] as ImageSlot[]) {
    if (IMAGE_HEADER_ALIASES[slot].some((a) => n === a)) return slot;
  }
  return null;
}
```

- [ ] **Step 2 — Escrever os testes (falhando).** Criar `src/admin/utils/xlsxImageExtractor.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { slotForColumn, slotForHeader } from './xlsxImageExtractor';

describe('slotForHeader', () => {
  it('reconhece imagem do enunciado', () => {
    expect(slotForHeader('Imagem do Enunciado')).toBe('enunciado');
  });
  it('reconhece imagem 2 do enunciado e não confunde com enunciado', () => {
    expect(slotForHeader('Imagem 2 do Enunciado')).toBe('enunciado2');
    expect(slotForHeader('Imagem 2')).toBe('enunciado2');
  });
  it('reconhece imagem do comentário com acento', () => {
    expect(slotForHeader('Imagem do Comentário')).toBe('comentario');
  });
  it('retorna null pra header desconhecido', () => {
    expect(slotForHeader('Enunciado')).toBeNull();
  });
});

describe('slotForColumn (estrito, sem ±1)', () => {
  const cols = { enunciadoCol: 5, enunciado2Col: 6, comentarioCol: 11 };
  it('mapeia cada coluna ao seu slot', () => {
    expect(slotForColumn(5, cols)).toBe('enunciado');
    expect(slotForColumn(6, cols)).toBe('enunciado2');
    expect(slotForColumn(11, cols)).toBe('comentario');
  });
  it('NÃO vaza coluna vizinha pro slot errado', () => {
    expect(slotForColumn(7, cols)).toBeNull();
    expect(slotForColumn(4, cols)).toBeNull();
  });
});
```

- [ ] **Step 3 — Rodar e ver falhar.** `npm run test -- src/admin/utils/xlsxImageExtractor.test.ts` → FAIL (funções não exportadas / lógica ausente).

- [ ] **Step 4 — Implementar.** No `xlsxImageExtractor.ts`:
  - Reescrever `findImageColumns` para usar `slotForHeader` e retornar `ImageColumns` (3 colunas).
  - Trocar a assinatura de `extractImagesFromXlsx` para retornar `{ enunciadoImages, enunciado2Images, comentarioImages }` (3 mapas).
  - No loop de âncoras, substituir o bloco `if (enunciadoCol >= 0 && col === enunciadoCol) ... else if comentario ... else fallback±1` por:

```ts
const slot = slotForColumn(col, cols);
if (slot === 'enunciado') enunciadoImages.set(dataRow, image);
else if (slot === 'enunciado2') enunciado2Images.set(dataRow, image);
else if (slot === 'comentario') comentarioImages.set(dataRow, image);
// sem slot reconhecido: ignora (não chuta vizinho)
```
  - Manter o `logger.info` incluindo `enunciado2Col` e `enunciado2Found`.

- [ ] **Step 5 — Rodar e ver passar.** `npm run test -- src/admin/utils/xlsxImageExtractor.test.ts` → PASS.

- [ ] **Step 6 — Commit.**
```bash
git add src/admin/utils/xlsxImageExtractor.ts src/admin/utils/xlsxImageExtractor.test.ts
git commit -m "feat(admin-upload): extrator reconhece coluna imagem 2 e mapeia slot estrito"
```

### Task A2: Edge Function grava image_url_2

**Files:**
- Modify: `supabase/functions/admin-upload-questions/index.ts`

- [ ] **Step 1 — Ampliar o urlMap.** Trocar o tipo (linha ~63) para:
```ts
const urlMap: Record<number, { enunciado_url?: string; enunciado2_url?: string; comentario_url?: string }> = image_urls || {};
```
- [ ] **Step 2 — Mapear o 3º slot.** Logo após `if (urls?.comentario_url) explanationImageUrl = urls.comentario_url;` adicionar:
```ts
let imageUrl2: string | null = q.image_url_2 || null;
if (urls?.enunciado2_url) imageUrl2 = urls.enunciado2_url;
```
(declarar `imageUrl2` junto de `imageUrl`/`explanationImageUrl` no topo do loop).
- [ ] **Step 3 — Inserir no insert.** No objeto `.insert({...})` da tabela `questions`, adicionar a linha:
```ts
image_url_2: imageUrl2,
```
- [ ] **Step 4 — Deploy.** Deploy via MCP Supabase (`deploy_edge_function`, name `admin-upload-questions`) ou anotar para deploy manual. Sem teste automatizado (Deno + IO). Verificação ocorre na Task A4 (upload real) / smoke.
- [ ] **Step 5 — Commit.**
```bash
git add supabase/functions/admin-upload-questions/index.ts
git commit -m "feat(admin-upload): edge function grava image_url_2 (enunciado2_url)"
```

### Task A3: Upload UI plumba imagem 2 (parse → bucket → payload)

**Files:**
- Modify: `src/admin/pages/AdminUploadQuestions.tsx`

- [ ] **Step 1 — Tipos.** Em `ParsedRow` adicionar `'Imagem 2 do Enunciado': string;`. Em `NormalizedQuestion` adicionar `image_url_2: string;`.
- [ ] **Step 2 — Alias de header.** Em `HEADER_ALIASES` adicionar a chave:
```ts
'Imagem 2 do Enunciado': ['imagem 2 do enunciado', 'imagem 2 enunciado', 'imagem 2', 'img 2', 'imagem secundaria', 'segunda imagem'],
```
- [ ] **Step 3 — normalizeRow.** Adicionar `image_url_2: normalizeStoragePublicUrl(row['Imagem 2 do Enunciado']),`.
- [ ] **Step 4 — Estado e captura.** Adicionar estado `const [enunciado2Images, setEnunciado2Images] = useState<Map<number, ExtractedImage>>(new Map());`. Em `handleFile`, desestruturar o 3º mapa do extrator e `setEnunciado2Images`. Incluir seu tamanho no toast e em `totalImages`.
- [ ] **Step 5 — Jobs de upload.** Em `handleUpload`:
  - Tipo de `imageJobs` kind: `'enunciado' | 'enunciado2' | 'comentario'`.
  - Adicionar `const e2Img = enunciado2Images.get(index); if (e2Img) imageJobs.push({ qNum, kind: 'enunciado2', img: e2Img });`.
  - Tipo de `imageUrls`: `Record<number, { enunciado_url?: string; enunciado2_url?: string; comentario_url?: string }>`.
  - No `worker`, path `${simuladoId}/${job.qNum}_${job.kind}.${ext}` já cobre `enunciado2`. Na atribuição do resultado: `if (job.kind === 'enunciado') ...enunciado_url; else if (job.kind === 'enunciado2') imageUrls[job.qNum].enunciado2_url = pub.publicUrl; else ...comentario_url;`.
  - Resetar `setEnunciado2Images(new Map())` no sucesso.
- [ ] **Step 6 — Preview/coluna Img.** Na tabela de preview adicionar indicador de imagem 2 (3º ícone, cor distinta). Passar `enunciado2Image={...enunciado2Images.get(previewIndex)...}` ao `QuestionPreviewModal`. Atualizar o texto de "Colunas esperadas" incluindo `Imagem 2 do Enunciado`.
- [ ] **Step 7 — Verificar tipos/lint.** `npx tsc --noEmit` e `npm run lint` → sem erros novos.
- [ ] **Step 8 — Commit.**
```bash
git add src/admin/pages/AdminUploadQuestions.tsx
git commit -m "feat(admin-upload): captura/sobe imagem 2 do enunciado e passa enunciado2_url"
```

### Task A4: Preview mostra os 3 slots com vazios sinalizados

**Files:**
- Modify: `src/admin/components/QuestionPreviewModal.tsx`

- [ ] **Step 1 — Prop.** Adicionar `enunciado2Image?: ExtractedImage;` em `Props` e desestruturar.
- [ ] **Step 2 — Render imagem 2.** Após o bloco da imagem do enunciado, renderizar a imagem 2 (mesmo estilo de `<img>`), com legenda "Imagem 2".
- [ ] **Step 3 — Sinalizar slots vazios.** Adicionar um rodapé discreto no modal listando o status dos 3 slots desta questão: ✓ presente / — vazio, ex.:
```tsx
<div className="mt-6 flex gap-3 text-xs text-admin-muted border-t border-admin-line pt-3">
  <span>Enunciado: {enunciadoUrl ? '✓ imagem' : '— sem imagem'}</span>
  <span>Imagem 2: {toDataUrl(enunciado2Image) ? '✓ imagem' : '— sem imagem'}</span>
  <span>Comentário: {comentarioUrl ? '✓ imagem' : '— sem imagem'}</span>
</div>
```
- [ ] **Step 4 — Verificar.** `npx tsc --noEmit`.
- [ ] **Step 5 — Commit.**
```bash
git add src/admin/components/QuestionPreviewModal.tsx
git commit -m "feat(admin-upload): preview exibe imagem 2 e status dos 3 slots"
```

---

## GRUPO B — Verificador de IA (imagem faltando)

Reusa o padrão Gemini de `supabase/functions/gemini-error-notebook-review/index.ts`: `GEMINI_API_KEY`, `gemini-2.5-flash`, `responseMimeType:'application/json'` + `responseSchema`, CORS, fetch para `generativelanguage.googleapis.com/v1beta/...:generateContent`.

### Task B1: Edge Function `admin-verify-questions`

**Files:**
- Create: `supabase/functions/admin-verify-questions/index.ts`

- [ ] **Step 1 — Implementar a função.** Conteúdo completo:

```ts
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface QuestionInput {
  question_number: number;
  enunciado_text: string;
  comentario_text?: string;
  has_image: boolean;
  has_image_2: boolean;
  has_explanation_image: boolean;
}

interface Finding {
  question_number: number;
  check_type: 'missing_image';
  slot: 'enunciado' | 'enunciado2' | 'comentario';
  severity: 'error' | 'warning';
  evidence: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const apiKey = Deno.env.get('GEMINI_API_KEY');
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'GEMINI_API_KEY não configurada', findings: [] }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { questions } = (await req.json()) as { questions: QuestionInput[] };
    if (!Array.isArray(questions) || questions.length === 0) {
      return new Response(JSON.stringify({ findings: [] }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const lines = questions.map((q) =>
      `Q${q.question_number} | tem_imagem_enunciado=${q.has_image} tem_imagem2=${q.has_image_2} tem_imagem_comentario=${q.has_explanation_image}\n` +
      `ENUNCIADO: ${q.enunciado_text}\n` +
      (q.comentario_text ? `COMENTARIO: ${q.comentario_text}\n` : '')
    ).join('\n---\n');

    const prompt = `Você é um revisor de banco de questões médicas. Para cada questão abaixo, detecte se o TEXTO faz referência a uma figura/imagem (ex.: "observe a radiografia", "imagem a seguir", "figuras A e B", "o ECG mostra", "eletrocardiograma abaixo", "ausculte", "exame de imagem", "fundoscopia") MAS o slot de imagem correspondente está VAZIO (false).

Regras:
- slot "enunciado": referência a figura no enunciado e has_image=false.
- slot "enunciado2": o enunciado cita DUAS ou mais figuras (ex.: "figuras A e B", "imagens 1 e 2") e has_image_2=false.
- slot "comentario": o COMENTARIO referencia figura e has_explanation_image=false.
- severity "error" quando a referência é inequívoca; "warning" quando é possível mas ambígua.
- Se a referência existe e o slot correspondente já tem imagem (true), NÃO reporte.
- "evidence" = trecho curto do texto que motivou o achado.

Retorne JSON com "findings". Sem texto fora do JSON.

QUESTÕES:
${lines}`;

    const responseSchema = {
      type: 'OBJECT',
      properties: {
        findings: {
          type: 'ARRAY',
          items: {
            type: 'OBJECT',
            properties: {
              question_number: { type: 'INTEGER' },
              check_type: { type: 'STRING' },
              slot: { type: 'STRING' },
              severity: { type: 'STRING' },
              evidence: { type: 'STRING' },
            },
            required: ['question_number', 'check_type', 'slot', 'severity', 'evidence'],
          },
        },
      },
      required: ['findings'],
    };

    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 4000,
            thinkingConfig: { thinkingBudget: 0 },
            responseMimeType: 'application/json',
            responseSchema,
          },
        }),
      },
    );

    if (!r.ok) {
      const txt = await r.text();
      console.error('[admin-verify-questions] Gemini error', r.status, txt);
      return new Response(JSON.stringify({ error: `Gemini erro ${r.status}`, findings: [] }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const data = await r.json();
    const rawJson = data?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? '').join('') ?? '';
    let findings: Finding[] = [];
    try {
      const parsed = JSON.parse(rawJson);
      findings = Array.isArray(parsed.findings) ? parsed.findings : [];
    } catch (e) {
      console.error('[admin-verify-questions] parse error', e, rawJson.slice(0, 300));
    }

    return new Response(JSON.stringify({ findings }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[admin-verify-questions] error', err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : 'unknown', findings: [] }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
```
Nota de design: a função sempre retorna `200` com `findings:[]` em falha/degradação — o consumidor nunca quebra; a ausência de achados não bloqueia o upload.

- [ ] **Step 2 — Deploy.** Deploy via MCP Supabase (`deploy_edge_function`, name `admin-verify-questions`).
- [ ] **Step 3 — Commit.**
```bash
git add supabase/functions/admin-verify-questions/index.ts
git commit -m "feat(admin): edge function admin-verify-questions (Gemini, check imagem faltando)"
```

### Task B2: Cliente no adminApi + tipo de achado

**Files:**
- Modify: `src/admin/services/adminApi.ts`
- Modify: `src/admin/services/adminTypes.ts` (ou o módulo de tipos usado pelo adminApi — confirmar onde `SimuladoQuestionStat` etc. estão declarados; criar tipo lá)
- Test: `src/admin/services/verifyFindings.test.ts` (criar) — testa apenas o agrupamento/normalização puro

- [ ] **Step 1 — Tipo.** Declarar:
```ts
export interface QuestionVerifyFinding {
  question_number: number;
  check_type: 'missing_image';
  slot: 'enunciado' | 'enunciado2' | 'comentario';
  severity: 'error' | 'warning';
  evidence: string;
}
export interface QuestionVerifyInput {
  question_number: number;
  enunciado_text: string;
  comentario_text?: string;
  has_image: boolean;
  has_image_2: boolean;
  has_explanation_image: boolean;
}
```
- [ ] **Step 2 — Helper puro + teste (falhando).** Criar `src/admin/lib/verifyFindings.ts` com uma função pura de ordenação/contagem (separa erros de avisos), e o teste:
```ts
import { describe, it, expect } from 'vitest';
import { summarizeFindings } from './verifyFindings';

it('conta erros e avisos e ordena por questão', () => {
  const out = summarizeFindings([
    { question_number: 5, check_type: 'missing_image', slot: 'enunciado', severity: 'warning', evidence: 'x' },
    { question_number: 2, check_type: 'missing_image', slot: 'enunciado', severity: 'error', evidence: 'y' },
  ]);
  expect(out.errorCount).toBe(1);
  expect(out.warningCount).toBe(1);
  expect(out.byQuestion[0].question_number).toBe(2);
});
```
Implementar `summarizeFindings`:
```ts
import type { QuestionVerifyFinding } from '../services/adminApi';
export function summarizeFindings(findings: QuestionVerifyFinding[]) {
  const byQuestion = [...findings].sort((a, b) => a.question_number - b.question_number);
  return {
    errorCount: findings.filter((f) => f.severity === 'error').length,
    warningCount: findings.filter((f) => f.severity === 'warning').length,
    byQuestion,
  };
}
```
(Se houver dependência circular de tipos, declarar `QuestionVerifyFinding` em `verifyFindings.ts` e reexportar no adminApi.)
- [ ] **Step 3 — Rodar/ver passar.** `npm run test -- src/admin/lib/verifyFindings.test.ts`.
- [ ] **Step 4 — Método no adminApi.**
```ts
async verifyQuestions(questions: QuestionVerifyInput[]): Promise<QuestionVerifyFinding[]> {
  const { data, error } = await supabase.functions.invoke('admin-verify-questions', { body: { questions } });
  if (error) throw error;
  return (data?.findings ?? []) as QuestionVerifyFinding[];
}
```
- [ ] **Step 5 — Commit.**
```bash
git add src/admin/services/adminApi.ts src/admin/lib/verifyFindings.ts src/admin/lib/verifyFindings.test.ts
git commit -m "feat(admin): cliente verifyQuestions + summarizeFindings"
```

### Task B3: Verificação no upload (antes de gravar) + painel de achados

**Files:**
- Modify: `src/admin/pages/AdminUploadQuestions.tsx`
- Create: `src/admin/components/VerifyFindingsPanel.tsx`

- [ ] **Step 1 — Componente de painel.** `VerifyFindingsPanel` recebe `findings: QuestionVerifyFinding[]`, `loading: boolean`, e renderiza usando `summarizeFindings`: cabeçalho com contagem (N erros, M avisos), lista de achados (cor por severity, "Q{n} — {slot} ausente", evidence). Vazio + não-loading → "Nenhuma imagem faltando detectada ✓". Seguir tokens `--admin-*` (ver estilo do exemplo no spec / `AdminEmptyState`).
- [ ] **Step 2 — Botão "Verificar com IA" no preview.** Em `AdminUploadQuestions`, adicionar estado `findings`, `verifying`. Função `runVerify()` monta `QuestionVerifyInput[]` a partir de `parsedRows` + os mapas de imagem:
```ts
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
```
  Renderizar o botão (ao lado de "Enviar N questões") e o `VerifyFindingsPanel` abaixo do preview quando `parsedRows.length > 0`.
- [ ] **Step 3 — Não bloquear.** O upload permanece habilitado independentemente dos achados (o admin decide). Achados são informativos.
- [ ] **Step 4 — Verificar.** `npx tsc --noEmit`, `npm run lint`.
- [ ] **Step 5 — Commit.**
```bash
git add src/admin/pages/AdminUploadQuestions.tsx src/admin/components/VerifyFindingsPanel.tsx
git commit -m "feat(admin-upload): verificador de IA na prévia (imagem faltando)"
```

### Task B4: Botão de verificação pós-upload (questões já gravadas)

**Files:**
- Modify: `src/admin/pages/AdminQuestionManager.tsx`
- Modify: `src/admin/services/adminApi.ts` (reusa `admin_get_simulado_questions` já existente)

- [ ] **Step 1 — Botão + chamada.** Em `AdminQuestionManager`, adicionar botão "Verificar com IA" no header. Monta `QuestionVerifyInput[]` a partir das questões carregadas (`admin_get_simulado_questions` retorna `text`, `explanation`, `image_url`, `image_url_2`, `explanation_image_url`):
```ts
const inputs = questions.map((q) => ({
  question_number: q.question_number,
  enunciado_text: q.text ?? '',
  comentario_text: q.explanation ?? '',
  has_image: !!q.image_url,
  has_image_2: !!q.image_url_2,
  has_explanation_image: !!q.explanation_image_url,
}));
```
  Exibir o mesmo `VerifyFindingsPanel` (em dialog ou seção). Achado clicável → abre o editor da questão correspondente (reusa o fluxo de edição existente).
- [ ] **Step 2 — Verificar.** `npx tsc --noEmit`.
- [ ] **Step 3 — Commit.**
```bash
git add src/admin/pages/AdminQuestionManager.tsx
git commit -m "feat(admin): verificar com IA no editor de questões (pós-upload)"
```

---

## GRUPO C — Datas, fuso e validação

### Task C1: Módulo de fuso (America/Sao_Paulo)

**Files:**
- Create: `src/admin/lib/timezone.ts`
- Test: `src/admin/lib/timezone.test.ts`

- [ ] **Step 1 — Testes (falhando).**
```ts
import { describe, it, expect } from 'vitest';
import { localInputToUtcISO, utcISOToLocalInput, formatWindowSummary } from './timezone';

describe('timezone America/Sao_Paulo (UTC-3, sem DST desde 2019)', () => {
  it('converte input local pra UTC ISO (+3h)', () => {
    expect(localInputToUtcISO('2026-06-20T14:00')).toBe('2026-06-20T17:00:00.000Z');
  });
  it('converte UTC ISO de volta pro input local (-3h)', () => {
    expect(utcISOToLocalInput('2026-06-20T17:00:00.000Z')).toBe('2026-06-20T14:00');
  });
  it('round-trip', () => {
    const local = '2026-12-31T23:30';
    expect(utcISOToLocalInput(localInputToUtcISO(local))).toBe(local);
  });
  it('summary humano com label de Brasília', () => {
    const s = formatWindowSummary(
      '2026-06-20T17:00:00.000Z', '2026-06-20T19:00:00.000Z', '2026-06-22T12:00:00.000Z',
    );
    expect(s).toContain('horário de Brasília');
    expect(s).toContain('14:00');
    expect(s).toContain('16:00');
  });
});
```
- [ ] **Step 2 — Rodar/ver falhar.** `npm run test -- src/admin/lib/timezone.test.ts`.
- [ ] **Step 3 — Implementar.**
```ts
const TZ = 'America/Sao_Paulo';

/** Offset (min) do tz para um instante UTC. -180 = UTC-3. */
function tzOffsetMinutes(date: Date, tz: string = TZ): number {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
  const p: Record<string, string> = {};
  for (const part of dtf.formatToParts(date)) p[part.type] = part.value;
  const asUTC = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  return (asUTC - date.getTime()) / 60000;
}

/** 'YYYY-MM-DDTHH:mm' (hora de Brasília) -> ISO UTC. */
export function localInputToUtcISO(local: string, tz: string = TZ): string {
  if (!local) return '';
  const [d, t] = local.split('T');
  const [y, mo, da] = d.split('-').map(Number);
  const [h, mi] = (t ?? '00:00').split(':').map(Number);
  const guess = Date.UTC(y, mo - 1, da, h, mi);
  const offset = tzOffsetMinutes(new Date(guess), tz);
  return new Date(guess - offset * 60000).toISOString();
}

/** ISO UTC -> 'YYYY-MM-DDTHH:mm' (hora de Brasília) p/ <input datetime-local>. */
export function utcISOToLocalInput(iso: string, tz: string = TZ): string {
  if (!iso) return '';
  const date = new Date(iso);
  const dtf = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz, hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  });
  const p: Record<string, string> = {};
  for (const part of dtf.formatToParts(date)) p[part.type] = part.value;
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}

function fmt(iso: string, tz: string = TZ): string {
  if (!iso) return '—';
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: tz, weekday: 'short', day: '2-digit', month: '2-digit',
    hour: '2-digit', minute: '2-digit',
  }).format(new Date(iso));
}

/** Resumo legível das três datas (gravadas em UTC). */
export function formatWindowSummary(startISO: string, endISO: string, releaseISO: string, tz: string = TZ): string {
  return `Abre ${fmt(startISO, tz)} · Fecha ${fmt(endISO, tz)} · Resultado ${fmt(releaseISO, tz)} — horário de Brasília`;
}
```
- [ ] **Step 4 — Rodar/ver passar.** `npm run test -- src/admin/lib/timezone.test.ts`.
- [ ] **Step 5 — Commit.**
```bash
git add src/admin/lib/timezone.ts src/admin/lib/timezone.test.ts
git commit -m "feat(admin): módulo de fuso America/Sao_Paulo (input<->UTC + resumo)"
```

### Task C2: Validação de janela mais forte

**Files:**
- Modify: `src/admin/lib/validateWindows.ts`
- Test: `src/admin/lib/validateWindows.test.ts` (criar)

- [ ] **Step 1 — Testes (falhando).** Cobrir: fim≤início → erro; release<fim → erro; tudo coerente → null; (novo) `validateWindows` aceita 4º arg `durationMinutes` e retorna aviso textual se `fim-início < duração`. Manter retorno `string | null` (erro) e adicionar função separada `windowWarnings(start, end, release, durationMinutes, nowISO?)` que retorna `string[]` de avisos (janela no passado; duração maior que a janela). Testes:
```ts
import { describe, it, expect } from 'vitest';
import { validateWindows, windowWarnings } from './validateWindows';

it('erro quando fim <= início', () => {
  expect(validateWindows('2026-06-20T17:00:00Z', '2026-06-20T17:00:00Z', '')).toMatch(/terminar/);
});
it('ok quando coerente', () => {
  expect(validateWindows('2026-06-20T17:00:00Z', '2026-06-20T19:00:00Z', '2026-06-21T12:00:00Z')).toBeNull();
});
it('avisa janela no passado', () => {
  const w = windowWarnings('2020-01-01T00:00:00Z', '2020-01-01T02:00:00Z', '', 60, '2026-06-17T00:00:00Z');
  expect(w.some((m) => /passado/i.test(m))).toBe(true);
});
it('avisa duração maior que a janela', () => {
  const w = windowWarnings('2026-06-20T17:00:00Z', '2026-06-20T18:00:00Z', '', 120, '2026-06-01T00:00:00Z');
  expect(w.some((m) => /duração/i.test(m))).toBe(true);
});
```
- [ ] **Step 2 — Rodar/ver falhar.**
- [ ] **Step 3 — Implementar.** Manter `validateWindows` como está (erros bloqueantes) e adicionar:
```ts
/** Avisos não-bloqueantes (string[]). nowISO injetável p/ teste. */
export function windowWarnings(
  start: string, end: string, release: string, durationMinutes: number, nowISO?: string,
): string[] {
  const out: string[] = [];
  if (!start || !end) return out;
  const now = nowISO ? new Date(nowISO) : new Date();
  if (new Date(start) < now) out.push('Atenção: a janela começa no passado.');
  const windowMin = (new Date(end).getTime() - new Date(start).getTime()) / 60000;
  if (durationMinutes && windowMin < durationMinutes) {
    out.push(`Atenção: a duração da prova (${durationMinutes} min) é maior que a janela (${Math.round(windowMin)} min).`);
  }
  return out;
}
```
- [ ] **Step 4 — Rodar/ver passar.**
- [ ] **Step 5 — Commit.**
```bash
git add src/admin/lib/validateWindows.ts src/admin/lib/validateWindows.test.ts
git commit -m "feat(admin): avisos de janela (passado, duração > janela)"
```

### Task C3: Form usa fuso correto + resumo (integração)

**Files:**
- Modify: `src/admin/pages/AdminSimuladoForm.tsx`

- [ ] **Step 1 — Carregar com fuso.** No `useEffect` de edição, trocar `s.execution_window_start.slice(0, 16)` por `utcISOToLocalInput(s.execution_window_start)` (idem end e release). Importar de `@/admin/lib/timezone`.
- [ ] **Step 2 — Salvar com fuso.** No `payload`, trocar `new Date(form.x).toISOString()` por `localInputToUtcISO(form.x)` (start/end/release).
- [ ] **Step 3 — Avisos.** Após `validateWindows` (erro bloqueante), computar `windowWarnings(...)` (passando `Number(form.duration_minutes)`); se houver avisos, exibir via `toast` informativo (não bloqueante) mas seguir o submit. Alternativamente renderizar inline (ver Step 4).
- [ ] **Step 4 — Resumo legível inline.** Abaixo dos 3 campos de data, renderizar `formatWindowSummary(localInputToUtcISO(start), ..., ...)` quando os três estiverem preenchidos, com label "(horário de Brasília)" e os avisos de `windowWarnings` em destaque âmbar.
- [ ] **Step 5 — Verificar.** `npx tsc --noEmit`, `npm run lint`. (A reorganização visual em seções vem na Task D1; aqui só corrige o fuso e adiciona o resumo.)
- [ ] **Step 6 — Commit.**
```bash
git add src/admin/pages/AdminSimuladoForm.tsx
git commit -m "fix(admin-form): grava/exibe datas em horário de Brasília + resumo e avisos"
```

---

## GRUPO D — Cadastro (reorganização de UX)

### Task D1: Form em seções + slug auto + questions_count derivado + microcopy de status

**Files:**
- Modify: `src/admin/pages/AdminSimuladoForm.tsx`
- Create: `src/admin/lib/slugify.ts` + `src/admin/lib/slugify.test.ts`

- [ ] **Step 1 — slugify (TDD).** Teste:
```ts
import { describe, it, expect } from 'vitest';
import { slugify } from './slugify';
it('gera slug de título', () => {
  expect(slugify('Simulado ENAMED 2026 — Edição 1')).toBe('simulado-enamed-2026-edicao-1');
});
it('remove acentos e colapsa hífens', () => {
  expect(slugify('  Avaliação   Clínica!! ')).toBe('avaliacao-clinica');
});
```
Implementar:
```ts
export function slugify(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}
```
Rodar `npm run test -- src/admin/lib/slugify.test.ts`.
- [ ] **Step 2 — Slug auto.** No form, quando criando (`!isEdit`) e o slug não foi editado manualmente, derivar `slug` de `title` via `slugify` a cada mudança de título (flag `slugTouched`). Em edição, não auto-sobrescrever.
- [ ] **Step 3 — questions_count derivado.** Em edição, buscar a contagem real (`adminApi.getQuestionsCount(id)`); tornar o campo read-only exibindo o valor real, com aviso se o `questions_count` persistido divergir. Em criação, ocultar/desabilitar (será setado no upload). Texto auxiliar: "Definido automaticamente pelo upload de questões."
- [ ] **Step 4 — Seções.** Reorganizar o JSX em 4 `Card`/blocos com `AdminSectionHeader` (ou subtítulos): **Identificação** (título, slug, nº sequencial), **Conteúdo** (descrição, duração, tags, questions_count), **Agenda** (as 3 datas + resumo da Task C3), **Publicação** (status com microcopy por opção: Rascunho = "não aparece pro aluno"; Publicado = "visível na janela"; Teste = "só admins"). Manter `inputCls` e tokens admin.
- [ ] **Step 5 — Verificar.** `npx tsc --noEmit`, `npm run lint`.
- [ ] **Step 6 — Commit.**
```bash
git add src/admin/pages/AdminSimuladoForm.tsx src/admin/lib/slugify.ts src/admin/lib/slugify.test.ts
git commit -m "feat(admin-form): seções, slug automático, questions_count derivado, microcopy de status"
```

---

## GRUPO E — AdminDataTable ordenável

### Task E1: Ordenação por cabeçalho (retrocompatível)

**Files:**
- Modify: `src/admin/components/ui/AdminDataTable.tsx`
- Test: `src/admin/components/ui/AdminDataTable.test.tsx` (criar)

- [ ] **Step 1 — Testes (falhando).** Usando Testing Library: tabela com `sortKey`/`sortDir`/`onSort`; clicar num header com `sortable` chama `onSort(key)` e mostra o indicador. Colunas sem `sortable` não chamam.
```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { AdminDataTable } from './AdminDataTable';

it('chama onSort ao clicar em header sortable', () => {
  const onSort = vi.fn();
  render(<AdminDataTable
    columns={[{ key: 'nome', label: 'Nome', sortable: true }, { key: 'x', label: 'X' }]}
    data={[{ nome: 'a', x: '1' }]}
    sortKey="nome" sortDir="asc" onSort={onSort}
  />);
  fireEvent.click(screen.getByText('Nome'));
  expect(onSort).toHaveBeenCalledWith('nome');
  fireEvent.click(screen.getByText('X'));
  expect(onSort).toHaveBeenCalledTimes(1);
});
```
- [ ] **Step 2 — Rodar/ver falhar.**
- [ ] **Step 3 — Implementar.** Adicionar a `Column<T>` o campo opcional `sortable?: boolean`. Adicionar props opcionais `sortKey?: string; sortDir?: 'asc' | 'desc'; onSort?: (key: string) => void;`. No header, se `column.sortable && onSort`, envolver o label num `<button>` acessível que chama `onSort(c.key)` e renderiza indicador (`▴`/`▾` quando `sortKey===c.key`, senão `⇅`). Sem `onSort`, comportamento atual intacto.
- [ ] **Step 4 — Rodar/ver passar.**
- [ ] **Step 5 — Commit.**
```bash
git add src/admin/components/ui/AdminDataTable.tsx src/admin/components/ui/AdminDataTable.test.tsx
git commit -m "feat(admin-ui): AdminDataTable com ordenação por cabeçalho (opt-in)"
```

---

## GRUPO F — Dados & ranking de concluintes

### Task F1: Capability `results.view` (migration)

**Files:**
- DB (migration via MCP Supabase `apply_migration`, name `fase4_results_view_capability`)
- Modify: `supabase/migrations-log.md` (registrar)

- [ ] **Step 1 — Inspecionar.** `list_tables` / `execute_sql` para confirmar a estrutura de `role_capabilities` e como capabilities são concedidas (ver Fase 1; seed role→capability). Confirmar nome exato da coluna de capability.
- [ ] **Step 2 — Migration.** Inserir a capability `results.view` e conceder aos roles `admin`, `content_editor`, `analyst` na `role_capabilities` (seguir exatamente o padrão das capabilities existentes — ex.: `intel.view`). SQL aditivo, idempotente (`on conflict do nothing`).
- [ ] **Step 3 — Registrar.** Acrescentar entrada em `supabase/migrations-log.md` (data, nome, o que faz, status "aplicada em prod").
- [ ] **Step 4 — Smoke.** `execute_sql`: confirmar que admin/content_editor/analyst têm `results.view` e support não.
- [ ] **Step 5 — Commit.**
```bash
git add supabase/migrations-log.md
git commit -m "feat(admin-db): capability results.view (admin/content_editor/analyst)"
```

### Task F2: RPC `admin_simulado_results_roster`

**Files:**
- DB (migration via MCP `apply_migration`, name `fase4_results_roster_rpc`)
- Modify: `supabase/migrations-log.md`

- [ ] **Step 1 — Contrato.** Função `public.admin_simulado_results_roster(p_simulado_id uuid, p_sort text default 'score', p_dir text default 'desc', p_scope text default 'valid', p_search text default '', p_segment text default 'all', p_institution text default 'all', p_limit int default 50, p_offset int default 0)` `returns table(rank bigint, total_rows bigint, user_id uuid, attempt_id uuid, name text, email text, segment text, institution text, specialty text, score numeric, correct_count int, total_count int, duration_seconds int, submitted_at timestamptz, is_within_window boolean)`. `SECURITY DEFINER`, `set search_path = public`, primeiro statement `perform admin_require('results.view');` (seguir assinatura real de `admin_require` confirmada na Task F1/Fase 1).
- [ ] **Step 2 — Corpo.** Joins: `attempts a` (status concluído — confirmar enum: provavelmente `submitted`/`finished`) `join profiles p on p.id=a.user_id` `left join onboarding_profiles o on o.user_id=a.user_id`. Campos: `name=p.full_name`, `email=p.email`, `segment=p.segment::text`, `institution=coalesce(o.target_institutions[1],'—')`, `specialty=coalesce(o.specialty,'—')`, `score=a.score_percentage`, `correct_count=a.total_correct`, `total_count=a.total_answered`, `duration_seconds=extract(epoch from (a.finished_at - a.started_at))::int`, `submitted_at=a.finished_at`, `is_within_window=a.is_within_window`. Filtros: `p_scope` (`valid`→`is_within_window`, `training`→`not is_within_window`, `all`→ambos); `p_search` (ilike em full_name/email); `p_segment`/`p_institution` quando ≠ 'all'. `total_rows` = `count(*) over()`. `rank` = `row_number() over(order by <p_sort/p_dir>)`. Ordenação dinâmica via `order by` construído com `case` sobre `p_sort` (`score`, `name`, `duration_seconds`, `submitted_at`, `correct_count`, `segment`, `institution`, `specialty`) e `p_dir`. Paginação `limit p_limit offset p_offset`. **Whitelistar** `p_sort`/`p_dir` (evitar SQL injection: usar `case`, não string concatenada). Seguir o estilo de `admin_list_attempts` (já filtra por simulado e devolve nome/email/score/posição).
- [ ] **Step 3 — Logging (opcional).** Esta RPC é read-only → não precisa `admin_log_action`.
- [ ] **Step 4 — Smoke.** `execute_sql` chamando a RPC com um `simulado_id` real: validar contagem, ordenação por `score desc`, e que `total_rows` é constante entre páginas. Confirmar 0 linhas para anon (sem capability).
- [ ] **Step 5 — Registrar + commit.**
```bash
git add supabase/migrations-log.md
git commit -m "feat(admin-db): RPC admin_simulado_results_roster (server-side sort/filter/page)"
```

### Task F3: Regenerar types + adminApi roster

**Files:**
- Modify: `src/integrations/supabase/types.ts` (regenerar via MCP `generate_typescript_types`)
- Modify: `src/admin/services/adminApi.ts`
- Modify: módulo de tipos do admin (onde ficam `SimuladoDetailStats` etc.)

- [ ] **Step 1 — Regenerar types.** `generate_typescript_types` e substituir `src/integrations/supabase/types.ts`. Conferir que a nova RPC aparece em `Functions`.
- [ ] **Step 2 — Tipo de linha.**
```ts
export interface SimuladoResultRow {
  rank: number; total_rows: number; user_id: string; attempt_id: string;
  name: string | null; email: string | null; segment: string;
  institution: string; specialty: string; score: number | null;
  correct_count: number; total_count: number; duration_seconds: number;
  submitted_at: string; is_within_window: boolean;
}
export interface ResultsRosterParams {
  simuladoId: string; sort?: string; dir?: 'asc' | 'desc'; scope?: 'valid' | 'training' | 'all';
  search?: string; segment?: string; institution?: string; limit?: number; offset?: number;
}
```
- [ ] **Step 3 — Método.**
```ts
async getSimuladoResultsRoster(params: ResultsRosterParams): Promise<SimuladoResultRow[]> {
  const { data, error } = await supabase.rpc('admin_simulado_results_roster', {
    p_simulado_id: params.simuladoId,
    p_sort: params.sort ?? 'score',
    p_dir: params.dir ?? 'desc',
    p_scope: params.scope ?? 'valid',
    p_search: params.search ?? '',
    p_segment: params.segment ?? 'all',
    p_institution: params.institution ?? 'all',
    p_limit: params.limit ?? 50,
    p_offset: params.offset ?? 0,
  });
  if (error) throw error;
  return (data as any[]).map((r) => ({
    rank: Number(r.rank), total_rows: Number(r.total_rows), user_id: r.user_id, attempt_id: r.attempt_id,
    name: r.name, email: r.email, segment: r.segment, institution: r.institution, specialty: r.specialty,
    score: r.score != null ? Number(r.score) : null,
    correct_count: Number(r.correct_count), total_count: Number(r.total_count),
    duration_seconds: Number(r.duration_seconds), submitted_at: r.submitted_at, is_within_window: r.is_within_window,
  }));
}
```
- [ ] **Step 4 — Verificar.** `npx tsc --noEmit`.
- [ ] **Step 5 — Commit.**
```bash
git add src/integrations/supabase/types.ts src/admin/services/adminApi.ts
git commit -m "feat(admin): types + adminApi.getSimuladoResultsRoster"
```

### Task F4: Hook de dados do roster (React Query)

**Files:**
- Create: `src/admin/hooks/useSimuladoResultsRoster.ts`

- [ ] **Step 1 — Hook.** `useSimuladoResultsRoster(params)` com `useQuery` (key incluindo todos os params), `keepPreviousData: true` (paginação suave), `staleTime` padrão do projeto. Retorna `rows`, `totalRows` (de `rows[0]?.total_rows ?? 0`), `isLoading`. Seguir o padrão dos hooks admin existentes (ex.: `useAdminSimuladosAnalytics`).
- [ ] **Step 2 — Verificar.** `npx tsc --noEmit`.
- [ ] **Step 3 — Commit.**
```bash
git add src/admin/hooks/useSimuladoResultsRoster.ts
git commit -m "feat(admin): hook useSimuladoResultsRoster"
```

### Task F5: Página `AdminSimuladoResultados` (macro + roster) e rotas

**Files:**
- Create: `src/admin/pages/AdminSimuladoResultados.tsx`
- Modify: `src/App.tsx` (rotas admin)
- Modify: `src/admin/pages/AdminSimulados.tsx` (botão "Resultados" na linha)

- [ ] **Step 1 — Página.** Gate `AdminCapabilityGate capability="results.view"`. Layout:
  - **Macro (topo):** reusar `admin_simulado_detail_stats` (KPIs via `AdminStatCard`), distribuição de notas (`admin_score_distribution` + `AdminTrendChart` bar), acerto por área (`admin_performance_by_area` + `AdminBarList`), por segmento (`admin_segment_breakdown` ou agregação do roster), top instituições (agregação). **Análise por questão:** reusar `admin_simulado_question_stats` (migrar a tabela hoje em `AdminSimuladoAnalytics`).
  - **Roster (abaixo):** `AdminDataTable` com `sortable` nas colunas #, Nome, Segmento, Instituição, Especialidade, Nota, Acertos, Tempo, Concluído; controlar `sort`/`dir` em estado e passar pro hook. Busca (input debounced), filtros (scope toggle válido/treino/todos, segmento, instituição), paginação (offset/limit + `totalRows`). Coluna E-mail. Clique na linha → drill-down (Task F6).
  - **Export XLSX:** botão que busca todas as páginas (loop em offset até `totalRows`, respeitando o teto) e gera XLSX (reusar util de export existente; localizar o usado pelo botão "Export XLSX" de `AdminSimulados`).
- [ ] **Step 2 — Rotas.** Em `src/App.tsx`, adicionar `<Route path="simulados/:id/resultados" element={<AdminSimuladoResultados />} />`. Manter `simulados/:id/analytics` apontando para a nova página (redirect) ou trocar o link. Lazy-import no padrão das outras páginas admin.
- [ ] **Step 3 — Link na listagem.** Em `AdminSimulados.tsx`, trocar/duplicar a ação "Analytics" por "Resultados" → `/admin/simulados/:id/resultados`.
- [ ] **Step 4 — Verificar.** `npx tsc --noEmit`, `npm run lint`.
- [ ] **Step 5 — Commit.**
```bash
git add src/admin/pages/AdminSimuladoResultados.tsx src/App.tsx src/admin/pages/AdminSimulados.tsx
git commit -m "feat(admin): página de resultados (macro + roster ordenável + export)"
```

### Task F6: Drill-down individual

**Files:**
- Modify: `src/admin/pages/AdminSimuladoResultados.tsx`
- (reusar) `src/components/desempenho/DesempenhoSimuladoPanel` ou a página `AdminDesempenhoPreviewPage`

- [ ] **Step 1 — Abrir individual.** Clique na linha do roster → navegar para o desempenho daquele aluno naquele simulado (`/admin/preview/simulados/:id/desempenho?user=<user_id>`) **ou** abrir um Dialog embutindo `DesempenhoSimuladoPanel` com o `attempt_id`/`user_id` da linha. Escolher a opção que reusa o componente existente sem refatorá-lo demais (inspecionar as props de `DesempenhoSimuladoPanel`/`AdminDesempenhoPreviewPage` antes de decidir). Mostrar: desempenho por área, acerto por questão do aluno, tempo, comparação com a média (a média vem dos stats macro já carregados).
- [ ] **Step 2 — Verificar.** `npx tsc --noEmit`.
- [ ] **Step 3 — Commit.**
```bash
git add src/admin/pages/AdminSimuladoResultados.tsx
git commit -m "feat(admin): drill-down individual a partir do roster"
```

---

## Verificação final (após todas as tasks)

- [ ] `npm run test` — toda a suíte verde (inclui os novos testes de extrator, fuso, validação, slug, verifyFindings, DataTable).
- [ ] `npm run lint` — 0 erros.
- [ ] `npx tsc --noEmit` — sem erros de tipo.
- [ ] `npm run build` — build de produção OK.
- [ ] Smoke no banco vivo: capability `results.view` por role; RPC roster ordena/pagina/filtra; 0 exec por anon.
- [ ] Walkthrough manual (preview autenticado): upload com imagem 2 entrando nos 3 slots; verificador de IA sinalizando imagem faltando; datas exibindo horário de Brasília + resumo; cadastro em seções; tela de resultados com colunas ordenáveis + export + drill-down.
- [ ] Atualizar a memória `admin-central-programa` com o status da Fase 4.
- [ ] `superpowers:finishing-a-development-branch` para decidir merge/PR.

## Notas de fronteira (fora de escopo — não implementar)

Comunicação com usuários (e-mail/Novu); recálculo de notas; cron do verificador; novos campos de domínio do simulado (capa/instruções/corte/segmentação); checks de IA além de "imagem faltando".
