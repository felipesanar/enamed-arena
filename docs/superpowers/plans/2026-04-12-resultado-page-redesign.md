# Resultado Page Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesenhar `ResultadoPage.tsx` com hero card wine escuro, ring SVG animado de progresso, stat cards coloridos, highlights de área dentro do hero, e CTA perolado "Ir para correção comentada".

**Architecture:** Todas as mudanças ficam em `src/pages/ResultadoPage.tsx`. O hero card vira um `div` custom (não mais `PremiumCard`) com background wine escuro. O ring usa `useState` + `useEffect` para animar via CSS `transition` no `stroke-dashoffset`, sem depender de Framer Motion em SVG. O CTA usa `motion.span` interno para o shimmer.

**Tech Stack:** React 18, TypeScript, Tailwind CSS 3.4, Framer Motion 12, Vitest 3 + Testing Library

---

## Mapa de Arquivos

| Arquivo | Ação |
|---------|------|
| `src/pages/ResultadoPage.tsx` | Modificar — todas as mudanças visuais |
| `src/pages/ResultadoPage.test.tsx` | Criar — testes para novos comportamentos |

---

## Task 1: Test file setup + smoke test

**Files:**
- Create: `src/pages/ResultadoPage.test.tsx`

- [ ] **Step 1: Criar o arquivo de testes com mocks e smoke test**

Crie `src/pages/ResultadoPage.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import ResultadoPage from './ResultadoPage'

// ── Framer Motion mock ──────────────────────────────────────────────────────
vi.mock('framer-motion', () => ({
  motion: new Proxy({}, {
    get: (_t, tag: string) => {
      const Component = ({ children, ...rest }: any) => {
        const { initial: _i, animate: _a, transition: _tr, exit: _e, variants: _v, ...domProps } = rest
        if (tag === 'span') return <span {...domProps}>{children}</span>
        return <div {...domProps}>{children}</div>
      }
      return Component
    },
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
  resultsReleaseAt: '2025-12-01T00:00:00Z',
}

const mockExamState = {
  status: 'submitted',
  answers: {
    'q1': { selectedOption: 'o1b', markedForReview: false, highConfidence: false, eliminatedAlternatives: [] },
    'q2': { selectedOption: 'o2a', markedForReview: false, highConfidence: false, eliminatedAlternatives: [] },
  },
  startedAt: '2025-11-01T10:00:00Z',
  tabExitCount: 0,
  fullscreenExitCount: 0,
}

const mockAttempt = {
  id: 'att-1',
  total_correct: 31,
  total_answered: 100,
  score_percentage: 31,
  is_within_window: true,
}

const mockQuestions = [
  {
    id: 'q1', number: 1, area: 'Clínica Médica', theme: 'Cardiologia',
    text: 'Questão 1', imageUrl: null, explanation: 'Explicação 1',
    explanationImageUrl: null, difficulty: null, correctOptionId: 'o1b',
    options: [
      { id: 'o1a', label: 'A', text: 'Alt A' },
      { id: 'o1b', label: 'B', text: 'Alt B' },
    ],
  },
  {
    id: 'q2', number: 2, area: 'Cirurgia', theme: 'Trauma',
    text: 'Questão 2', imageUrl: null, explanation: 'Explicação 2',
    explanationImageUrl: null, difficulty: null, correctOptionId: 'o2b',
    options: [
      { id: 'o2a', label: 'A', text: 'Alt A' },
      { id: 'o2b', label: 'B', text: 'Alt B' },
    ],
  },
]

vi.mock('@/hooks/useSimuladoDetail', () => ({
  useSimuladoDetail: () => ({
    simulado: mockSimulado,
    questions: mockQuestions,
    loading: false,
  }),
}))

vi.mock('@/hooks/useExamResult', () => ({
  useExamResult: () => ({
    examState: mockExamState,
    attempt: mockAttempt,
    loading: false,
  }),
}))

vi.mock('@/contexts/UserContext', () => ({
  useUser: () => ({
    profile: { segment: 'pro', id: 'user-1' },
    isOnboardingComplete: true,
  }),
}))

vi.mock('@/lib/simulado-helpers', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/simulado-helpers')>()
  return {
    ...actual,
    canViewResultsOrAdminPreview: () => true,
  }
})

function renderPage(adminPreview = false) {
  return render(
    <MemoryRouter initialEntries={['/simulados/sim-1/resultado']}>
      <Routes>
        <Route
          path="/simulados/:id/resultado"
          element={<ResultadoPage adminPreview={adminPreview} />}
        />
      </Routes>
    </MemoryRouter>
  )
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe('ResultadoPage — smoke', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('renderiza sem crash', () => {
    renderPage()
    expect(document.body).toBeTruthy()
  })
})
```

