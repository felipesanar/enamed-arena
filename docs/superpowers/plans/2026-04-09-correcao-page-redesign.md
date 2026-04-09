# Correção Page Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesenhar `CorrecaoPage.tsx` com header sticky tipo prova (score sempre visível), sidebar sticky com flags de revisão, botão Caderno de Erros no header da questão, e comentário do professor com truncamento "Ver mais".

**Architecture:** Todas as mudanças ficam em um único arquivo (`src/pages/CorrecaoPage.tsx`). Nenhum componente novo é criado — a reestruturação é interna ao componente. O `adminPreview` continua funcionando via prop já existente.

**Tech Stack:** React 18, TypeScript, Tailwind CSS 3.4, Framer Motion 12, Vitest 3 + Testing Library

---

## Mapa de Arquivos

| Arquivo | Ação |
|---------|------|
| `src/pages/CorrecaoPage.tsx` | Modificar — todas as mudanças visuais e estruturais |
| `src/pages/CorrecaoPage.test.tsx` | Criar — testes para novos comportamentos |

---

## Task 1: Setup de testes + estado `expandedExplanations`

Este é o único comportamento novo com lógica de estado não-trivial. Começamos pelos testes.

**Files:**
- Create: `src/pages/CorrecaoPage.test.tsx`
- Modify: `src/pages/CorrecaoPage.tsx`

- [ ] **Step 1: Criar o arquivo de testes com mocks base**

Crie `src/pages/CorrecaoPage.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import CorrecaoPage from './CorrecaoPage'

// ── Framer Motion mock ──────────────────────────────────────────────────────
vi.mock('framer-motion', () => ({
  motion: new Proxy({}, {
    get: (_t, tag: string) =>
      ({ children, style: _s, initial: _i, animate: _a,
         transition: _tr, exit: _e, ...rest }: any) =>
        (({ div: <div {...rest}>{children}</div> } as any)[tag] ?? <div {...rest}>{children}</div>),
  }),
  AnimatePresence: ({ children }: any) => <>{children}</>,
  useReducedMotion: () => false,
}))

// ── next-themes mock ────────────────────────────────────────────────────────
vi.mock('next-themes', () => ({ useTheme: () => ({ resolvedTheme: 'light', setTheme: vi.fn() }) }))

// ── Analytics mock ──────────────────────────────────────────────────────────
vi.mock('@/lib/analytics', () => ({ trackEvent: vi.fn() }))

// ── Hook mocks ──────────────────────────────────────────────────────────────
const mockSimulado = {
  id: 'sim-1',
  title: 'ENAMED 2025.1',
  sequenceNumber: 1,
  status: 'completed',
}

const mockQuestions = [
  {
    id: 'q1', number: 1, area: 'Clínica Médica', theme: 'Cardiologia',
    text: 'Texto da questão 1',
    imageUrl: null,
    explanation: 'Comentário curto.',
    explanationImageUrl: null,
    options: [
      { id: 'o1a', label: 'A', text: 'Alternativa A' },
      { id: 'o1b', label: 'B', text: 'Alternativa B' },
      { id: 'o1c', label: 'C', text: 'Alternativa C' },
    ],
    correctOptionId: 'o1b',
  },
  {
    id: 'q2', number: 2, area: 'Cirurgia', theme: 'Abdome Agudo',
    text: 'Texto da questão 2',
    imageUrl: null,
    explanation: 'Comentário longo '.repeat(60), // vai gerar overflow
    explanationImageUrl: null,
    options: [
      { id: 'o2a', label: 'A', text: 'Alternativa A' },
      { id: 'o2b', label: 'B', text: 'Alternativa B' },
    ],
    correctOptionId: 'o2a',
  },
]

const mockExamState = {
  status: 'submitted',
  answers: {
    q1: { selectedOption: 'o1a', markedForReview: true, highConfidence: false },
    q2: { selectedOption: 'o2b', markedForReview: false, highConfidence: true },
  },
}

const mockAttempt = { total_correct: 1, total_answered: 2, score_percentage: '50' }

const mockAttemptQuestionResults = {
  q1: { correct_option_id: 'o1b' },
  q2: { correct_option_id: 'o2a' },
}

vi.mock('@/hooks/useSimuladoDetail', () => ({
  useSimuladoDetail: () => ({ simulado: mockSimulado, questions: mockQuestions, loading: false }),
}))

vi.mock('@/hooks/useExamResult', () => ({
  useExamResult: () => ({
    examState: mockExamState,
    attempt: mockAttempt,
    attemptQuestionResults: mockAttemptQuestionResults,
    loading: false,
  }),
}))

vi.mock('@/contexts/UserContext', () => ({
  useUser: () => ({ profile: { segment: 'pro' } }),
}))

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'user-1' } }),
}))

vi.mock('@/lib/simulado-helpers', () => ({
  canViewResultsOrAdminPreview: () => true,
}))

vi.mock('@/components/AddToNotebookModal', () => ({
  AddToNotebookModal: () => null,
}))

vi.mock('@/components/exam/QuestionImage', () => ({
  QuestionImage: ({ alt }: { alt: string }) => <img alt={alt} />,
}))

// ── Helper ──────────────────────────────────────────────────────────────────
function renderPage(adminPreview = false) {
  return render(
    <MemoryRouter initialEntries={[`/simulados/sim-1/correcao`]}>
      <Routes>
        <Route path="/simulados/:id/correcao" element={<CorrecaoPage adminPreview={adminPreview} />} />
      </Routes>
    </MemoryRouter>
  )
}

// ── Tests ───────────────────────────────────────────────────────────────────
describe('CorrecaoPage — smoke', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('renderiza sem crash', () => {
    renderPage()
    expect(screen.getByText(/questão 1/i)).toBeTruthy()
  })
})
```

