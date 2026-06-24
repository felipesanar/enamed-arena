# Verificação de questões expandida — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ampliar a verificação no upload de simulado com checagens estruturais locais (automáticas) e verificação por IA multimodal (que enxerga as imagens) nas três colunas de imagem.

**Architecture:** Duas camadas que emitem o mesmo `QuestionVerifyFinding` e caem no mesmo painel. Camada A é um módulo puro local (sem IA) que roda ao carregar o arquivo. Camada B é a edge function `admin-verify-questions` reescrita para receber os bytes das imagens e fazer chamadas Gemini multimodais, com batching e concorrência feitos no front.

**Tech Stack:** Vite + React 18 + TypeScript, Vitest, Supabase Edge Functions (Deno), Gemini 2.5 Flash.

## Global Constraints

- TypeScript relaxado: `noImplicitAny: false`, `strictNullChecks: false`. Não introduzir `strict`.
- Imports sempre via alias `@/` (nunca paths relativos longos dentro de `src`).
- Logging: `import { logger } from "@/lib/logger"` — nunca `console.log` no código de `src`.
- Toasts: `import { toast } from "@/hooks/use-toast"` (o `sonner` não está montado).
- Testes: Vitest. Rodar arquivo único com `npx vitest run <caminho>`.
- Modelo de IA: `gemini-2.5-flash` (suporta visão). Endpoint `generativelanguage.googleapis.com/v1beta`.
- `GEMINI_API_KEY` deve ser chave Google (`AIza…`), nunca access token (`AQ.`/`ya29.`).
- Trabalho de admin ocorre em **worktree** dedicada (não no working dir compartilhado).
- O painel agrupa achados por `question_number`; todo finding precisa ter um `question_number`.

---

### Task 1: Modelo de achado expandido + Camada A (validação estrutural)

**Files:**
- Modify: `src/admin/services/adminApi.ts` (interface `QuestionVerifyFinding`, ~52-58)
- Create: `src/admin/lib/validateQuestions.ts`
- Test: `src/admin/lib/validateQuestions.test.ts`

**Interfaces:**
- Consumes: nada (primeira task).
- Produces:
  - `QuestionVerifyFinding` (em `adminApi.ts`):
    ```ts
    export type FindingSource = 'structural' | 'ai';
    export type FindingSlot = 'enunciado' | 'enunciado2' | 'comentario';
    export type FindingCheckType =
      | 'missing_image' | 'orphan_image' | 'image_mismatch' | 'illegible_image'
      | 'invalid_gabarito' | 'empty_enunciado' | 'empty_option'
      | 'duplicate_options' | 'duplicate_question' | 'bad_numbering';
    export interface QuestionVerifyFinding {
      question_number: number;
      source: FindingSource;
      check_type: FindingCheckType;
      slot?: FindingSlot;
      severity: 'error' | 'warning';
      evidence: string;
    }
    ```
  - `validateQuestions(rows: QuestionRow[]): QuestionVerifyFinding[]` e
    ```ts
    export interface QuestionRow {
      numero: number;        // já convertido com Number(); pode ser NaN
      enunciado: string;
      alternativaA: string;
      alternativaB: string;
      alternativaC: string;
      alternativaD: string;
      gabarito: string;      // cru (pode vir minúsculo/vazio)
    }
    ```

- [ ] **Step 1: Expandir o tipo em `adminApi.ts`**

Substituir a interface atual (linhas ~52-58):

```ts
export type FindingSource = 'structural' | 'ai';
export type FindingSlot = 'enunciado' | 'enunciado2' | 'comentario';
export type FindingCheckType =
  | 'missing_image' | 'orphan_image' | 'image_mismatch' | 'illegible_image'
  | 'invalid_gabarito' | 'empty_enunciado' | 'empty_option'
  | 'duplicate_options' | 'duplicate_question' | 'bad_numbering';

export interface QuestionVerifyFinding {
  question_number: number;
  source: FindingSource;
  check_type: FindingCheckType;
  slot?: FindingSlot;
  severity: 'error' | 'warning';
  evidence: string;
}
```