- [ ] **Step 2: Rodar para verificar que passa**

```bash
cd "c:/Users/Felipe Souza/Documents/enamed-arena" && npx vitest run src/pages/ResultadoPage.test.tsx 2>&1 | tail -15
```

Esperado: 1 test passing.

- [ ] **Step 3: Commit**

```bash
cd "c:/Users/Felipe Souza/Documents/enamed-arena" && git add src/pages/ResultadoPage.test.tsx && git commit -m "test(resultado): setup de testes base"
```

---

## Task 2: Hero card wine escuro + ring SVG animado

**Files:**
- Modify: `src/pages/ResultadoPage.tsx`
- Modify: `src/pages/ResultadoPage.test.tsx`

- [ ] **Step 1: Adicionar teste que falha**

Adicione ao `src/pages/ResultadoPage.test.tsx`:

```tsx
describe('ResultadoPage — hero card', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('exibe o percentual de acerto em destaque', () => {
    renderPage()
    expect(screen.getByText('31%')).toBeTruthy()
  })

  it('exibe subtítulo com contagem de corretas', () => {
    renderPage()
    expect(screen.getByText(/31.*questões corretas/i)).toBeTruthy()
  })

  it('exibe o ring SVG de progresso', () => {
    renderPage()
    // O SVG do ring deve existir (role="img" com aria-label)
    expect(screen.getByRole('img', { name: /31%.*aproveitamento/i })).toBeTruthy()
  })
})
```

- [ ] **Step 2: Rodar para ver falhar**

```bash
cd "c:/Users/Felipe Souza/Documents/enamed-arena" && npx vitest run src/pages/ResultadoPage.test.tsx 2>&1 | tail -15
```

Esperado: os 3 novos testes falham (percentual pode existir mas ring não tem aria-label ainda).

- [ ] **Step 3: Substituir o hero card em `ResultadoPage.tsx`**

Adicione `useState` ao import do React:

```tsx
import { useState, useMemo, useEffect, useRef } from 'react';
```

Adicione a constante e o estado do ring logo antes do `return` (após os cálculos de `hasCadernoErros`):

```tsx
const RING_CIRCUMFERENCE = 376.99
const ringTargetOffset = RING_CIRCUMFERENCE * (1 - officialPercentage / 100)
const [ringOffset, setRingOffset] = useState(RING_CIRCUMFERENCE)

useEffect(() => {
  if (prefersReducedMotion) {
    setRingOffset(ringTargetOffset)
    return
  }
  const t = setTimeout(() => setRingOffset(ringTargetOffset), 100)
  return () => clearTimeout(t)
}, [ringTargetOffset, prefersReducedMotion])
```

Substitua todo o bloco do hero (`<motion.div className="mb-8">...</motion.div>`) — incluindo o `PremiumCard` interno — por:

```tsx
{/* Hero score */}
<motion.div
  initial={prefersReducedMotion ? false : { opacity: 0, scale: 0.98 }}
  animate={{ opacity: 1, scale: 1 }}
  transition={{ duration: prefersReducedMotion ? 0 : 0.5 }}
  className="mb-8"
>
  <div
    className="rounded-3xl overflow-hidden"
    style={{
      background: 'linear-gradient(155deg, #7a1a32 0%, #5c1225 45%, #3d0b18 100%)',
      boxShadow: '0 32px 64px -20px rgba(142,31,61,0.7), 0 8px 24px -8px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.08)',
    }}
  >
    {/* glow orb */}
    <div
      className="absolute top-0 right-0 w-64 h-64 pointer-events-none"
      style={{ background: 'radial-gradient(circle, rgba(255,255,255,0.06) 0%, transparent 70%)', transform: 'translate(30%, -30%)' }}
      aria-hidden
    />

    <div className="relative z-10 px-7 pt-9 pb-7">

      {/* Ring + score */}
      <div className="flex flex-col items-center mb-7">
        <svg
          width="140"
          height="140"
          viewBox="0 0 140 140"
          className="mb-3.5"
          style={{ transform: 'rotate(-90deg)' }}
          role="img"
          aria-label={`${officialPercentage}% de aproveitamento`}
        >
          <defs>
            <linearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#ff9ab0" />
              <stop offset="100%" stopColor="#ffffff" />
            </linearGradient>
          </defs>
          <circle
            cx="70" cy="70" r="60"
            fill="none"
            stroke="rgba(255,255,255,0.08)"
            strokeWidth="10"
          />
          <circle
            cx="70" cy="70" r="60"
            fill="none"
            stroke="url(#ringGrad)"
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={RING_CIRCUMFERENCE}
            style={{
              strokeDashoffset: ringOffset,
              transition: prefersReducedMotion ? 'none' : 'stroke-dashoffset 1s ease-out',
              filter: 'drop-shadow(0 0 8px rgba(255,180,180,0.4))',
            }}
          />
          {/* center content via foreignObject for positioning */}
        </svg>

        {/* score sobreposto ao ring via position absolute wrapper */}
        {/* Nota: usamos um segundo div absoluto pois o SVG não aceita position */}
        <div className="flex flex-col items-center -mt-[116px] mb-[40px] pointer-events-none" aria-hidden>
          <Trophy className="h-5 w-5 mb-1" style={{ color: 'rgba(255,255,255,0.45)' }} />
          <span className="text-display font-bold leading-none" style={{ color: '#fff' }}>
            {officialPercentage}%
          </span>
          <span className="text-overline uppercase tracking-wider mt-1" style={{ color: 'rgba(255,255,255,0.4)' }}>
            do total
          </span>
        </div>

        <p className="text-body" style={{ color: 'rgba(255,255,255,0.55)' }}>
          <strong style={{ color: 'rgba(255,255,255,0.9)', fontWeight: 600 }}>{officialCorrect}</strong>
          {' '}de{' '}
          <strong style={{ color: 'rgba(255,255,255,0.9)', fontWeight: 600 }}>{overall.totalQuestions}</strong>
          {' '}questões corretas
        </p>
      </div>
    </div>
  </div>
</motion.div>
```

**Nota importante sobre o ring center:** O SVG `rotate(-90deg)` faz o anel começar no topo mas também rotaciona qualquer texto interno. Por isso o conteúdo central (percentual, ícone) fica num `div` absolutamente posicionado via margem negativa, fora do SVG. O wrapper do ring deve ter `position: relative`:

Ajuste o markup para:

```tsx
{/* Ring + score */}
<div className="flex flex-col items-center mb-7">
  <div className="relative" style={{ width: 140, height: 140 }}>
    <svg
      width="140"
      height="140"
      viewBox="0 0 140 140"
      style={{ transform: 'rotate(-90deg)' }}
      role="img"
      aria-label={`${officialPercentage}% de aproveitamento`}
    >
      <defs>
        <linearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#ff9ab0" />
          <stop offset="100%" stopColor="#ffffff" />
        </linearGradient>
      </defs>
      <circle
        cx="70" cy="70" r="60"
        fill="none"
        stroke="rgba(255,255,255,0.08)"
        strokeWidth="10"
      />
      <circle
        cx="70" cy="70" r="60"
        fill="none"
        stroke="url(#ringGrad)"
        strokeWidth="10"
        strokeLinecap="round"
        strokeDasharray={RING_CIRCUMFERENCE}
        style={{
          strokeDashoffset: ringOffset,
          transition: prefersReducedMotion ? 'none' : 'stroke-dashoffset 1s ease-out',
          filter: 'drop-shadow(0 0 8px rgba(255,180,180,0.4))',
        }}
      />
    </svg>
    {/* center text — absolute over the SVG */}
    <div className="absolute inset-0 flex flex-col items-center justify-center">
      <Trophy className="h-5 w-5 mb-1" style={{ color: 'rgba(255,255,255,0.45)' }} />
      <span className="text-display font-bold leading-none tabular-nums" style={{ color: '#fff' }}>
        {officialPercentage}%
      </span>
      <span className="text-overline uppercase tracking-wider mt-1" style={{ color: 'rgba(255,255,255,0.4)' }}>
        do total
      </span>
    </div>
  </div>

  <p className="text-body text-center mt-3.5" style={{ color: 'rgba(255,255,255,0.55)' }}>
    <strong style={{ color: 'rgba(255,255,255,0.9)', fontWeight: 600 }}>{officialCorrect}</strong>
    {' '}de{' '}
    <strong style={{ color: 'rgba(255,255,255,0.9)', fontWeight: 600 }}>{overall.totalQuestions}</strong>
    {' '}questões corretas
  </p>
</div>
```

