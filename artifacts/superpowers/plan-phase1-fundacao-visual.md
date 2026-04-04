# Plano de Implementação — Fase 1: Fundação Visual

**Data:** 2026-04-04
**Ref:** brainstorm-simulado-experience-redesign.md
**Objetivo:** Transformar o ambiente de prova em uma experiência visualmente premium e focada.

---

## Visão geral

A Fase 1 é puramente visual e de interação. Nenhum hook de negócio novo, nenhum componente novo. Apenas edição cirúrgica dos arquivos existentes para elevar drasticamente a percepção de qualidade.

**Resultado esperado:** O estudante entra na prova e sente que o ambiente é completamente diferente do resto da plataforma — mais focado, mais sofisticado, mais premium.

---

## Step 1 — Tokens de Focus Mode (`src/index.css`)

### O que fazer
Adicionar variáveis CSS para o "modo prova" dentro do `:root` e `.dark`, criando uma sub-paleta de foco.

### Tokens a adicionar em `:root`
```css
/* Exam focus mode */
--exam-bg: 210 15% 97.5%;
--exam-surface: 0 0% 100%;
--exam-surface-hover: 210 10% 95%;
--exam-border: 210 10% 90%;
--exam-border-selected: var(--primary);
--exam-text: 210 20% 15%;
--exam-text-secondary: 210 10% 45%;
--exam-header-bg: 0 0% 100% / 0.92;
--exam-option-selected-bg: 345 65% 30% / 0.04;
--exam-shadow-selected: 0 2px 8px -2px hsl(345 65% 30% / 0.08);
```

### Tokens a adicionar em `.dark`
```css
--exam-bg: 220 18% 7%;
--exam-surface: 220 16% 11%;
--exam-surface-hover: 220 14% 14%;
--exam-border: 220 14% 16%;
--exam-border-selected: var(--primary);
--exam-text: 210 10% 92%;
--exam-text-secondary: 210 8% 55%;
--exam-header-bg: 220 18% 8% / 0.92;
--exam-option-selected-bg: 345 55% 50% / 0.06;
--exam-shadow-selected: 0 2px 8px -2px hsl(345 55% 50% / 0.12);
```

### Utilitários a adicionar em `@layer utilities`
```css
.exam-bg { background-color: hsl(var(--exam-bg)); }
.exam-surface { background-color: hsl(var(--exam-surface)); }
```

### Verificação
- `npm run build` — sem erros
- Tokens disponíveis via DevTools em `:root`

---

## Step 2 — Atmosfera do ambiente de prova (`SimuladoExamPage.tsx`)

### O que mudar
O container raiz muda de `bg-background` para `exam-bg`. Isso aplica o tom frio sutil que separa o ambiente de prova do dashboard.

### Mudança exata

**Linha ~166:** Trocar `bg-background` por `exam-bg`
```tsx
// ANTES
<div className="h-screen flex flex-col bg-background">

// DEPOIS
<div className="h-screen flex flex-col exam-bg">
```

**Sidebar (~286):** Trocar `bg-card` por `exam-surface`
```tsx
// ANTES
<aside className="hidden md:flex w-64 border-l border-border bg-card p-4 flex-col gap-4 overflow-y-auto">

// DEPOIS
<aside className="hidden md:flex w-64 border-l border-[hsl(var(--exam-border))] bg-[hsl(var(--exam-surface))] p-4 flex-col gap-4 overflow-y-auto">
```

**Barra de progresso secundária (~192-204):** REMOVER a barra duplicada abaixo do header. O header já tem progresso.
```tsx
// REMOVER INTEIRO este bloco:
<div className="px-4 md:px-6 py-2 bg-muted/30 border-b border-border">
  <div className="flex items-center gap-3">
    ...
  </div>
</div>
```

**Loading state (~104-139):** Substituir skeleton genérico por loading contextual
```tsx
// ANTES: barras pulsantes genéricas
// DEPOIS: tela com exam-bg, indicador central com nome do simulado (se disponível)
<div className="h-screen flex flex-col items-center justify-center exam-bg">
  <div className="text-center">
    <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
      <div className="h-5 w-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
    </div>
    <p className="text-body text-muted-foreground">Preparando sua prova...</p>
  </div>
</div>
```

