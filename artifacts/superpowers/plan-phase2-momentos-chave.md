# Plano de Implementação — Fase 2: Momentos Chave

**Data:** 2026-04-04
**Ref:** brainstorm-simulado-experience-redesign.md
**Pré-requisito:** Fase 1 concluída (tokens exam-*, header unificado, alternativas, crossfade, timer)
**Objetivo:** Completar o arco emocional — preparação, entrada, revisão, finalização premium.

---

## Visão geral

A Fase 2 adiciona os momentos que transformam o fluxo de "funcional" para "memorável": tela de preparação, transição cinematográfica de entrada, modal de finalização premium, navegador reimaginado, e mobile elevado.

**Resultado esperado:** O fluxo tem um arco emocional completo — do briefing à celebração — e cada momento de transição reforça a percepção de excelência.

---

## Step 1 — Pre-flight / Tela de Preparação (`SimuladoExamPage.tsx`)

### Conceito
Antes de iniciar o timer e mostrar a primeira questão, exibir uma tela de briefing dentro da rota `/prova`. Essa tela aparece após o attempt ser criado/retomado, mas antes do estudante confirmar que quer começar.

### Lógica

Adicionar um estado `preFlightDismissed` ao `SimuladoExamPage`:
- Se `flow.state.status === 'in_progress'` e `flow.state.currentQuestionIndex > 0` → pular pre-flight (retomada)
- Se é um attempt novo ou `currentQuestionIndex === 0` e timer não iniciou → mostrar pre-flight
- Ao clicar "Começar agora" → `setPreFlightDismissed(true)`, timer começa a contar

### Problema: o timer já está rodando
O timer começa a rodar no init do attempt (`effectiveDeadline` é definido no `initializeState`). A pre-flight screen não pode atrasar o deadline — seria injusto.

### Solução pragmática
A pre-flight é um overlay visual sobre a prova já carregada. O timer já está rodando por baixo. A tela de preparação mostra:
- Nome do simulado (tipografia display)
- `{questionsCount} questões · {estimatedDuration}`
- Timer já visível (o estudante vê que já está contando)
- "O cronômetro já está ativo."
- CTA: "Começar" (primário, grande)

O objetivo não é atrasar — é dar um momento de respiração e framing.

### Implementação

Em `SimuladoExamPage.tsx`, adicionar estado:
```tsx
const [preFlightDismissed, setPreFlightDismissed] = useState(false);
```

Lógica para mostrar ou não:
```tsx
const showPreFlight = !preFlightDismissed
  && flow.state?.status === 'in_progress'
  && flow.currentIndex === 0
  && flow.summary.answered === 0;
```

Se `showPreFlight`, renderizar overlay em vez do conteúdo da prova:
```tsx
{showPreFlight ? (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    className="flex-1 flex items-center justify-center p-6"
  >
    <div className="text-center max-w-md">
      <h1 className="text-heading-1 text-foreground mb-2">{flow.simulado.title}</h1>
      <div className="flex items-center justify-center gap-4 text-body text-muted-foreground mb-6">
        <span>{flow.questions.length} questões</span>
        <span className="w-1 h-1 rounded-full bg-muted-foreground/30" />
        <span>{flow.simulado.estimatedDuration}</span>
      </div>

      <div className={cn(
        'inline-flex items-center gap-1.5 px-4 py-2 rounded-lg font-mono text-body-lg tabular-nums font-semibold mb-6',
        getTimerBgClass(flow.timeRemaining),
        getTimerColor(flow.timeRemaining),
      )}>
        <Clock className="h-4 w-4" />
        {formatTimer(flow.timeRemaining)}
      </div>

      <p className="text-body-sm text-muted-foreground mb-8">
        O cronômetro já está ativo. Boa prova!
      </p>

      <button
        onClick={() => setPreFlightDismissed(true)}
        className="inline-flex items-center gap-2 px-10 py-4 rounded-xl bg-primary text-primary-foreground text-body-lg font-semibold hover:bg-wine-hover transition-colors shadow-sm hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        Começar
      </button>
    </div>
  </motion.div>
) : (
  // ... conteúdo normal da prova
)}
```