- [ ] **Step 4: Rodar os testes**

```bash
cd "c:/Users/Felipe Souza/Documents/enamed-arena" && npx vitest run src/pages/ResultadoPage.test.tsx 2>&1 | tail -15
```

Esperado: 4 testes passando.

- [ ] **Step 5: Commit**

```bash
cd "c:/Users/Felipe Souza/Documents/enamed-arena" && git add src/pages/ResultadoPage.tsx src/pages/ResultadoPage.test.tsx && git commit -m "feat(resultado): hero card wine escuro com ring SVG animado"
```

---

## Task 3: Stat cards dark + highlights dentro do hero

**Files:**
- Modify: `src/pages/ResultadoPage.tsx`
- Modify: `src/pages/ResultadoPage.test.tsx`

- [ ] **Step 1: Adicionar testes que falham**

Adicione ao test file:

```tsx
describe('ResultadoPage — stat cards', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('exibe os 4 stat cards com labels', () => {
    renderPage()
    expect(screen.getByText('Acertos')).toBeTruthy()
    expect(screen.getByText('Erros')).toBeTruthy()
    expect(screen.getByText('Em branco')).toBeTruthy()
    expect(screen.getByText('Respondidas')).toBeTruthy()
  })
})

describe('ResultadoPage — highlights', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('exibe Ponto forte e Oportunidade quando há mais de 1 área', () => {
    renderPage()
    expect(screen.getByText('Ponto forte')).toBeTruthy()
    expect(screen.getByText('Oportunidade')).toBeTruthy()
  })
})
```

- [ ] **Step 2: Rodar para ver falhar**

```bash
cd "c:/Users/Felipe Souza/Documents/enamed-arena" && npx vitest run src/pages/ResultadoPage.test.tsx 2>&1 | tail -15
```

Esperado: os novos testes falham (labels existem mas com markup diferente).

- [ ] **Step 3: Substituir stat cards e highlights no hero**

Dentro do `div` com `className="relative z-10 px-7 pt-9 pb-7"`, após o bloco do ring (`</div>` do ring section), adicione os stat cards e highlights:

```tsx
{/* Stat cards */}
<div className="grid grid-cols-4 gap-2 mb-4">
  {([
    {
      label: 'Acertos',
      value: officialCorrect,
      iconBg: 'rgba(34,197,94,0.15)',
      iconColor: '#4ade80',
      icon: <CheckCircle2 className="h-4 w-4" />,
    },
    {
      label: 'Erros',
      value: officialIncorrect,
      iconBg: 'rgba(239,68,68,0.15)',
      iconColor: '#f87171',
      icon: <XCircle className="h-4 w-4" />,
    },
    {
      label: 'Em branco',
      value: officialUnanswered,
      iconBg: 'rgba(255,255,255,0.08)',
      iconColor: 'rgba(255,255,255,0.4)',
      icon: <MinusCircle className="h-4 w-4" />,
    },
    {
      label: 'Respondidas',
      value: officialAnswered,
      iconBg: 'rgba(99,179,237,0.15)',
      iconColor: '#7dd3fc',
      icon: <ClipboardCheck className="h-4 w-4" />,
    },
  ] as const).map((stat, i) => (
    <motion.div
      key={stat.label}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 + i * 0.08 }}
      className="rounded-2xl py-3 px-1.5 text-center"
      style={{
        background: 'rgba(255,255,255,0.07)',
        border: '1px solid rgba(255,255,255,0.1)',
      }}
    >
      <div
        className="w-8 h-8 rounded-[9px] flex items-center justify-center mx-auto mb-2"
        style={{ background: stat.iconBg, color: stat.iconColor }}
      >
        {stat.icon}
      </div>
      <p className="text-heading-2 leading-none mb-1" style={{ color: '#fff' }}>
        {stat.value}
      </p>
      <p className="text-caption uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.35)' }}>
        {stat.label}
      </p>
    </motion.div>
  ))}
</div>

{/* Divider */}
<div className="mb-4" style={{ height: 1, background: 'rgba(255,255,255,0.08)', margin: '0 -4px 16px' }} />

{/* Highlights */}
{byArea.length > 1 && (
  <div className="grid grid-cols-2 gap-2.5 mb-6">
    <div
      className="rounded-2xl p-3.5 flex items-center gap-2.5"
      style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)' }}
    >
      <div
        className="w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0"
        style={{ background: 'rgba(34,197,94,0.15)', color: '#4ade80' }}
      >
        <Star className="h-[18px] w-[18px]" />
      </div>
      <div>
        <p className="text-caption uppercase tracking-wider font-bold mb-0.5" style={{ color: '#4ade80' }}>
          Ponto forte
        </p>
        <p className="text-body font-semibold" style={{ color: 'rgba(255,255,255,0.9)' }}>
          {bestArea.area}
        </p>
        <p className="text-caption" style={{ color: 'rgba(255,255,255,0.4)' }}>
          {bestArea.correct}/{bestArea.questions} · {bestArea.score}%
        </p>
      </div>
    </div>
    <div
      className="rounded-2xl p-3.5 flex items-center gap-2.5"
      style={{ background: 'rgba(251,146,60,0.08)', border: '1px solid rgba(251,146,60,0.2)' }}
    >
      <div
        className="w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0"
        style={{ background: 'rgba(251,146,60,0.15)', color: '#fb923c' }}
      >
        <TrendingDown className="h-[18px] w-[18px]" />
      </div>
      <div>
        <p className="text-caption uppercase tracking-wider font-bold mb-0.5" style={{ color: '#fb923c' }}>
          Oportunidade
        </p>
        <p className="text-body font-semibold" style={{ color: 'rgba(255,255,255,0.9)' }}>
          {worstArea.area}
        </p>
        <p className="text-caption" style={{ color: 'rgba(255,255,255,0.4)' }}>
          {worstArea.correct}/{worstArea.questions} · {worstArea.score}%
        </p>
      </div>
    </div>
  </div>
)}
```