### Verificação
- Dev server: fundo da prova é visivelmente mais frio/neutro que o dashboard
- Dark mode: fundo adapta corretamente
- A barra de progresso duplicada desapareceu

---

## Step 3 — Header Unificado (`ExamHeader.tsx`)

### O que mudar
Redesenhar o header para: translúcido premium, sem botão "Finalizar" destrutivo, progresso integrado, timer elegante, save indicator real.

### Mudança completa do componente

```tsx
import { formatTimer, getTimerColor, getTimerBgClass } from '@/hooks/useExamTimer';
import { cn } from '@/lib/utils';
import { Clock, Check, Keyboard, MoreHorizontal } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface ExamHeaderProps {
  title: string;
  currentQuestion: number;
  totalQuestions: number;
  timeRemaining: number;
  onFinalize: () => void;
  saving?: boolean;
}

export function ExamHeader({
  title, currentQuestion, totalQuestions, timeRemaining, onFinalize, saving = false,
}: ExamHeaderProps) {
  return (
    <header className="sticky top-0 z-40 border-b border-[hsl(var(--exam-border))]"
      style={{ backgroundColor: 'hsl(var(--exam-header-bg))', backdropFilter: 'blur(12px)' }}
    >
      <div className="flex items-center justify-between px-4 md:px-6 h-14">
        {/* Left: title + save indicator */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="min-w-0 hidden sm:flex items-center gap-2">
            <p className="text-body font-semibold text-foreground truncate max-w-[200px] lg:max-w-none">{title}</p>
            <span className={cn(
              'flex items-center gap-1 text-[10px] transition-opacity duration-300',
              saving ? 'text-primary opacity-100' : 'text-muted-foreground/50 opacity-100',
            )}>
              <Check className={cn('h-3 w-3', saving && 'animate-pulse')} />
              {saving ? 'Salvando' : 'Salvo'}
            </span>
          </div>
        </div>

        {/* Center: question counter */}
        <div className="flex items-center gap-2">
          <span className="text-body-sm font-semibold text-foreground tabular-nums">
            {currentQuestion}
          </span>
          <span className="text-caption text-muted-foreground">/</span>
          <span className="text-body-sm text-muted-foreground tabular-nums">
            {totalQuestions}
          </span>
        </div>

        {/* Right: shortcuts + timer + finalize */}
        <div className="flex items-center gap-2 md:gap-3">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <button className="hidden md:flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors">
                  <Keyboard className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-xs">
                <div className="space-y-2 text-sm">
                  <p className="font-semibold text-foreground">Atalhos de Teclado</p>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-caption">
                    <span><kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px] font-mono">1-5</kbd> Alternativas</span>
                    <span><kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px] font-mono">← →</kbd> Navegação</span>
                    <span><kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px] font-mono">R</kbd> Marcar p/ revisar</span>
                    <span><kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px] font-mono">H</kbd> Alta certeza</span>
                    <span><kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px] font-mono">Esc</kbd> Finalizar</span>
                  </div>
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {/* Timer */}
          <div
            role="timer"
            aria-label={`Tempo restante: ${formatTimer(timeRemaining)}`}
            aria-live={timeRemaining < 120 ? 'polite' : 'off'}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-mono text-body tabular-nums font-semibold transition-colors duration-500',
              getTimerBgClass(timeRemaining),
              getTimerColor(timeRemaining),
            )}
          >
            <Clock className="h-3.5 w-3.5" aria-hidden />
            {formatTimer(timeRemaining)}
          </div>

          {/* Finalize — secondary, not destructive */}
          <button
            onClick={onFinalize}
            className="px-3 md:px-4 py-1.5 rounded-lg border border-border bg-card text-body font-medium text-foreground hover:bg-muted transition-colors"
          >
            Encerrar
          </button>
        </div>
      </div>
    </header>
  );
}
```