- [ ] **Step 2: Rodar o teste para garantir que passa (sem mudanças na implementação ainda)**

```bash
cd "c:/Users/Felipe Souza/Documents/enamed-arena" && npm run test -- --run src/pages/CorrecaoPage.test.tsx
```

Esperado: `1 passed` (smoke test apenas checa renderização)

- [ ] **Step 3: Adicionar testes para `expandedExplanations`**

Adicione estes testes ao `describe` existente em `CorrecaoPage.test.tsx`:

```tsx
describe('CorrecaoPage — expandedExplanations', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('mostra o botão "Ver mais" quando o comentário é longo (overflow simulado)', () => {
    // JSDOM não calcula layout real, então fazemos mock do scrollHeight
    const originalScrollHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollHeight')
    Object.defineProperty(HTMLElement.prototype, 'scrollHeight', { configurable: true, get: () => 300 })
    Object.defineProperty(HTMLElement.prototype, 'clientHeight', { configurable: true, get: () => 160 })

    renderPage()
    // Navegar para questão 2 (tem comentário longo)
    fireEvent.click(screen.getByRole('button', { name: /próxima/i }))

    expect(screen.getByRole('button', { name: /ver mais/i })).toBeTruthy()

    // Restaurar
    if (originalScrollHeight) Object.defineProperty(HTMLElement.prototype, 'scrollHeight', originalScrollHeight)
  })

  it('expande o comentário ao clicar em "Ver mais"', () => {
    Object.defineProperty(HTMLElement.prototype, 'scrollHeight', { configurable: true, get: () => 300 })
    Object.defineProperty(HTMLElement.prototype, 'clientHeight', { configurable: true, get: () => 160 })

    renderPage()
    fireEvent.click(screen.getByRole('button', { name: /próxima/i }))

    const btn = screen.getByRole('button', { name: /ver mais/i })
    fireEvent.click(btn)

    expect(screen.getByRole('button', { name: /ver menos/i })).toBeTruthy()
  })

  it('não mostra "Ver mais" quando o comentário é curto', () => {
    // scrollHeight <= clientHeight = não overflowing
    Object.defineProperty(HTMLElement.prototype, 'scrollHeight', { configurable: true, get: () => 80 })
    Object.defineProperty(HTMLElement.prototype, 'clientHeight', { configurable: true, get: () => 160 })

    renderPage()
    // Questão 1 tem comentário curto
    expect(screen.queryByRole('button', { name: /ver mais/i })).toBeNull()
  })
})
```

- [ ] **Step 4: Rodar para ver os testes falharem (comportamento ainda não implementado)**

```bash
npm run test -- --run src/pages/CorrecaoPage.test.tsx
```

Esperado: `1 passed, 3 failed` — os testes de `expandedExplanations` falham porque o botão não existe ainda.