Atualize o import do lucide-react — troque `Target` e `Clock` por `MinusCircle` e `ClipboardCheck`:

```tsx
import {
  Trophy, CheckCircle2, XCircle, MinusCircle, ClipboardCheck,
  BarChart3, FileText, ArrowLeft, Star, TrendingDown,
} from 'lucide-react';
```

Remova o bloco antigo de highlights fora do hero (o `{byArea.length > 1 && ...}` que ainda existir fora do card).

- [ ] **Step 4: Rodar os testes**

```bash
cd "c:/Users/Felipe Souza/Documents/enamed-arena" && npx vitest run src/pages/ResultadoPage.test.tsx 2>&1 | tail -15
```

Esperado: 6 testes passando.

- [ ] **Step 5: Commit**

```bash
cd "c:/Users/Felipe Souza/Documents/enamed-arena" && git add src/pages/ResultadoPage.tsx src/pages/ResultadoPage.test.tsx && git commit -m "feat(resultado): stat cards dark e highlights dentro do hero"
```

---

## Task 4: CTA perolado + remoção de SimuladoResultNav + cleanup

**Files:**
- Modify: `src/pages/ResultadoPage.tsx`
- Modify: `src/pages/ResultadoPage.test.tsx`

- [ ] **Step 1: Adicionar teste que falha**

Adicione ao test file:

```tsx
describe('ResultadoPage — CTA', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('exibe link "Ir para correção comentada" apontando para /correcao', () => {
    renderPage()
    const cta = screen.getByRole('link', { name: /ir para correção comentada/i })
    expect(cta).toBeTruthy()
    expect((cta as HTMLAnchorElement).href).toContain('/correcao')
  })
})
```

- [ ] **Step 2: Rodar para ver falhar**

```bash
cd "c:/Users/Felipe Souza/Documents/enamed-arena" && npx vitest run src/pages/ResultadoPage.test.tsx 2>&1 | tail -15
```

Esperado: o teste do CTA falha.

- [ ] **Step 3: Adicionar o CTA perolado dentro do hero e remover SimuladoResultNav**

Imediatamente após o bloco de highlights (ainda dentro de `div.relative.z-10`), adicione a faixa do CTA:

```tsx
{/* CTA perolado */}
<div
  className="rounded-b-3xl -mx-7 -mb-7 px-7 pb-7 pt-5"
  style={{
    background: 'rgba(0,0,0,0.2)',
    borderTop: '1px solid rgba(255,255,255,0.06)',
  }}
>
  <p className="text-caption text-center mb-3" style={{ color: 'rgba(255,255,255,0.3)' }}>
    Pronto para conferir questão por questão?
  </p>
  <Link
    to={`/simulados/${id}/correcao`}
    className="relative flex items-center justify-center gap-2.5 w-full py-[17px] px-6 rounded-2xl overflow-hidden font-bold text-body"
    style={{
      background: 'linear-gradient(135deg, rgba(255,255,255,0.18) 0%, rgba(255,220,230,0.08) 30%, rgba(255,255,255,0.05) 50%, rgba(230,200,215,0.12) 70%, rgba(255,255,255,0.2) 100%), linear-gradient(to bottom, rgba(255,255,255,0.95) 0%, #f0e4ea 100%)',
      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.6), inset 0 -1px 0 rgba(180,140,155,0.3), 0 10px 32px -8px rgba(255,255,255,0.3), 0 4px 12px -4px rgba(0,0,0,0.35)',
      color: '#4a0e22',
    }}
  >
    {/* shimmer sweep */}
    <motion.span
      className="absolute inset-y-0 left-0 w-1/2 pointer-events-none -skew-x-12"
      style={{ background: 'linear-gradient(to right, transparent, rgba(255,255,255,0.4), transparent)' }}
      animate={prefersReducedMotion ? {} : { x: ['-100%', '300%'] }}
      transition={{ duration: 3.5, repeat: Infinity, repeatDelay: 1, ease: 'easeInOut' }}
      aria-hidden
    />
    {/* top gloss */}
    <span
      className="absolute inset-x-0 top-0 h-1/2 pointer-events-none rounded-t-2xl"
      style={{ background: 'linear-gradient(to bottom, rgba(255,255,255,0.35), transparent)' }}
      aria-hidden
    />
    <BookOpen className="h-5 w-5 relative z-10" aria-hidden />
    <span className="relative z-10">Ir para correção comentada</span>
    <ArrowRight className="h-[18px] w-[18px] relative z-10 ml-auto opacity-50" aria-hidden />
  </Link>
</div>
```

Adicione `BookOpen` e `ArrowRight` ao import lucide (e remova `ArrowLeft` se não for mais usado nas empty states — verifique primeiro; ele é usado nas empty states, então mantenha):

```tsx
import {
  Trophy, CheckCircle2, XCircle, MinusCircle, ClipboardCheck,
  BarChart3, FileText, ArrowLeft, ArrowRight, BookOpen, Star, TrendingDown,
} from 'lucide-react';
```

Remova o import e uso de `SimuladoResultNav`. Localize:
```tsx
import { SimuladoResultNav } from '@/components/simulado/SimuladoResultNav';
```
Delete essa linha.

Localize e delete o JSX:
```tsx
{id && <SimuladoResultNav simuladoId={id} variant={adminPreview ? 'admin' : 'public'} />}
```

Remova também `PremiumCard` do import (não é mais usado) e verifique se `useMemo` ainda é usado — se não estiver, remova-o também do import do React.

- [ ] **Step 4: Rodar todos os testes**

```bash
cd "c:/Users/Felipe Souza/Documents/enamed-arena" && npx vitest run src/pages/ResultadoPage.test.tsx 2>&1 | tail -15
```

Esperado: 7 testes passando.

- [ ] **Step 5: Rodar o build**

```bash
cd "c:/Users/Felipe Souza/Documents/enamed-arena" && npm run build 2>&1 | tail -10
```

Esperado: `built in Xs` sem erros TypeScript.

- [ ] **Step 6: Rodar suite completa**

```bash
cd "c:/Users/Felipe Souza/Documents/enamed-arena" && npm run test 2>&1 | tail -8
```

Esperado: todos os testes passando.

- [ ] **Step 7: Commit**

```bash
cd "c:/Users/Felipe Souza/Documents/enamed-arena" && git add src/pages/ResultadoPage.tsx src/pages/ResultadoPage.test.tsx && git commit -m "feat(resultado): CTA perolado e remoção de SimuladoResultNav"
```

---

## Checklist de verificação visual (manual)

Após implementação, verificar no browser:
- [ ] Fundo wine escuro cobre toda a largura do card
- [ ] Ring anima de 0% até o score real ao carregar
- [ ] Stat cards mostram cores corretas (verde/vermelho/cinza/azul)
- [ ] Highlights aparecem apenas quando `byArea.length > 1`
- [ ] CTA shimmer anima em loop suave
- [ ] Hover no CTA aumenta levemente o brilho
- [ ] Em mobile, `grid-cols-4` dos stats não quebra (verificar min-width)
- [ ] `UpgradeBanner` aparece abaixo do hero para não-PRO
- [ ] Link "Comparativo" aparece para Standard/PRO