O `ExamHeader` permanece visível mesmo durante o pre-flight (o estudante vê o timer e o título).

### Verificação
- Primeira vez na prova: pre-flight aparece com dados do simulado
- Timer visível e rodando
- Ao clicar "Começar": transição suave para primeira questão
- Retomada (já respondeu questões): pre-flight NÃO aparece, vai direto para a questão

---

## Step 2 — Transição Cinematográfica de Entrada (`SimuladoExamPage.tsx`)

### Conceito
Quando o pre-flight é dismissado, o conteúdo da prova aparece com uma animação de reveal staggered (600ms total).

### Implementação

Ao sair do pre-flight, usar `AnimatePresence mode="wait"` para transicionar:

```tsx
<AnimatePresence mode="wait">
  {showPreFlight ? (
    <motion.div key="preflight" exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
      {/* pre-flight content */}
    </motion.div>
  ) : (
    <motion.div
      key="exam"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
    >
      {/* exam content: main + sidebar */}
    </motion.div>
  )}
</AnimatePresence>
```

O easing `[0.16, 1, 0.3, 1]` é easeOutExpo — rápido no início, desacelera suavemente. Comunica "aparição" sem dramaticidade excessiva.

### Verificação
- Transição do pre-flight para prova: fade suave de 400ms
- Sem "pulo" ou layout shift
- `prefers-reduced-motion`: transição instantânea

---

## Step 3 — Modal de Finalização Premium (`SubmitConfirmModal.tsx`)

### Conceito
Elevar visualmente o modal de finalização para comunicar gravidade proporcional ao momento.

### Mudanças

**Overlay do Dialog:** Garantir blur forte no overlay
```tsx
// Em DialogContent, ajustar ou no parent Dialog
// O shadcn Dialog já tem overlay. Verificar se o blur é suficiente.
// Se necessário, ajustar em src/components/ui/dialog.tsx:
// overlay className: "bg-foreground/40 backdrop-blur-sm" → "bg-foreground/50 backdrop-blur-md"
```

**Ícone hero:** Maior e mais expressivo
```tsx
// ANTES
<div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
  <CheckCircle2 className="h-7 w-7 text-primary" aria-hidden />
</div>

// DEPOIS
<div className="h-16 w-16 rounded-2xl bg-primary/8 flex items-center justify-center mx-auto mb-5">
  <CheckCircle2 className="h-8 w-8 text-primary" aria-hidden />
</div>
```

**Grid de métricas:** Elevar com border sutil
```tsx
// ANTES: bg-muted/50
// DEPOIS: bg-[hsl(var(--exam-surface))] border border-[hsl(var(--exam-border))]
```

**Botão "Finalizar":** Mais peso visual
```tsx
// ANTES: flex-1 (divide espaço igualmente com "Continuar respondendo")
// DEPOIS: "Continuar respondendo" como link/text, "Finalizar" como botão primário full-width

// Nova estrutura:
<div className="space-y-3">
  <button
    type="button"
    onClick={onConfirm}
    disabled={submitting}
    className="w-full min-h-[48px] px-6 py-3.5 rounded-xl bg-primary text-primary-foreground text-body font-semibold hover:bg-wine-hover transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
  >
    {submitting ? '...' : 'Finalizar prova'}
  </button>
  <button
    type="button"
    onClick={onCancel}
    disabled={submitting}
    className="w-full py-2.5 text-body text-muted-foreground hover:text-foreground transition-colors"
  >
    Continuar respondendo
  </button>
</div>
```

### Verificação
- Modal mais impactante visualmente
- "Finalizar prova" tem presença dominante
- "Continuar respondendo" é acessível mas não compete visualmente
- Questões em branco: números clicáveis continuam funcionando

---

## Step 4 — Navegador de Questões Reimaginado (`QuestionNavigator.tsx`)