### Mudanças-chave
1. **Background:** `bg-card/95 backdrop-blur-sm` → `exam-header-bg + backdrop-blur(12px)` (mais translúcido, blur mais forte)
2. **Barra de progresso no header:** REMOVIDA (substituída por contador textual limpo `23 / 50`)
3. **Save indicator:** Movido para junto do título, com ícone `Check` (não `Save`)
4. **Botão Finalizar:** De `bg-destructive text-white` (vermelho agressivo) para `border border-border bg-card` (secundário, neutro). Label: "Encerrar" em vez de "Finalizar"
5. **Timer:** Remove `animate-pulse` — usa `transition-colors duration-500` para transição suave entre faixas

### Verificação
- Header parece mais limpo, sem botão vermelho permanente
- Timer muda cor suavemente entre faixas
- Save indicator mostra "Salvo" em tom discreto

---

## Step 4 — Timer Escalonado (`useExamTimer.ts`)

### O que mudar
Ajustar as funções `getTimerColor` e `getTimerBgClass` para faixas mais progressivas, sem `animate-pulse`.

```typescript
export function getTimerColor(seconds: number): string {
  if (seconds < 60) return 'text-destructive';
  if (seconds < 300) return 'text-warning';
  if (seconds < 900) return 'text-foreground';
  return 'text-foreground/70';
}

export function getTimerBgClass(seconds: number): string {
  if (seconds < 60) return 'bg-destructive/8';
  if (seconds < 300) return 'bg-warning/8';
  if (seconds < 900) return 'bg-muted/50';
  return 'bg-transparent';
}
```

### Mudanças-chave
1. **Estado normal (> 15min):** `text-foreground/70` + `bg-transparent` — discreto
2. **Atenção (< 15min):** `text-foreground` + `bg-muted/50` — mais presente
3. **Alerta (< 5min):** `text-warning` + `bg-warning/8` — quente
4. **Urgência (< 1min):** `text-destructive` + `bg-destructive/8` — urgente sem pulso
5. Remove faixa intermediária `text-amber-600 dark:text-amber-400` (tokens inconsistentes com design system)

### Onde remover animate-pulse
Em `SimuladoExamPage.tsx`, o header do ExamHeader já não aplica `animate-pulse` (removido no Step 3). Verificar que nenhum outro lugar adiciona pulse ao timer.

### Verificação
- Timer em estado normal: discreto, quase invisível
- Timer < 15min: mais presente
- Timer < 5min: quente mas não agressivo
- Timer < 1min: vermelho sem pulsação

---

## Step 5 — Alternativas Redesenhadas (`QuestionDisplay.tsx`)

### O que mudar
Retirar border visual do estado neutro. Melhorar feedback de seleção. Elevar tipografia.

### Mudanças exatas

**Número da questão (L33-35):**
```tsx
// ANTES
<p className="text-overline uppercase text-muted-foreground mb-2">
  Questão {question.number}
</p>

// DEPOIS
<p className="text-body font-bold text-primary tracking-tight mb-2">
  Questão {question.number}
</p>
```

**Texto da questão (L36-38):**
```tsx
// ANTES
<p className="text-body-lg text-foreground leading-relaxed whitespace-pre-line">

// DEPOIS
<p className="text-[17px] leading-[1.75] text-[hsl(var(--exam-text))] whitespace-pre-line">
```

**Alternativas — container principal (L93-111):**
```tsx
// ANTES
className={cn(
  'w-full text-left p-4 rounded-xl border-2 transition-all duration-200',
  'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1',
  'active:scale-[0.995]',
  isSelected
    ? 'border-primary bg-primary/5 shadow-md ring-2 ring-primary/20'
    : isEliminated
      ? 'border-border bg-muted/20 opacity-40'
      : 'border-border bg-card hover:border-primary/40 hover:bg-muted/30',
)}

// DEPOIS
className={cn(
  'w-full text-left p-4 rounded-xl transition-all duration-150',
  'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1',
  isSelected
    ? 'border-2 border-primary bg-[hsl(var(--exam-option-selected-bg))] shadow-[var(--exam-shadow-selected)]'
    : isEliminated
      ? 'border border-transparent bg-muted/15 opacity-35'
      : 'border border-transparent bg-[hsl(var(--exam-surface))] hover:bg-[hsl(var(--exam-surface-hover))]',
)}
```