- [ ] **Step 2: Escrever o teste falhando** em `src/admin/lib/validateQuestions.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { validateQuestions, type QuestionRow } from './validateQuestions';

const base: QuestionRow = {
  numero: 1, enunciado: 'Qual a conduta?',
  alternativaA: 'a', alternativaB: 'b', alternativaC: 'c', alternativaD: 'd',
  gabarito: 'B',
};

describe('validateQuestions', () => {
  it('questão válida não gera achados', () => {
    expect(validateQuestions([base])).toEqual([]);
  });

  it('enunciado vazio → erro empty_enunciado', () => {
    const out = validateQuestions([{ ...base, enunciado: '   ' }]);
    expect(out).toContainEqual(expect.objectContaining({
      question_number: 1, source: 'structural', check_type: 'empty_enunciado', severity: 'error',
    }));
  });

  it('alternativa vazia → erro empty_option listando a letra', () => {
    const out = validateQuestions([{ ...base, alternativaC: '' }]);
    const f = out.find((x) => x.check_type === 'empty_option');
    expect(f?.severity).toBe('error');
    expect(f?.evidence).toContain('C');
  });

  it('gabarito fora de A-D → erro invalid_gabarito', () => {
    expect(validateQuestions([{ ...base, gabarito: 'E' }]))
      .toContainEqual(expect.objectContaining({ check_type: 'invalid_gabarito', severity: 'error' }));
  });

  it('gabarito minúsculo é aceito (normalizado)', () => {
    expect(validateQuestions([{ ...base, gabarito: 'b' }])
      .some((x) => x.check_type === 'invalid_gabarito')).toBe(false);
  });

  it('numero NaN → erro bad_numbering', () => {
    expect(validateQuestions([{ ...base, numero: NaN }]))
      .toContainEqual(expect.objectContaining({ check_type: 'bad_numbering', severity: 'error' }));
  });

  it('numero repetido → aviso bad_numbering', () => {
    const out = validateQuestions([base, { ...base, numero: 1, enunciado: 'Outra?' }]);
    expect(out).toContainEqual(expect.objectContaining({
      check_type: 'bad_numbering', severity: 'warning', question_number: 1,
    }));
  });

  it('duas alternativas idênticas → aviso duplicate_options', () => {
    const out = validateQuestions([{ ...base, alternativaA: 'igual', alternativaB: 'igual' }]);
    const f = out.find((x) => x.check_type === 'duplicate_options');
    expect(f?.severity).toBe('warning');
    expect(f?.evidence).toMatch(/A|B/);
  });

  it('enunciados idênticos em questões diferentes → aviso duplicate_question nos dois', () => {
    const out = validateQuestions([
      { ...base, numero: 1, enunciado: 'Mesmo texto' },
      { ...base, numero: 2, enunciado: 'mesmo  TEXTO' },
    ]);
    const dups = out.filter((x) => x.check_type === 'duplicate_question');
    expect(dups.map((d) => d.question_number).sort()).toEqual([1, 2]);
  });
});
```

- [ ] **Step 3: Rodar o teste e ver falhar**

Run: `npx vitest run src/admin/lib/validateQuestions.test.ts`
Expected: FAIL (módulo `./validateQuestions` não existe).

- [ ] **Step 4: Implementar `src/admin/lib/validateQuestions.ts`**

```ts
import type { QuestionVerifyFinding } from '@/admin/services/adminApi';

export interface QuestionRow {
  numero: number;
  enunciado: string;
  alternativaA: string;
  alternativaB: string;
  alternativaC: string;
  alternativaD: string;
  gabarito: string;
}

const norm = (s: string): string =>
  (s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

export function validateQuestions(rows: QuestionRow[]): QuestionVerifyFinding[] {
  const findings: QuestionVerifyFinding[] = [];
  const numeroCount = new Map<number, number>();
  const enunciadoMap = new Map<string, number[]>();

  for (const row of rows) {
    const qn = Number.isFinite(row.numero) ? row.numero : 0;

    if (!Number.isFinite(row.numero)) {
      findings.push({
        question_number: 0, source: 'structural', check_type: 'bad_numbering',
        severity: 'error', evidence: 'Questão sem número válido na coluna "numero".',
      });
    } else {
      numeroCount.set(row.numero, (numeroCount.get(row.numero) ?? 0) + 1);
    }

    if (norm(row.enunciado) === '') {
      findings.push({
        question_number: qn, source: 'structural', check_type: 'empty_enunciado',
        severity: 'error', evidence: 'Enunciado vazio.',
      });
    } else {
      const key = norm(row.enunciado);
      const arr = enunciadoMap.get(key) ?? [];
      arr.push(qn);
      enunciadoMap.set(key, arr);
    }

    const opts: Array<[string, string]> = [
      ['A', row.alternativaA], ['B', row.alternativaB],
      ['C', row.alternativaC], ['D', row.alternativaD],
    ];
    const emptyLetters = opts.filter(([, t]) => norm(t) === '').map(([l]) => l);
    if (emptyLetters.length > 0) {
      findings.push({
        question_number: qn, source: 'structural', check_type: 'empty_option',
        severity: 'error', evidence: `Alternativa(s) vazia(s): ${emptyLetters.join(', ')}.`,
      });
    }

    const gab = (row.gabarito ?? '').trim().toUpperCase();
    if (!['A', 'B', 'C', 'D'].includes(gab)) {
      findings.push({
        question_number: qn, source: 'structural', check_type: 'invalid_gabarito',
        severity: 'error', evidence: `Gabarito inválido: "${row.gabarito ?? ''}". Use A, B, C ou D.`,
      });
    }

    const byText = new Map<string, string[]>();
    for (const [letter, text] of opts) {
      const t = norm(text);
      if (t === '') continue;
      const arr = byText.get(t) ?? [];
      arr.push(letter);
      byText.set(t, arr);
    }
    const dupLetters = [...byText.values()].filter((ls) => ls.length > 1).flat();
    if (dupLetters.length > 0) {
      findings.push({
        question_number: qn, source: 'structural', check_type: 'duplicate_options',
        severity: 'warning', evidence: `Alternativas idênticas: ${dupLetters.join(', ')}.`,
      });
    }
  }

  for (const [num, count] of numeroCount) {
    if (count > 1) {
      findings.push({
        question_number: num, source: 'structural', check_type: 'bad_numbering',
        severity: 'warning', evidence: `Número de questão repetido ${count}× (numero=${num}).`,
      });
    }
  }

  for (const nums of enunciadoMap.values()) {
    if (nums.length > 1) {
      for (const n of nums) {
        const others = nums.filter((x) => x !== n);
        findings.push({
          question_number: n, source: 'structural', check_type: 'duplicate_question',
          severity: 'warning', evidence: `Enunciado idêntico ao da(s) questão(ões): ${others.join(', ')}.`,
        });
      }
    }
  }

  return findings;
}
```