### Conceito
Elevar o grid visual com melhor tratamento de estados e maior legibilidade para 50+ questões.

### Mudanças

**Grid:** Tamanho dos botões aumentado, gap ligeiramente maior
```tsx
// ANTES
<div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>

// DEPOIS
<div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
```

**Botões:** Mais expressivos visualmente
```tsx
// ANTES
'relative h-8 w-full rounded-md text-[11px] font-semibold transition-all duration-150'

// DEPOIS
'relative h-9 w-full rounded-lg text-[12px] font-semibold transition-all duration-150'
```

**Estado da questão atual:** Ring mais premium
```tsx
// ANTES
isCurrent && 'ring-2 ring-primary ring-offset-2'

// DEPOIS  
isCurrent && 'ring-2 ring-primary ring-offset-2 bg-primary/10 text-primary'
```

**Respondida:** Background mais diferenciado
```tsx
// ANTES: bg-accent text-accent-foreground
// DEPOIS: bg-primary/8 text-foreground — sutil wine tint em vez de accent genérico
```

**Não respondida:** Mais discreta
```tsx
// ANTES: bg-muted/60 text-muted-foreground hover:bg-muted
// DEPOIS: bg-muted/40 text-muted-foreground/70 hover:bg-muted/60
```

### Verificação
- Grid mais legível, especialmente com 50+ questões
- Estado "atual" é imediatamente identificável
- "Respondida" vs "não respondida" tem contraste claro
- Review e alta certeza mantêm indicadores no canto

---

## Step 5 — Sidebar da Prova Elevada (`SimuladoExamPage.tsx`)

### Conceito
A sidebar desktop deve ter tratamento visual alinhado com o exam mode.

### Mudanças

**Container da sidebar:**
```tsx
// ANTES
<aside className="hidden md:flex w-64 border-l border-border bg-card p-4 flex-col gap-4 overflow-y-auto">

// DEPOIS
<aside className="hidden md:flex w-60 border-l border-[hsl(var(--exam-border))] p-5 flex-col gap-4 overflow-y-auto">
```
Nota: remove `bg-card` — herda o `exam-bg` do parent. A sidebar vive no mesmo ambiente, separada apenas pela border.

**Header da sidebar:** Mais limpo
```tsx
// ANTES
<p className="text-body font-semibold text-foreground mb-1">Navegação</p>
<p className="text-caption text-muted-foreground mb-3">
  {summary.answered}/{summary.total} respondidas
</p>

// DEPOIS
<div className="flex items-baseline justify-between mb-3">
  <p className="text-body-sm font-semibold text-foreground">Questões</p>
  <p className="text-caption text-muted-foreground tabular-nums">
    {summary.answered}/{summary.total}
  </p>
</div>
```

**Legenda:** Mais compacta
```tsx
// Manter legenda mas com menos espaço:
<div className="mt-auto flex flex-wrap gap-x-4 gap-y-1.5 text-[10px] text-muted-foreground pt-4 border-t border-[hsl(var(--exam-border))]">
  <span className="flex items-center gap-1.5">
    <span className="h-2.5 w-2.5 rounded-sm bg-primary/10" /> Respondida
  </span>
  <span className="flex items-center gap-1.5">
    <span className="h-2.5 w-2.5 rounded-sm bg-info/20" /> Revisão
  </span>
  <span className="flex items-center gap-1.5">
    <span className="h-2.5 w-2.5 rounded-sm bg-success/20" /> Certeza
  </span>
</div>
```

### Verificação
- Sidebar visualmente integrada ao ambiente de prova
- Sem bg-card que destoa do exam-bg
- Legenda compacta e informativa

---

## Step 6 — Mobile Sheet Navigator Elevado (`SimuladoExamPage.tsx`)

### Conceito
O sheet (drawer) mobile para navegação deve ter o mesmo tratamento visual do exam mode.

### Mudanças no AnimatePresence do navigator (~317-358)