**Badge da letra (L114-121):**
```tsx
// ANTES
className={cn(
  'flex-shrink-0 h-7 w-7 rounded-full flex items-center justify-center text-caption font-bold transition-colors',
  isSelected
    ? 'bg-primary text-primary-foreground'
    : 'bg-muted text-muted-foreground',
)}

// DEPOIS
className={cn(
  'flex-shrink-0 h-7 w-7 rounded-full flex items-center justify-center font-mono text-[13px] font-semibold transition-all duration-150',
  isSelected
    ? 'bg-primary text-primary-foreground scale-105'
    : 'bg-muted/60 text-muted-foreground',
)}
```

**Texto da alternativa (L124-129):**
```tsx
// ANTES
<span className={cn(
  'text-body text-foreground pt-0.5',
  isEliminated && 'line-through',
)}>

// DEPOIS
<span className={cn(
  'text-[15px] leading-[1.6] text-[hsl(var(--exam-text))] pt-0.5',
  isEliminated && 'line-through text-muted-foreground',
)}>
```

### Mudanças-chave
1. **Estado neutro:** `border-2 border-border` → `border border-transparent bg-exam-surface` — sem borda visível, clean
2. **Hover neutro:** `hover:border-primary/40` → `hover:bg-exam-surface-hover` — sutil, sem borda
3. **Selecionada:** `border-2 border-primary` (mantém), `bg-exam-option-selected-bg` + shadow personalizada
4. **Eliminada:** `opacity-40` → `opacity-35` + `bg-muted/15` (mais dessaturada)
5. **Badge:** Adiciona `scale-105` quando selecionado (micro feedback de 150ms via transition)
6. **Tipografia:** Questão em 17px/1.75, alternativas em 15px/1.6 — hierarquia clara

### Verificação
- Alternativas em estado neutro: sem borda visível, fundo sutil
- Hover: sutil highlight de fundo
- Seleção: feedback forte mas elegante — borda wine, fundo tintado, badge escala
- Eliminada: claramente apagada sem ser agressiva

---

## Step 6 — Crossfade entre questões (`SimuladoExamPage.tsx`)

### O que mudar
Adicionar AnimatePresence + motion.div no QuestionDisplay para crossfade de 150ms ao mudar de questão.

### Mudança exata no main area (~208-215)

```tsx
// ANTES
<QuestionDisplay
  question={flow.currentQuestion}
  answer={flow.currentAnswer}
  onSelectOption={flow.handleSelectOption}
  onEliminateOption={flow.handleEliminateOption}
/>

// DEPOIS
<AnimatePresence mode="wait">
  <motion.div
    key={flow.currentQuestion.id}
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    transition={{ duration: 0.15 }}
  >
    <QuestionDisplay
      question={flow.currentQuestion}
      answer={flow.currentAnswer}
      onSelectOption={flow.handleSelectOption}
      onEliminateOption={flow.handleEliminateOption}
    />
  </motion.div>
</AnimatePresence>
```

### Remover animação interna do QuestionDisplay
Em `QuestionDisplay.tsx` (L20), remover a classe `animate-fade-in` do container raiz (agora a animação é controlada pelo parent):
```tsx
// ANTES
<div className="animate-fade-in">

// DEPOIS
<div>
```

### Verificação
- Ao navegar entre questões: crossfade suave de 150ms
- Sem "flash" ou "pulo" visual
- `prefers-reduced-motion`: o framer motion já respeita globalmente

---

## Step 7 — Tela de Conclusão Elevada (`ExamCompletedScreen.tsx`)

### O que mudar
Redesenhar para momento de conquista: tipografia mais forte, animação staggered, storytelling de resumo, hierarquia de ações.

### Mudança completa do componente

Substituir o conteúdo inteiro. As props e interface permanecem idênticas.