- [ ] **Step 5: Rodar o teste e ver passar**

Run: `npx vitest run src/admin/lib/validateQuestions.test.ts`
Expected: PASS (todos os casos).

- [ ] **Step 6: Atualizar o teste existente de summarize para o tipo novo**

Em `src/admin/lib/verifyFindings.test.ts`, adicionar `source: 'ai'` nos dois objetos (senão fica inconsistente com o tipo). Substituir as duas construções por:

```ts
    { question_number: 5, source: 'ai', check_type: 'missing_image', slot: 'enunciado', severity: 'warning', evidence: 'x' },
    { question_number: 2, source: 'ai', check_type: 'missing_image', slot: 'enunciado', severity: 'error', evidence: 'y' },
```

Run: `npx vitest run src/admin/lib/verifyFindings.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/admin/services/adminApi.ts src/admin/lib/validateQuestions.ts src/admin/lib/validateQuestions.test.ts src/admin/lib/verifyFindings.test.ts
git commit -m "feat(admin): camada estrutural de validação de questões + modelo de achado expandido"
```

---

### Task 2: Rótulos por check_type no painel

**Files:**
- Modify: `src/admin/lib/verifyFindings.ts`
- Test: `src/admin/lib/verifyFindings.test.ts`
- Modify: `src/admin/components/VerifyFindingsPanel.tsx`

**Interfaces:**
- Consumes: `QuestionVerifyFinding` (Task 1).
- Produces: `findingLabel(finding: QuestionVerifyFinding): string` em `verifyFindings.ts`.

- [ ] **Step 1: Escrever o teste falhando** (adicionar ao final de `verifyFindings.test.ts`)

```ts
import { findingLabel } from './verifyFindings';

describe('findingLabel', () => {
  it('missing_image usa o slot', () => {
    expect(findingLabel({ question_number: 1, source: 'ai', check_type: 'missing_image', slot: 'enunciado2', severity: 'error', evidence: '' }))
      .toBe('imagem 2 ausente');
  });
  it('image_mismatch', () => {
    expect(findingLabel({ question_number: 1, source: 'ai', check_type: 'image_mismatch', slot: 'enunciado', severity: 'error', evidence: '' }))
      .toBe('imagem do enunciado não corresponde ao texto');
  });
  it('invalid_gabarito', () => {
    expect(findingLabel({ question_number: 1, source: 'structural', check_type: 'invalid_gabarito', severity: 'error', evidence: '' }))
      .toBe('gabarito inválido');
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/admin/lib/verifyFindings.test.ts`
Expected: FAIL (`findingLabel` não existe).

- [ ] **Step 3: Implementar `findingLabel` em `verifyFindings.ts`**