**Overlay:** Mais imersivo
```tsx
// ANTES: bg-foreground/40 backdrop-blur-sm
// DEPOIS: bg-foreground/50 backdrop-blur-md
```

**Sheet:**
```tsx
// ANTES: bg-card rounded-t-2xl border-t border-border
// DEPOIS: rounded-t-2xl border-t border-[hsl(var(--exam-border))]
// + style={{ backgroundColor: 'hsl(var(--exam-header-bg))', backdropFilter: 'blur(16px)' }}
```

**Handle bar:**
```tsx
// ANTES: w-10 h-1 rounded-full bg-muted
// DEPOIS: w-8 h-1 rounded-full bg-muted-foreground/20
```

**Botão "Finalizar" no sheet:** Trocar de destrutivo para primário
```tsx
// ANTES: bg-primary ... "Finalizar simulado"
// DEPOIS: manter bg-primary mas com label "Encerrar prova" (consistente com header)
```

### Verificação
- Sheet mobile: visual translúcido premium
- Coerente com header e navbar
- Handle bar sutil
- Funcionalidade intacta

---

## Step 7 — Botões de Ação e Flags Elevados (`SimuladoExamPage.tsx`)

### Conceito
Os botões de marcação (revisão, alta certeza) e navegação (anterior, próxima) precisam de refinamento visual.

### Mudanças nos botões de flag (~217-246)

**Texto de ajuda:** Reformatar
```tsx
// ANTES: <p className="mt-1.5 text-[10px] text-muted-foreground/60 ...">
// DEPOIS: remover o texto de ajuda explícito — os tooltips no header já cobrem.
// Se quiser manter, simplificar para uma única linha mais discreta:
<p className="mt-2 text-[10px] text-muted-foreground/40">
  R = revisar · H = certeza
</p>
```

### Navegação inferior (~248-282)

**Botão "Anterior":** Mais discreto quando desabilitado
```tsx
// ANTES: disabled:opacity-40
// DEPOIS: disabled:opacity-30 disabled:pointer-events-none
```

**Botão no último questão:** Label consistente
```tsx
// ANTES: <Send className="h-4 w-4" /> Finalizar
// DEPOIS: Encerrar prova (sem ícone Send — consistente com header)
```

### Verificação
- Flags de revisão/certeza: limpos, sem excesso de texto
- Navegação: botões consistentes com linguagem do header
- "Encerrar prova" em vez de "Finalizar" em todos os touchpoints

---

## Resumo de arquivos editados

| # | Arquivo | Tipo de mudança |
|---|---------|----------------|
| 1 | `src/pages/SimuladoExamPage.tsx` | Pre-flight, transição, sidebar, sheet, mobile nav, flags, navegação |
| 2 | `src/components/exam/SubmitConfirmModal.tsx` | Layout premium, hierarquia de botões |
| 3 | `src/components/exam/QuestionNavigator.tsx` | Grid elevado, estados visuais |
| 4 | `src/components/ui/dialog.tsx` | Overlay blur (se necessário) |

## Verificação final da Fase 2

```bash
npm run build
npm run lint
npm run test
```

### Checklist visual (manual)
- [ ] Pre-flight aparece na primeira entrada, NÃO na retomada
- [ ] Transição pre-flight → prova é suave (400ms fade)
- [ ] Modal de finalização tem gravidade visual proporcional
- [ ] Navegador de questões é legível com 50+ questões
- [ ] Sidebar sem bg-card, integrada ao exam-bg
- [ ] Sheet mobile translúcido e premium
- [ ] Labels consistentes: "Encerrar prova" em todos os touchpoints
- [ ] Dark mode: tudo adapta

### Critérios de aceitação
1. O pre-flight dá ao estudante um momento de respiração antes de começar
2. A transição para a prova comunica mudança de contexto
3. O modal de finalização faz o estudante pensar antes de confirmar
4. O navegador é usável e bonito mesmo com muitas questões
5. Toda a linguagem é consistente entre header, botões, modal e sheet