**Mudanças-chave:**
1. **Título:** De "Prova entregue!" para "Prova concluída" com tipografia `text-heading-1` + nome do simulado em destaque
2. **Animação:** Stagger reveal dos elementos (0, 0.1, 0.2, 0.3...) em vez de um único fade-in
3. **Resumo:** Frase narrativa em vez de badges soltos: "Você respondeu 48 de 50 questões. 12 com alta certeza."
4. **Ícone hero:** Maior (h-24 w-24), com animação de escala mais expressiva (0.5 → 1 com spring)
5. **CTA principal:** Full-width, bg-primary, arrowRight — mais presença
6. **Email notification:** Mais discreto, integrado ao card de data
7. **Background:** `exam-bg` em vez de `bg-background` para manter atmosfera
8. **Transição de entrada:** O container principal tem stagger das children via framer motion variants

### Estrutura proposta
```
[Ícone hero animado — grande, expressivo]
[Título: "Prova concluída"]
[Subtítulo: nome do simulado]
[Aviso se fora da janela]
[Resumo narrativo: "Você respondeu X de Y questões..."]
[Card: data de resultado + toggle email integrado]
[CTA principal: Ver resultado/gabarito]
[CTA secundário: Voltar ao calendário]
```

### Verificação
- Ao finalizar a prova: tela de conclusão aparece com stagger elegante
- A sensação é de "conquista", não de "recibo"
- CTA principal tem presença visual forte
- Dark mode: adapta corretamente

---

## Step 8 — MobileQuestionNav Elevado (`SimuladoExamPage.tsx`)

### O que mudar
O componente `MobileQuestionNav` inline precisa de ajustes visuais para ficar mais premium.

### Mudanças
```tsx
// Container: elevar background e border
<div className="md:hidden fixed bottom-0 left-0 right-0 z-30 border-t border-[hsl(var(--exam-border))] px-3 py-2.5"
  style={{ backgroundColor: 'hsl(var(--exam-header-bg))', backdropFilter: 'blur(12px)' }}
>

// Botões: de quadrados 28px para pílulas 32px
className={cn(
  'flex-shrink-0 h-8 min-w-[32px] px-1 rounded-lg text-[11px] font-bold transition-all duration-150',
  'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1',
  isCurrent && 'ring-2 ring-primary ring-offset-1',
  ...
)}
```

### Verificação
- Mobile: nav no bottom tem blur e translucidez igual ao header
- Botões são mais táteis (32px em vez de 28px)
- Visual coerente com o resto do ambiente de prova

---

## Resumo de arquivos editados

| # | Arquivo | Tipo de mudança |
|---|---------|----------------|
| 1 | `src/index.css` | Adicionar tokens exam-* em `:root` e `.dark`, utilitários |
| 2 | `src/pages/SimuladoExamPage.tsx` | Atmosfera, remover barra duplicada, loading, crossfade, MobileNav |
| 3 | `src/components/exam/ExamHeader.tsx` | Rewrite completo: translúcido, sem destructive, timer limpo |
| 4 | `src/hooks/useExamTimer.ts` | Faixas de cor do timer ajustadas |
| 5 | `src/components/exam/QuestionDisplay.tsx` | Alternativas sem border, tipografia, badge |
| 6 | `src/components/exam/ExamCompletedScreen.tsx` | Rewrite: celebração, stagger, storytelling |

## Verificação final da Fase 1

```bash
npm run build          # Zero erros
npm run lint           # Sem novos warnings
npm run test           # Testes existentes passam
```

### Checklist visual (manual)
- [ ] Background da prova é visivelmente diferente do dashboard
- [ ] Header é translúcido, sem botão vermelho, timer discreto
- [ ] Alternativas sem border em estado neutro, feedback de seleção forte
- [ ] Crossfade suave ao navegar entre questões
- [ ] Timer muda cor progressivamente sem animação pulsante
- [ ] Tela de conclusão tem sensação de conquista
- [ ] Dark mode: tudo adapta corretamente
- [ ] Mobile: nav elevada com blur
- [ ] `prefers-reduced-motion`: animações desabilitadas

### Critérios de aceitação
1. O ambiente de prova é visualmente distinguível do dashboard em < 1s
2. Nenhum elemento do header compete por atenção com a questão
3. A seleção de alternativa produz feedback visual satisfatório em < 200ms
4. O timer nunca causa "susto visual" (sem pulse, sem mudança abrupta)
5. A tela de conclusão faz o estudante sentir que completou algo significativo