```ts
import type { QuestionVerifyFinding, FindingSlot } from '../services/adminApi';

const SLOT_LABEL: Record<FindingSlot, string> = {
  enunciado: 'imagem do enunciado',
  enunciado2: 'imagem 2',
  comentario: 'imagem do comentário',
};

export function findingLabel(f: QuestionVerifyFinding): string {
  const slot = f.slot ? SLOT_LABEL[f.slot] : 'imagem';
  switch (f.check_type) {
    case 'missing_image': return `${slot} ausente`;
    case 'orphan_image': return `${slot} sem referência no texto`;
    case 'image_mismatch': return `${slot} não corresponde ao texto`;
    case 'illegible_image': return `${slot} ilegível`;
    case 'invalid_gabarito': return 'gabarito inválido';
    case 'empty_enunciado': return 'enunciado vazio';
    case 'empty_option': return 'alternativa vazia';
    case 'duplicate_options': return 'alternativas idênticas';
    case 'duplicate_question': return 'questão duplicada';
    case 'bad_numbering': return 'numeração inválida';
    default: return 'problema detectado';
  }
}
```

(Manter `summarizeFindings` como está.)

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/admin/lib/verifyFindings.test.ts`
Expected: PASS.

- [ ] **Step 5: Atualizar `VerifyFindingsPanel.tsx` para usar `findingLabel` + tag de origem**

Remover o `SLOT_LABEL` local (linhas 12-16) e o import passa a incluir `findingLabel`:

```tsx
import { summarizeFindings, findingLabel } from '@/admin/lib/verifyFindings'
```

Substituir o bloco do título da questão (linhas ~72-81) por:

```tsx
                  <p className="text-sm font-semibold text-admin-text flex items-center gap-1.5">
                    <span className="text-admin-muted">{finding.source === 'ai' ? '🤖' : '⚙️'}</span>
                    Q{finding.question_number} —{' '}
                    <span className={cn(
                      finding.severity === 'error' ? 'text-admin-destructive' : 'text-admin-warning',
                    )}>
                      {findingLabel(finding)}
                    </span>
                  </p>
```

Trocar também o texto de "tudo certo" (linha ~49) e o título do card (linha ~34) para refletir que cobre estrutural + IA:

- Linha ~34: `Verificação de questões`
- Linha ~49: `Nenhum problema detectado ✓`

- [ ] **Step 6: Verificar build de tipos**

Run: `npx vitest run src/admin/lib/verifyFindings.test.ts`
Expected: PASS (e o painel compila — sem `SLOT_LABEL` órfão).

- [ ] **Step 7: Commit**

```bash
git add src/admin/lib/verifyFindings.ts src/admin/lib/verifyFindings.test.ts src/admin/components/VerifyFindingsPanel.tsx
git commit -m "feat(admin): painel de verificação com rótulo por tipo e tag de origem"
```

---

### Task 3: Rodar a Camada A automaticamente no carregamento do arquivo

**Files:**
- Modify: `src/admin/pages/AdminUploadQuestions.tsx`

**Interfaces:**
- Consumes: `validateQuestions`, `QuestionRow` (Task 1); `summarizeFindings` (já existe).
- Produces: estado `structuralFindings` mesclado com `findings` (IA) na exibição.

- [ ] **Step 1: Importar e criar estado**

No topo, adicionar import:

```tsx
import { validateQuestions } from '@/admin/lib/validateQuestions';
```

Junto aos outros `useState` (perto da linha 179), adicionar:

```tsx
  const [structuralFindings, setStructuralFindings] = useState<QuestionVerifyFinding[]>([]);
```

(`QuestionVerifyFinding` já é importável de `../services/adminApi`; ajustar o import existente de `adminApi` para incluí-lo se necessário.)

- [ ] **Step 2: Rodar a validação dentro do `handleFile`**

Logo após `setParsedRows(rows);` (linha ~200), adicionar:

```tsx
    setStructuralFindings(validateQuestions(rows.map((r) => ({
      numero: Number(r.numero),
      enunciado: r.Enunciado || '',
      alternativaA: r['Alternativa A'] || '',
      alternativaB: r['Alternativa B'] || '',
      alternativaC: r['Alternativa C'] || '',
      alternativaD: r['Alternativa D'] || '',
      gabarito: r.Gabarito || '',
    }))));
```

E no início do `handleFile` (onde já faz `setFindings([])` e `setVerifyRan(false)`, ~193-194), adicionar:

```tsx
    setStructuralFindings([]);
```

- [ ] **Step 3: Mesclar estruturais + IA na renderização do painel**

Localizar a renderização do `VerifyFindingsPanel` (linhas ~515-517). Trocar a condição e as props para sempre mostrar quando houver linhas, mesclando as duas origens:

```tsx
        {parsedRows.length > 0 && (
          <VerifyFindingsPanel
            findings={[...structuralFindings, ...findings]}
            loading={verifying}
          />
        )}