- [ ] **Step 5: Adicionar o estado `expandedExplanations` e a ref de overflow em `CorrecaoPage.tsx`**

Adicione ao topo dos states (após os estados existentes, antes de `questionsWithCorrection`):

```tsx
const EXPLANATION_MAX_H = 160 // px

const [expandedExplanations, setExpandedExplanations] = useState<Set<number>>(new Set())
const [explanationOverflows, setExplanationOverflows] = useState(false)
const explanationRef = useRef<HTMLParagraphElement>(null)
```

Adicione o `useRef` ao import do React no topo do arquivo:
```tsx
import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
```

Adicione o `useEffect` de medição logo após os estados (antes dos early returns):

```tsx
useEffect(() => {
  const el = explanationRef.current
  if (!el) { setExplanationOverflows(false); return }
  setExplanationOverflows(el.scrollHeight > el.clientHeight)
}, [currentIndex, questionsWithCorrection[currentIndex]?.explanation])
```

> **Nota:** Use `questionsWithCorrection[currentIndex]?.explanation` — não `question?.explanation`, pois `question` é declarado após os early returns e não pode ser referenciado em hooks.

- [ ] **Step 6: Rodar os testes novamente**

```bash
npm run test -- --run src/pages/CorrecaoPage.test.tsx
```

Esperado: ainda falha nos testes de `expandedExplanations` porque o JSX com a ref e o botão ainda não foi adicionado. Avançar para Task 4 onde o JSX é alterado.

- [ ] **Step 7: Commit parcial**

```bash
git add src/pages/CorrecaoPage.test.tsx src/pages/CorrecaoPage.tsx
git commit -m "$(cat <<'EOF'
test(correcao): testes base + estado expandedExplanations

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Sticky header com score e barra de progresso

**Files:**
- Modify: `src/pages/CorrecaoPage.tsx`

- [ ] **Step 1: Adicionar o teste do sticky header**

Adicione ao `src/pages/CorrecaoPage.test.tsx`:

```tsx
describe('CorrecaoPage — sticky header', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('mostra o título do simulado no header', () => {
    renderPage()
    expect(screen.getByText(/ENAMED 2025\.1/i)).toBeTruthy()
  })

  it('mostra chips de score corretos', () => {
    renderPage()
    // 1 acerto, 1 erro, 0 em branco de 2 questões = 50%
    expect(screen.getByText('50%')).toBeTruthy()
  })

  it('não renderiza PageHeader no happy path', () => {
    renderPage()
    // O PageHeader renderizava um <h1> com "Gabarito Comentado"
    // No novo design, esse h1 não existe mais — o título vai no sticky header
    const h1s = document.querySelectorAll('h1')
    // Pode existir zero ou um h1 (do sticky header se usarmos), mas não dois
    expect(h1s.length).toBeLessThanOrEqual(1)
  })
})
```

- [ ] **Step 2: Rodar para ver falhar**

```bash
npm run test -- --run src/pages/CorrecaoPage.test.tsx
```

Esperado: os testes de sticky header falham (50% não encontrado ainda no novo formato).

- [ ] **Step 3: Substituir PageHeader + PageBreadcrumb pelo sticky header no happy path**

No `CorrecaoPage.tsx`, localize o bloco do happy path (após todos os early returns), começando em:

```tsx
return (
  <>
    <PageBreadcrumb
```

Substitua **todo o bloco** de `<PageBreadcrumb ... />` + `<PageHeader ... />` por:

```tsx
return (
  <>
    <header
      className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border"
      aria-label="Resultado da correção"
    >
      <div className="flex items-center justify-between px-4 md:px-6 h-12 gap-3">
        <span className="text-body font-semibold text-foreground truncate min-w-0">
          Gabarito — {simulado.title}
          {adminPreview && (
            <span className="ml-2 text-caption text-primary font-bold uppercase tracking-wider">
              · Admin
            </span>
          )}
        </span>
        <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-caption font-bold bg-success/10 text-success">
            ✓ {attempt?.total_correct ?? score.totalCorrect}
          </span>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-caption font-bold bg-destructive/10 text-destructive">
            ✗ {score.totalIncorrect}
          </span>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-caption font-bold bg-warning/10 text-warning">
            — {score.totalUnanswered}
          </span>
          <div className="w-px h-4 bg-border mx-1" />
          <span className="text-heading-3 font-bold text-primary tabular-nums">
            {attempt?.score_percentage != null
              ? Math.round(Number(attempt.score_percentage))
              : score.percentageScore}%
          </span>
          <span className="text-caption text-muted-foreground tabular-nums">
            {currentIndex + 1}/{score.totalQuestions}
          </span>
        </div>
      </div>
      <div
        className="h-[3px] bg-muted"
        role="progressbar"
        aria-valuenow={currentIndex + 1}
        aria-valuemax={score.totalQuestions}
        aria-label={`Questão ${currentIndex + 1} de ${score.totalQuestions}`}
      >
        <div
          className="h-full bg-primary transition-all duration-300"
          style={{ width: `${((currentIndex + 1) / score.totalQuestions) * 100}%` }}
        />
      </div>
    </header>
```

Remova os imports `PageBreadcrumb` e `PageHeader` do topo do arquivo (eles ainda são usados nos estados de erro, então **não remova** — apenas verifique se ainda estão sendo usados nos early returns. Se estiverem, mantenha os imports).

> **Atenção:** `PageHeader` e `PageBreadcrumb` continuam sendo usados nos blocos `if (!resultsAllowed)` e `if (!examState || !score)`. Não remova esses imports.

- [ ] **Step 4: Rodar os testes**

```bash
npm run test -- --run src/pages/CorrecaoPage.test.tsx
```

Esperado: os testes de sticky header passam. Verifique que os demais não regrediram.

- [ ] **Step 5: Commit**

```bash
git add src/pages/CorrecaoPage.tsx src/pages/CorrecaoPage.test.tsx
git commit -m "$(cat <<'EOF'
feat(correcao): sticky header com score chips e barra de progresso

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Reestruturar header do card da questão (Caderno + flags)

**Files:**
- Modify: `src/pages/CorrecaoPage.tsx`

- [ ] **Step 1: Adicionar testes**

Adicione ao `src/pages/CorrecaoPage.test.tsx`:

```tsx
describe('CorrecaoPage — question card header', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('mostra botão "Caderno de Erros" no header do card (usuário PRO)', () => {
    renderPage()
    expect(screen.getByRole('button', { name: /caderno de erros/i })).toBeTruthy()
  })

  it('mostra pill PRO quando usuário não tem acesso ao caderno', () => {
    vi.mocked(require('@/contexts/UserContext').useUser).mockReturnValueOnce({
      profile: { segment: 'standard' },
    })
    renderPage()
    expect(screen.getByText(/PRO/i)).toBeTruthy()
  })

  it('mostra tag de revisão quando questão foi marcada', () => {
    renderPage()
    // q1 tem markedForReview: true
    expect(screen.getByText(/revisão/i)).toBeTruthy()
  })
})
```

- [ ] **Step 2: Rodar para ver falhar**

```bash
npm run test -- --run src/pages/CorrecaoPage.test.tsx
```

Esperado: falha no teste do Caderno de Erros (ainda está na posição antiga, após o comentário).

- [ ] **Step 3: Reestruturar o header do card da questão**

Localize o bloco atual que começa com:

```tsx
<div className="flex items-center justify-between mb-4 flex-wrap gap-2">
  <div className="flex items-center gap-2.5 flex-wrap">
    <span className="text-body font-bold text-foreground">Questão {question.number}</span>
    <span className="text-caption text-muted-foreground">de {questions.length}</span>
    <span className="text-caption text-muted-foreground px-2 py-0.5 rounded-md bg-muted">{question.area}</span>
    <span className="text-caption text-muted-foreground px-2 py-0.5 rounded-md bg-muted">{question.theme}</span>
  </div>
  <div className="flex items-center gap-2 flex-wrap">
    {answer?.markedForReview && (
      <span className="inline-flex items-center gap-1 text-caption text-info bg-info/10 px-2 py-0.5 rounded-md font-medium">
        <Flag className="h-3 w-3" /> Revisão
      </span>
    )}
    {answer?.highConfidence && (
      <span className="inline-flex items-center gap-1 text-caption text-success bg-success/10 px-2 py-0.5 rounded-md font-medium">
        <Zap className="h-3 w-3" /> Alta certeza
      </span>
    )}
    {result.isCorrect ? (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-caption font-bold bg-success/10 text-success">
        <CheckCircle2 className="h-3.5 w-3.5" /> Acertou
      </span>
    ) : result.wasAnswered ? (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-caption font-bold bg-destructive/10 text-destructive">
        <XCircle className="h-3.5 w-3.5" /> Errou
      </span>
    ) : (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-caption font-bold bg-warning/10 text-warning">Em branco</span>
    )}
  </div>
</div>
```

Substitua por:

```tsx
<div className="flex items-start justify-between mb-4 gap-3 flex-wrap">
  {/* Esquerda: número + meta tags */}
  <div className="min-w-0">
    <div className="flex items-baseline gap-2 mb-1.5">
      <span className="text-body font-bold text-foreground">Questão {question.number}</span>
      <span className="text-caption text-muted-foreground">de {questions.length}</span>
    </div>
    <div className="flex items-center gap-1.5 flex-wrap">
      <span className="text-caption text-muted-foreground px-2 py-0.5 rounded-md bg-muted">{question.area}</span>
      <span className="text-caption text-muted-foreground px-2 py-0.5 rounded-md bg-muted">{question.theme}</span>
      {answer?.markedForReview && (
        <span className="inline-flex items-center gap-1 text-caption text-info bg-info/10 px-2 py-0.5 rounded-md font-medium">
          <Flag className="h-3 w-3" /> Revisão
        </span>
      )}
      {answer?.highConfidence && (
        <span className="inline-flex items-center gap-1 text-caption text-success bg-success/10 px-2 py-0.5 rounded-md font-medium">
          <Zap className="h-3 w-3" /> Alta certeza
        </span>
      )}
    </div>
  </div>

  {/* Direita: caderno + badge resultado */}
  <div className="flex items-center gap-2 flex-wrap shrink-0">
    {canUseNotebook ? (
      <button
        onClick={() => setNotebookModal(true)}
        aria-label="Caderno de Erros"
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-caption font-medium transition-all bg-secondary text-secondary-foreground hover:bg-muted border border-border/50"
      >
        <BookOpen className="h-3.5 w-3.5" />
        Caderno de Erros
      </button>
    ) : (
      <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent/50 border border-primary/10 text-caption text-muted-foreground">
        <Sparkles className="h-3.5 w-3.5 text-primary" />
        <span>PRO: ENAMED</span>
      </div>
    )}
    {result.isCorrect ? (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-caption font-bold bg-success/10 text-success">
        <CheckCircle2 className="h-3.5 w-3.5" /> Acertou
      </span>
    ) : result.wasAnswered ? (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-caption font-bold bg-destructive/10 text-destructive">
        <XCircle className="h-3.5 w-3.5" /> Errou
      </span>
    ) : (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-caption font-bold bg-warning/10 text-warning">Em branco</span>
    )}
  </div>
</div>
```

- [ ] **Step 4: Remover o bloco antigo do botão Caderno de Erros**

Localize e remova o bloco que existia após o card de comentário:

```tsx
<div className="mb-6">
  {canUseNotebook ? (
    <button
      onClick={() => setNotebookModal(true)}
      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-body-sm font-medium transition-all bg-secondary text-secondary-foreground hover:bg-muted border border-border/50"
    >
      <BookOpen className="h-4 w-4" />
      Adicionar ao Caderno de Erros
    </button>
  ) : (
    <div className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-accent/50 border border-primary/10 text-body-sm text-muted-foreground">
      <Sparkles className="h-4 w-4 text-primary" />
      <span>Caderno de Erros — <strong className="text-primary font-semibold">PRO: ENAMED</strong></span>
    </div>
  )}
</div>
```

- [ ] **Step 5: Rodar os testes**

```bash
npm run test -- --run src/pages/CorrecaoPage.test.tsx
```

Esperado: todos os testes de `question card header` passam.

- [ ] **Step 6: Commit**

```bash
git add src/pages/CorrecaoPage.tsx src/pages/CorrecaoPage.test.tsx
git commit -m "$(cat <<'EOF'
feat(correcao): caderno de erros e flags movidos pro header do card

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Comentário do professor com truncamento "Ver mais"

**Files:**
- Modify: `src/pages/CorrecaoPage.tsx`

- [ ] **Step 1: Rodar os testes de expandedExplanations (já escritos na Task 1)**

```bash
npm run test -- --run src/pages/CorrecaoPage.test.tsx
```

Esperado: os 3 testes de `expandedExplanations` ainda falham. Vamos implementar agora.

- [ ] **Step 2: Substituir o card de comentário atual pela versão com truncamento**

Localize o bloco:

```tsx
{(question.explanation || question.explanationImageUrl) && (
  <PremiumCard className="p-5 md:p-6 mb-4 border-primary/10 bg-primary/[0.02]">
    <div className="flex items-center gap-2 mb-3">
      <BookOpen className="h-4 w-4 text-primary" />
      <h3 className="text-body font-bold text-primary">Comentário do Professor</h3>
    </div>
    {question.explanation && (
      <p className="text-body text-muted-foreground leading-relaxed whitespace-pre-wrap">{question.explanation}</p>
    )}
    {question.explanationImageUrl && (
      <div className="mt-4">
        <QuestionImage src={question.explanationImageUrl} alt={`Imagem do comentário da questão ${question.number}`} />
      </div>
    )}
  </PremiumCard>
)}
```

Substitua por:

```tsx
{(question.explanation || question.explanationImageUrl) && (
  <PremiumCard className="p-5 md:p-6 mb-4 border-primary/10 bg-primary/[0.02]">
    <div className="flex items-center gap-2 mb-3">
      <BookOpen className="h-4 w-4 text-primary" />
      <h3 className="text-body font-bold text-primary">Comentário do Professor</h3>
    </div>
    {question.explanation && (
      <div className="relative">
        <p
          ref={explanationRef}
          className={cn(
            'text-body text-muted-foreground leading-relaxed whitespace-pre-wrap overflow-hidden transition-all duration-300',
            !expandedExplanations.has(currentIndex) && explanationOverflows
              ? `max-h-[${EXPLANATION_MAX_H}px]`
              : '',
          )}
          style={
            !expandedExplanations.has(currentIndex) && explanationOverflows
              ? { maxHeight: `${EXPLANATION_MAX_H}px` }
              : undefined
          }
        >
          {question.explanation}
        </p>
        {!expandedExplanations.has(currentIndex) && explanationOverflows && (
          <div className="absolute bottom-0 left-0 right-0 h-10 bg-gradient-to-t from-card to-transparent pointer-events-none" />
        )}
        {explanationOverflows && (
          <button
            onClick={() =>
              setExpandedExplanations(prev => {
                const next = new Set(prev)
                if (next.has(currentIndex)) next.delete(currentIndex)
                else next.add(currentIndex)
                return next
              })
            }
            aria-expanded={expandedExplanations.has(currentIndex)}
            className="mt-2 text-caption font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {expandedExplanations.has(currentIndex) ? 'Ver menos ▴' : 'Ver mais ▾'}
          </button>
        )}
      </div>
    )}
    {question.explanationImageUrl && (
      <div className="mt-4">
        <QuestionImage src={question.explanationImageUrl} alt={`Imagem do comentário da questão ${question.number}`} />
      </div>
    )}
  </PremiumCard>
)}
```

> **Nota:** `style={{ maxHeight }}` é usado em conjunto com a classe Tailwind porque Tailwind não aceita valores dinâmicos em `max-h-[${variable}px]` em tempo de execução. O `style` prop garante o valor correto; a classe Tailwind pode ser removida se quiser simplificar.

- [ ] **Step 3: Rodar os testes**

```bash
npm run test -- --run src/pages/CorrecaoPage.test.tsx
```

Esperado: todos os testes de `expandedExplanations` passam. Total: todos passando.

- [ ] **Step 4: Commit**

```bash
git add src/pages/CorrecaoPage.tsx
git commit -m "$(cat <<'EOF'
feat(correcao): comentário do professor com truncamento e ver mais

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Sidebar sticky com flags de revisão e legenda atualizada

**Files:**
- Modify: `src/pages/CorrecaoPage.tsx`

- [ ] **Step 1: Adicionar teste**

Adicione ao `src/pages/CorrecaoPage.test.tsx`:

```tsx
describe('CorrecaoPage — sidebar', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('exibe item de legenda "Flag revisão" na sidebar', () => {
    renderPage()
    expect(screen.getByText(/flag revisão/i)).toBeTruthy()
  })
})
```

- [ ] **Step 2: Rodar para ver falhar**

```bash
npm run test -- --run src/pages/CorrecaoPage.test.tsx
```

Esperado: `flag revisão` não encontrado.

- [ ] **Step 3: Substituir a `<aside>` desktop pelo novo markup**

Localize o bloco:

```tsx
{/* Side navigator */}
<aside className="hidden md:flex w-60 flex-col gap-3 shrink-0">
  <p className="text-body font-semibold text-foreground">Questões</p>
  <p className="text-caption text-muted-foreground mb-2">{score.totalCorrect}/{score.totalQuestions} corretas</p>
  <div className="grid grid-cols-5 gap-1.5">
    {score.questionResults.map((r, i) => (
      <button key={r.questionId} onClick={() => handleNavigate(i)} className={cn(
        'h-9 w-full rounded-lg text-caption font-bold transition-all',
        i === currentIndex ? 'ring-2 ring-primary bg-primary text-primary-foreground'
          : r.isCorrect ? 'bg-success/15 text-success hover:bg-success/25'
          : r.wasAnswered ? 'bg-destructive/15 text-destructive hover:bg-destructive/25'
          : 'bg-warning/15 text-warning hover:bg-warning/25',
      )}>{i + 1}</button>
    ))}
  </div>
  <div className="mt-4 space-y-2.5 text-caption text-muted-foreground border-t border-border pt-4">
    <div className="flex items-center gap-2"><span className="h-3 w-3 rounded bg-success/20 border border-success/30" /> Acertou</div>
    <div className="flex items-center gap-2"><span className="h-3 w-3 rounded bg-destructive/20 border border-destructive/30" /> Errou</div>
    <div className="flex items-center gap-2"><span className="h-3 w-3 rounded bg-warning/20 border border-warning/30" /> Em branco</div>
  </div>
</aside>
```

Substitua por:

```tsx
{/* Side navigator — sticky desktop */}
<aside className="hidden md:flex w-56 flex-col gap-3 shrink-0">
  <div className="sticky top-12 pt-4">
    <p className="text-overline uppercase text-muted-foreground tracking-wider mb-3">Questões</p>
    <div className="grid grid-cols-5 gap-1.5 mb-4">
      {score.questionResults.map((r, i) => {
        const qId = questionsWithCorrection[i]?.id
        const qAnswer = qId ? examState?.answers[qId] : undefined
        const hasFlag = !!qAnswer?.markedForReview
        return (
          <button
            key={r.questionId}
            onClick={() => handleNavigate(i)}
            aria-label={`Questão ${i + 1}${r.isCorrect ? ', acertou' : r.wasAnswered ? ', errou' : ', em branco'}${hasFlag ? ', marcada para revisão' : ''}`}
            className={cn(
              'relative h-9 w-full rounded-lg text-caption font-bold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              i === currentIndex
                ? 'ring-2 ring-primary bg-primary text-primary-foreground'
                : r.isCorrect
                  ? 'bg-success/15 text-success hover:bg-success/25'
                  : r.wasAnswered
                    ? 'bg-destructive/15 text-destructive hover:bg-destructive/25'
                    : 'bg-warning/15 text-warning hover:bg-warning/25',
            )}
          >
            {i + 1}
            {hasFlag && (
              <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-warning border border-background" />
            )}
          </button>
        )
      })}
    </div>
    <div className="space-y-2 text-caption text-muted-foreground border-t border-border pt-3">
      <div className="flex items-center gap-2">
        <span className="h-3 w-3 rounded bg-success/20 border border-success/30 shrink-0" />
        Acertou
      </div>
      <div className="flex items-center gap-2">
        <span className="h-3 w-3 rounded bg-destructive/20 border border-destructive/30 shrink-0" />
        Errou
      </div>
      <div className="flex items-center gap-2">
        <span className="h-3 w-3 rounded bg-warning/20 border border-warning/30 shrink-0" />
        Em branco
      </div>
      <div className="flex items-center gap-2">
        <span className="h-3 w-3 rounded-full bg-warning shrink-0" />
        Flag revisão
      </div>
    </div>
  </div>
</aside>
```

> **Nota sobre `top-12`:** O sticky header tem altura de ~48px (`h-12`). A sidebar usa `top-12` (48px) para ficar imediatamente abaixo dele. Se o header ficar mais alto (em telas muito estreitas), ajuste para `top-[56px]`.

- [ ] **Step 4: Rodar os testes**

```bash
npm run test -- --run src/pages/CorrecaoPage.test.tsx
```

Esperado: todos passando.

- [ ] **Step 5: Commit**

```bash
git add src/pages/CorrecaoPage.tsx src/pages/CorrecaoPage.test.tsx
git commit -m "$(cat <<'EOF'
feat(correcao): sidebar sticky com flags de revisão e legenda

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Mobile — botão "⊞ Grade" nomeado

**Files:**
- Modify: `src/pages/CorrecaoPage.tsx`

- [ ] **Step 1: Adicionar teste**

Adicione ao `src/pages/CorrecaoPage.test.tsx`:

```tsx
describe('CorrecaoPage — mobile nav', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('mostra botão "Grade" com texto visível na barra de navegação mobile', () => {
    renderPage()
    // O botão deve ter texto "Grade" (não só ícone)
    expect(screen.getByRole('button', { name: /grade/i })).toBeTruthy()
  })
})
```

- [ ] **Step 2: Rodar para ver falhar**

```bash
npm run test -- --run src/pages/CorrecaoPage.test.tsx
```

Esperado: `grade` não encontrado — o botão atual tem apenas `<Grid3X3>` sem texto.

- [ ] **Step 3: Substituir o botão de grade mobile**

Localize:

```tsx
<button onClick={() => setShowNav(v => !v)} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-muted text-muted-foreground text-body-sm font-medium hover:bg-muted/80 transition-colors md:hidden">
  <Grid3X3 className="h-4 w-4" />
</button>
```

Substitua por:

```tsx
<button
  onClick={() => setShowNav(v => !v)}
  aria-label="Grade de questões"
  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-muted text-muted-foreground text-body-sm font-medium hover:bg-muted/80 transition-colors md:hidden"
>
  <Grid3X3 className="h-4 w-4" aria-hidden />
  <span>Grade</span>
</button>
```

- [ ] **Step 4: Remover o import `Grid3X3` se não for mais usado em outro lugar**

Verifique se `Grid3X3` é usado apenas aqui. Se sim, remova do import:

```tsx
// Antes:
import {
  ArrowLeft, ChevronLeft, ChevronRight, CheckCircle2, XCircle,
  FileText, BookOpen, Flag, Zap, Grid3X3, Sparkles,
} from 'lucide-react';

// Depois (Grid3X3 permanece, apenas adiciona aria-hidden no JSX):
// Mantenha o import — ele ainda é usado.
```

- [ ] **Step 5: Rodar todos os testes**

```bash
npm run test -- --run src/pages/CorrecaoPage.test.tsx
```

Esperado: todos passando.

- [ ] **Step 6: Rodar o build para garantir sem erros de TypeScript**

```bash
npm run build 2>&1 | tail -20
```

Esperado: `built in Xs` sem erros de TypeScript relacionados ao `CorrecaoPage`.

- [ ] **Step 7: Commit final**

```bash
git add src/pages/CorrecaoPage.tsx src/pages/CorrecaoPage.test.tsx
git commit -m "$(cat <<'EOF'
feat(correcao): botão grade nomeado no mobile

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Checklist de verificação visual (manual)

Após todas as tasks, abra `/admin/preview/simulados/:id/correcao` e verifique:

- [ ] Header sticky aparece e fica fixo ao rolar a página
- [ ] Chips de score (✓ ✗ —) exibem valores corretos
- [ ] Barra de progresso avança ao navegar entre questões
- [ ] "Caderno de Erros" aparece no header do card, não no rodapé
- [ ] Questões com `markedForReview: true` mostram dot badge no quadradinho da sidebar
- [ ] Comentários longos mostram "Ver mais ▾", comentários curtos não
- [ ] Clicar "Ver mais" expande, clicar "Ver menos" contrai
- [ ] Estado de expansão é independente por questão (Q2 expandida, navegar para Q3, voltar para Q2 → ainda expandida)
- [ ] Sidebar não rola com o conteúdo no desktop
- [ ] Mobile: botão "⊞ Grade" visível com texto, bottom sheet abre ao clicar
- [ ] `adminPreview=true`: label "· Admin" aparece no header sticky
- [ ] Rota pública `/simulados/:id/correcao`: funciona identicamente