```

- [ ] **Step 4: Verificar na preview do app**

Run: `npm run dev` (porta 8080). Acessar `/admin/simulados/{id}/questoes`, carregar uma planilha com um gabarito "E" e uma alternativa vazia.
Expected: o painel mostra na hora (sem clicar em "Verificar com IA") os achados estruturais com a tag ⚙️.

- [ ] **Step 5: Commit**

```bash
git add src/admin/pages/AdminUploadQuestions.tsx
git commit -m "feat(admin): checagens estruturais automáticas ao carregar a planilha"
```

---

### Task 4: Helper de downscale de imagem (cliente)

**Files:**
- Create: `src/admin/utils/downscaleImage.ts`
- Test: `src/admin/utils/downscaleImage.test.ts`

**Interfaces:**
- Produces:
  - `targetDimensions(w: number, h: number, max: number): { w: number; h: number }` (puro).
  - `downscaleImage(base64: string, mime: string, max?: number): Promise<{ base64: string; mime: string }>` — usa canvas; em ambiente sem canvas retorna a entrada inalterada.

- [ ] **Step 1: Escrever o teste falhando** (só da parte pura)

```ts
import { describe, it, expect } from 'vitest';
import { targetDimensions } from './downscaleImage';

describe('targetDimensions', () => {
  it('não amplia imagens menores que o máximo', () => {
    expect(targetDimensions(800, 600, 1024)).toEqual({ w: 800, h: 600 });
  });
  it('reduz mantendo proporção pela maior dimensão', () => {
    expect(targetDimensions(2048, 1024, 1024)).toEqual({ w: 1024, h: 512 });
  });
  it('reduz quando a altura é a maior', () => {
    expect(targetDimensions(1000, 2000, 1000)).toEqual({ w: 500, h: 1000 });
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/admin/utils/downscaleImage.test.ts`
Expected: FAIL (módulo inexistente).

- [ ] **Step 3: Implementar `downscaleImage.ts`**

```ts
import { logger } from '@/lib/logger';

export function targetDimensions(w: number, h: number, max: number): { w: number; h: number } {
  const longest = Math.max(w, h);
  if (longest <= max) return { w, h };
  const scale = max / longest;
  return { w: Math.round(w * scale), h: Math.round(h * scale) };
}

/**
 * Reduz a imagem para no máximo `max`px na maior dimensão e recodifica como JPEG.
 * Em ambiente sem canvas (ex.: testes) ou em erro, devolve a entrada original.
 */
export async function downscaleImage(
  base64: string,
  mime: string,
  max = 1024,
): Promise<{ base64: string; mime: string }> {
  try {
    if (typeof document === 'undefined' || typeof Image === 'undefined') {
      return { base64, mime };
    }
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = reject;
      el.src = `data:${mime};base64,${base64}`;
    });
    const { w, h } = targetDimensions(img.naturalWidth, img.naturalHeight, max);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return { base64, mime };
    ctx.drawImage(img, 0, 0, w, h);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
    return { base64: dataUrl.split(',')[1] ?? base64, mime: 'image/jpeg' };
  } catch (e) {
    logger.error('[downscaleImage] falha, usando original:', e);
    return { base64, mime };
  }
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/admin/utils/downscaleImage.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/admin/utils/downscaleImage.ts src/admin/utils/downscaleImage.test.ts
git commit -m "feat(admin): helper de downscale de imagem para a verificação multimodal"
```

---

### Task 5: Edge function multimodal (`admin-verify-questions`)

**Files:**
- Create: `supabase/functions/admin-verify-questions/verifyHelpers.ts`
- Modify: `supabase/functions/admin-verify-questions/index.ts`
- Test: `src/admin/__tests__/verifyHelpers.test.ts`

**Interfaces:**
- Consumes: `QuestionVerifyFinding` shape (Task 1) — replicado no Deno (sem import de `src`).
- Produces (em `verifyHelpers.ts`):
  - `buildContents(questions: QInput[]): unknown[]` — partes Gemini (texto + `inline_data`).
  - `parseFindings(rawJson: string): Finding[]` — valida `check_type`, força `source: 'ai'`, descarta desconhecidos.
  - tipos `QInput` e `Finding`, e `RESPONSE_SCHEMA`, `SYSTEM_PROMPT`.
    ```ts
    export interface QImage { slot: 'enunciado' | 'enunciado2' | 'comentario'; mime: string; base64: string; }
    export interface QInput { question_number: number; enunciado_text: string; comentario_text?: string; images: QImage[]; }
    ```

- [ ] **Step 1: Escrever o teste falhando** em `src/admin/__tests__/verifyHelpers.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { parseFindings, buildContents } from '../../../supabase/functions/admin-verify-questions/verifyHelpers';

describe('parseFindings', () => {
  it('força source=ai e mantém checks válidos', () => {
    const raw = JSON.stringify({ findings: [
      { question_number: 3, check_type: 'image_mismatch', slot: 'enunciado', severity: 'error', evidence: 'RX x ECG' },
    ]});
    const out = parseFindings(raw);
    expect(out).toHaveLength(1);
    expect(out[0].source).toBe('ai');
    expect(out[0].check_type).toBe('image_mismatch');
  });
  it('descarta check_type desconhecido', () => {
    const raw = JSON.stringify({ findings: [
      { question_number: 1, check_type: 'banana', severity: 'error', evidence: 'x' },
    ]});
    expect(parseFindings(raw)).toEqual([]);
  });
  it('json inválido → array vazio', () => {
    expect(parseFindings('not json')).toEqual([]);
  });
});

describe('buildContents', () => {
  it('inclui inline_data para cada imagem', () => {
    const parts = buildContents([
      { question_number: 1, enunciado_text: 'Veja a figura', comentario_text: '', images: [
        { slot: 'enunciado', mime: 'image/jpeg', base64: 'AAAA' },
      ]},
    ]);
    const flat = JSON.stringify(parts);
    expect(flat).toContain('inline_data');
    expect(flat).toContain('AAAA');
    expect(flat).toContain('Q1');
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/admin/__tests__/verifyHelpers.test.ts`
Expected: FAIL (módulo inexistente).

- [ ] **Step 3: Criar `supabase/functions/admin-verify-questions/verifyHelpers.ts`** (puro, sem `Deno`)

```ts
export interface QImage { slot: 'enunciado' | 'enunciado2' | 'comentario'; mime: string; base64: string; }
export interface QInput {
  question_number: number;
  enunciado_text: string;
  comentario_text?: string;
  images: QImage[];
}
export interface Finding {
  question_number: number;
  source: 'ai';
  check_type: string;
  slot?: string;
  severity: 'error' | 'warning';
  evidence: string;
}

const ALLOWED_CHECKS = new Set([
  'missing_image', 'orphan_image', 'image_mismatch', 'illegible_image',
]);

export const SYSTEM_PROMPT = `Você é um revisor de banco de questões médicas. Para cada questão recebo o texto e, quando existirem, as IMAGENS anexadas (slot "enunciado" = imagem principal, "enunciado2" = segunda imagem, "comentario" = imagem da explicação).

Detecte e reporte, por questão e por slot:
- missing_image: o TEXTO cita uma figura (ex.: "observe a radiografia", "o ECG mostra", "figuras A e B", "fundoscopia") mas NENHUMA imagem foi anexada naquele slot.
- orphan_image: existe imagem anexada num slot, mas o texto NÃO faz qualquer referência a figura.
- image_mismatch: a imagem existe e é citada, mas o conteúdo dela claramente NÃO corresponde ao texto (ex.: texto diz "radiografia de tórax" e a imagem é um eletrocardiograma).
- illegible_image: a imagem está ilegível, em branco, cortada ou corrompida.

Regras:
- severity "error" quando inequívoco; "warning" quando possível mas ambíguo.
- "evidence" = trecho curto do texto e/ou o que você viu na imagem.
- Reporte apenas problemas. Se estiver tudo certo, não gere achado para a questão.
- Retorne SOMENTE JSON no schema pedido.`;

export const RESPONSE_SCHEMA = {
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
        required: ['question_number', 'check_type', 'severity', 'evidence'],
      },
    },
  },
  required: ['findings'],
};

export function buildContents(questions: QInput[]): unknown[] {
  const parts: unknown[] = [{ text: SYSTEM_PROMPT }];
  for (const q of questions) {
    const slots = q.images.map((i) => i.slot).join(', ') || 'nenhuma';
    parts.push({
      text: `\n--- Q${q.question_number} (imagens anexadas: ${slots})\nENUNCIADO: ${q.enunciado_text}\n` +
        (q.comentario_text ? `COMENTARIO: ${q.comentario_text}\n` : ''),
    });
    for (const img of q.images) {
      parts.push({ text: `[imagem do slot "${img.slot}" da Q${q.question_number}]` });
      parts.push({ inline_data: { mime_type: img.mime, data: img.base64 } });
    }
  }
  return parts;
}

export function parseFindings(rawJson: string): Finding[] {
  try {
    const parsed = JSON.parse(rawJson);
    const arr = Array.isArray(parsed?.findings) ? parsed.findings : [];
    return arr
      .filter((f: { check_type?: string }) => ALLOWED_CHECKS.has(f?.check_type ?? ''))
      .map((f: Record<string, unknown>) => ({
        question_number: Number(f.question_number) || 0,
        source: 'ai' as const,
        check_type: String(f.check_type),
        slot: f.slot ? String(f.slot) : undefined,
        severity: f.severity === 'warning' ? 'warning' : 'error',
        evidence: String(f.evidence ?? ''),
      }));
  } catch {
    return [];
  }
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/admin/__tests__/verifyHelpers.test.ts`
Expected: PASS.

- [ ] **Step 5: Reescrever `index.ts` para usar os helpers e multimodal**

```ts
import { buildContents, parseFindings, RESPONSE_SCHEMA, type QInput } from './verifyHelpers.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const apiKey = Deno.env.get('GEMINI_API_KEY');
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'GEMINI_API_KEY não configurada', findings: [] }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { questions } = (await req.json()) as { questions: QInput[] };
    if (!Array.isArray(questions) || questions.length === 0) {
      return new Response(JSON.stringify({ findings: [] }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: buildContents(questions) }],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 4000,
            thinkingConfig: { thinkingBudget: 0 },
            responseMimeType: 'application/json',
            responseSchema: RESPONSE_SCHEMA,
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
    const findings = parseFindings(rawJson);

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

(Nota: `console.error` é aceitável aqui — código Deno da edge function, fora de `src`.)

- [ ] **Step 6: Commit**

```bash
git add supabase/functions/admin-verify-questions/verifyHelpers.ts supabase/functions/admin-verify-questions/index.ts src/admin/__tests__/verifyHelpers.test.ts
git commit -m "feat(admin): edge function de verificação multimodal (imagem faltando/órfã/incompatível/ilegível)"
```

---

### Task 6: Front envia imagens em lotes com concorrência (`runVerify`)

**Files:**
- Modify: `src/admin/services/adminApi.ts` (`QuestionVerifyInput` + `verifyQuestions`)
- Create: `src/admin/lib/chunk.ts`
- Test: `src/admin/lib/chunk.test.ts`
- Modify: `src/admin/pages/AdminUploadQuestions.tsx` (`runVerify`)

**Interfaces:**
- Consumes: `downscaleImage` (Task 4); `verifyHelpers` shape (Task 5); `ExtractedImage` (já existe).
- Produces: `chunk<T>(arr: T[], size: number): T[][]`; `QuestionVerifyInput` com `images: VerifyImage[]`.

- [ ] **Step 1: Escrever teste do `chunk`** em `src/admin/lib/chunk.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { chunk } from './chunk';

describe('chunk', () => {
  it('divide em lotes do tamanho dado', () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });
  it('lista vazia → vazio', () => {
    expect(chunk([], 3)).toEqual([]);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/admin/lib/chunk.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementar `src/admin/lib/chunk.ts`**

```ts
export function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/admin/lib/chunk.test.ts`
Expected: PASS.

- [ ] **Step 5: Atualizar `QuestionVerifyInput` e `verifyQuestions` em `adminApi.ts`**

Substituir `QuestionVerifyInput` (linhas ~60-67) por:

```ts
export interface VerifyImage { slot: FindingSlot; mime: string; base64: string; }
export interface QuestionVerifyInput {
  question_number: number;
  enunciado_text: string;
  comentario_text?: string;
  images: VerifyImage[];
}
```

(`verifyQuestions` em ~739-743 já repassa `{ questions }` ao invoke — manter; só o tipo muda.)

- [ ] **Step 6: Reescrever `runVerify` em `AdminUploadQuestions.tsx`**

Adicionar imports:

```tsx
import { chunk } from '@/admin/lib/chunk';
import { downscaleImage } from '@/admin/utils/downscaleImage';
import type { QuestionVerifyInput } from '@/admin/services/adminApi';
```

Substituir o corpo de `runVerify` (linhas ~213-232) por:

```tsx
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
          setUploadProgress({ step: `Verificando com IA (lote ${done}/${batches.length})...`, percent: Math.round((done / batches.length) * 100) });
        }
      }
      await Promise.all(Array.from({ length: Math.min(concurrency, batches.length || 1) }, worker));

      setFindings(results);
      setVerifyRan(true);
    } catch (err: any) {
      toast({ title: 'Erro ao verificar', description: err.message, variant: 'destructive' });
    } finally {
      setVerifying(false);
      setTimeout(() => setUploadProgress(null), 1500);
    }
  };
```

- [ ] **Step 7: Verificar tipos + smoke test**

Run: `npx vitest run src/admin/lib/chunk.test.ts`
Expected: PASS.

Run: `npm run dev`. Carregar planilha com imagens, clicar em "Verificar com IA".
Expected: barra de progresso por lote; achados de IA (🤖) aparecem mesclados com os estruturais (⚙️). Conferir logs da function via Supabase se aparecer erro Gemini.

- [ ] **Step 8: Commit**

```bash
git add src/admin/services/adminApi.ts src/admin/lib/chunk.ts src/admin/lib/chunk.test.ts src/admin/pages/AdminUploadQuestions.tsx
git commit -m "feat(admin): verificação por IA envia imagens em lotes com concorrência e downscale"
```

---

### Task 7: Deploy da edge function + smoke real

**Files:** nenhum (operação de deploy).

**Interfaces:** consome a function da Task 5.

- [ ] **Step 1: Deploy da function**

Via MCP Supabase (`deploy_edge_function`) ou CLI:

```bash
supabase functions deploy admin-verify-questions
```

- [ ] **Step 2: Confirmar a secret**

Garantir que `GEMINI_API_KEY` é uma chave `AIza…` (não `AQ.`/`ya29.`). Conferir nos logs que não há `401 ACCESS_TOKEN_TYPE_UNSUPPORTED`.

- [ ] **Step 3: Smoke real**

No app em produção/preview, rodar "Verificar com IA" num simulado com: (a) questão que cita figura sem imagem, (b) questão com imagem mas sem citação no texto, (c) questão com imagem trocada.
Expected: respectivamente `missing_image`, `orphan_image`, `image_mismatch`.

- [ ] **Step 4: Checar logs**

Via MCP Supabase `get_logs` (service `edge-function`) — sem erros 5xx/parse.

---

### Task 8: Atualizar o tutorial no Notion

**Files:** nenhum (Notion).

- [ ] **Step 1: Buscar a seção atual**

A página é `389b3b75-c7e1-811b-b5bf-c55e6f41ca14` ("Como inserir um simulado…"). A seção "Etapa 4 — Verificar com IA" descreve só `missing_image`.

- [ ] **Step 2: Reescrever a seção de verificação**

Via `notion-update-page`, atualizar a Etapa 4 para descrever:
- Checagens **automáticas (estruturais)** que aparecem ao carregar a planilha: gabarito inválido, enunciado/alternativa vazios, número repetido, alternativas/questões duplicadas (tag ⚙️).
- **Verificação por IA (multimodal)** sob o botão, que agora **olha as imagens** das três colunas e detecta: imagem faltando, imagem órfã (sem referência no texto), imagem que não corresponde ao texto, e imagem ilegível (tag 🤖).
- Nota de que pode levar alguns minutos em simulados grandes (roda em lotes).

- [ ] **Step 3: Conferir**

Via `notion-fetch` na página, confirmar que a seção foi atualizada e os links/estrutura seguem íntegros.

---

## Self-Review

**Spec coverage:**
- Modelo unificado de achado → Task 1. ✓
- Camada A (6 checagens) → Task 1 (empty_enunciado, empty_option, invalid_gabarito, bad_numbering, duplicate_options, duplicate_question). ✓
- Disparo automático da Camada A → Task 3. ✓
- Camada B multimodal (4 tipos) → Tasks 5 (function) + 6 (front). ✓
- Cobre coluna 1/2/comentário → `buildContents` envia todos os slots presentes; prompt instrui por slot. ✓
- Downscale → Task 4 + uso em Task 6. ✓
- Batching + concorrência → Task 6 (`chunk` + worker concurrency=4). ✓
- Painel com rótulo por tipo + tag de origem → Task 2. ✓
- Helpers puros testáveis na function → Task 5 (`buildContents`/`parseFindings`). ✓
- Documentação Notion → Task 8. ✓
- Deploy/secret AIza → Task 7. ✓

**Placeholder scan:** sem TBD/TODO; todo passo de código tem código completo. ✓

**Type consistency:** `QuestionVerifyFinding` (Task 1) usado em verifyFindings (Task 2), validateQuestions (Task 1), página (Tasks 3/6). `VerifyImage`/`QuestionVerifyInput` (Task 6) espelham `QImage`/`QInput` da function (Task 5). `findingLabel`/`summarizeFindings` consistentes entre Task 2 e o painel. ✓

**Desvio anotado:** `bad_numbering` cobre `numero` ausente (erro) e repetido (aviso); detecção de "buraco na sequência" foi deixada de fora para evitar falsos positivos em re-uploads parciais.
