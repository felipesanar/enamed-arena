# Plano de Implementação — Fase 3: Completude

**Data:** 2026-04-04
**Ref:** brainstorm-simulado-experience-redesign.md
**Pré-requisito:** Fase 1 e 2 concluídas
**Objetivo:** Polish final — estados especiais, resiliência, acessibilidade, gestos mobile.

---

## Visão geral

A Fase 3 cobre cenários que a maioria das plataformas ignora: offline, retomada, gestos, lightbox, acessibilidade avançada. São os detalhes que separam "bom" de "extraordinário".

**Resultado esperado:** A experiência é robusta em todos os cenários — conexão instável, retomada, mobile puro, acessibilidade — sem perder a qualidade premium.

---

## Step 1 — Swipe entre Questões (Mobile Gesture)

### Conceito
Permitir swipe horizontal no mobile para navegar entre questões, como alternativa aos botões.

### Implementação

Usar `motion.div` com `drag="x"` no container da questão (mobile only):

```tsx
// Apenas no mobile (dentro do <main>), wrapping o QuestionDisplay
// Detectar breakpoint via hook useMediaQuery ou via className md:hidden

<motion.div
  key={flow.currentQuestion.id}
  drag="x"
  dragConstraints={{ left: 0, right: 0 }}
  dragElastic={0.15}
  onDragEnd={(_, info) => {
    if (info.offset.x < -80 && flow.currentIndex < flow.questions.length - 1) {
      flow.handleNext();
    } else if (info.offset.x > 80 && flow.currentIndex > 0) {
      flow.handlePrev();
    }
  }}
  initial={{ opacity: 0 }}
  animate={{ opacity: 1 }}
  exit={{ opacity: 0 }}
  transition={{ duration: 0.15 }}
  className="md:pointer-events-auto"
>
  <QuestionDisplay ... />
</motion.div>
```

### Cuidados
- `dragElastic={0.15}` — pouco elástico para não confundir com scroll vertical
- Threshold de 80px — evita swipes acidentais
- Não deve interferir com scroll vertical do conteúdo da questão
- `prefers-reduced-motion`: desabilitar drag, manter botões

### Verificação
- Mobile: swipe left avança, swipe right volta
- Sem conflito com scroll vertical
- Desktop: sem drag (botões normais)
- Swipe no limites (primeira/última questão): bounce elástico sem ação

---

## Step 2 — Estados de Conectividade (`SimuladoExamPage.tsx`)

### Conceito
Banner não-intrusivo que aparece quando a conexão cai e comunica segurança.

### Implementação

Hook simples `useOnlineStatus`:
```tsx
function useOnlineStatus() {
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);
  return online;
}
```

No `SimuladoExamPage`, abaixo do header:
```tsx
const isOnline = useOnlineStatus();

<AnimatePresence>
  {!isOnline && (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      className="bg-warning/8 border-b border-warning/15 px-4 py-2.5 flex items-center gap-2"
    >
      <WifiOff className="h-3.5 w-3.5 text-warning shrink-0" />
      <p className="text-body-sm text-warning">
        Sem conexão. Suas respostas estão salvas localmente e serão sincronizadas automaticamente.
      </p>
    </motion.div>
  )}
</AnimatePresence>
```

### Verificação
- Desconectar WiFi: banner aparece suavemente
- Reconectar: banner some suavemente
- Tom: informativo (warning), não alarmista (destructive)
- Não bloqueia interação com a prova

---

## Step 3 — Tela de Retomada (`SimuladoExamPage.tsx`)

### Conceito
Quando o estudante retoma uma prova (já respondeu questões), mostrar um briefing rápido de retomada antes de jogar na questão.

### Implementação

Variação do pre-flight para retomadas. Detectar:
```tsx
const isResuming = flow.state?.status === 'in_progress'
  && flow.summary.answered > 0
  && !preFlightDismissed;
```

Se `isResuming`, mostrar tela intermediária:
```tsx
<motion.div className="flex-1 flex items-center justify-center p-6">
  <div className="text-center max-w-md">
    <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
      <Play className="h-7 w-7 text-primary" />
    </div>
    <h1 className="text-heading-2 text-foreground mb-2">Bem-vindo de volta</h1>
    <p className="text-body text-muted-foreground mb-4">
      Você respondeu {flow.summary.answered} de {flow.summary.total} questões.
    </p>
    <div className={cn(
      'inline-flex items-center gap-1.5 px-4 py-2 rounded-lg font-mono text-body tabular-nums font-semibold mb-6',
      getTimerBgClass(flow.timeRemaining),
      getTimerColor(flow.timeRemaining),
    )}>
      <Clock className="h-4 w-4" />
      {formatTimer(flow.timeRemaining)} restantes
    </div>
    <div>
      <button
        onClick={() => setPreFlightDismissed(true)}
        className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl bg-primary text-primary-foreground text-body font-semibold hover:bg-wine-hover transition-colors"
      >
        <Play className="h-4 w-4" />
        Continuar de onde parei
      </button>
    </div>
  </div>
</motion.div>
```

### Verificação
- Retomada: tela mostra progresso anterior e tempo restante
- Primeira vez (nenhuma respondida): pre-flight original (Step 1 da Fase 2)
- Clicar "Continuar": vai direto para a questão onde parou

---

## Step 4 — Lightbox Melhorado (`QuestionDisplay.tsx`)

### Conceito
Elevar o lightbox de imagens com transição de zoom e melhor UX.

### Mudanças

**Imagem principal — hover mais premium:**
```tsx
// ANTES: rounded-xl overflow-hidden border border-border bg-muted/30
// DEPOIS: rounded-xl overflow-hidden border border-[hsl(var(--exam-border))] bg-[hsl(var(--exam-surface))]
```

**Lightbox overlay — usar AnimatePresence:**
```tsx
<AnimatePresence>
  {lightboxOpen && question.imageUrl && (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-[60] bg-foreground/80 backdrop-blur-md flex items-center justify-center p-4"
      onClick={() => setLightboxOpen(false)}
    >
      <motion.img
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
        src={question.imageUrl}
        alt={`Imagem da questão ${question.number}`}
        className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      />
      <button ... />
    </motion.div>
  )}
</AnimatePresence>
```

### Mudanças-chave
1. Backdrop blur mais forte: `backdrop-blur-sm` → `backdrop-blur-md`
2. Imagem com scale transition: 0.9 → 1 em 200ms (efeito zoom-in)
3. AnimatePresence para exit animation
4. Import AnimatePresence (já disponível em QuestionDisplay? Se não, adicionar)

### Verificação
- Clicar imagem: lightbox abre com zoom suave
- Fechar: imagem retrai suavemente
- Blur forte no overlay

---

## Step 5 — Acessibilidade Extra

### 5a — Anúncio de mudança de questão

Adicionar `aria-live` region no `SimuladoExamPage` para anunciar mudanças:
```tsx
<div aria-live="polite" aria-atomic="true" className="sr-only">
  Questão {flow.currentIndex + 1} de {flow.questions.length}
  {flow.currentQuestion.area && ` — ${flow.currentQuestion.area}`}
</div>
```

### 5b — Skip link para alternativas

No `QuestionDisplay`, adicionar skip link visível em focus:
```tsx
<a
  href="#exam-options"
  className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-10 focus:px-3 focus:py-1.5 focus:rounded-lg focus:bg-primary focus:text-primary-foreground focus:text-body-sm"
>
  Pular para alternativas
</a>

// No radiogroup:
<div id="exam-options" className="space-y-3" role="radiogroup" ...>
```

### 5c — Contraste dos estados do timer

Verificar que as cores do timer atendem WCAG AA:
- `text-foreground/70` sobre `bg-transparent` → precisa de pelo menos 4.5:1
- `text-warning` sobre `bg-warning/8` → verificar
- `text-destructive` sobre `bg-destructive/8` → verificar

Se algum falhar, ajustar os tokens.

### 5d — Labels descritivos no navegador

```tsx
// ANTES: aria-label undefined nos botões do QuestionNavigator
// DEPOIS:
aria-label={`Questão ${i + 1}${isAnswered ? ', respondida' : ''}${isReview ? ', marcada para revisão' : ''}`}
```

### Verificação
- Screen reader: anuncia mudança de questão
- Tab: skip link funciona para pular ao radiogroup
- Contraste: todos os estados passam WCAG AA
- Navegador: labels descritivos para cada botão

---

## Step 6 — Tempo Acabando — Notificação Elegante (`SimuladoExamPage.tsx`)

### Conceito
Nos últimos 5 minutos, exibir banner inline sutil (não toast) que desaparece sozinho.

### Implementação

Estado:
```tsx
const [timeWarningShown, setTimeWarningShown] = useState(false);
const [timeWarningVisible, setTimeWarningVisible] = useState(false);

useEffect(() => {
  if (flow.timeRemaining <= 300 && flow.timeRemaining > 295 && !timeWarningShown) {
    setTimeWarningShown(true);
    setTimeWarningVisible(true);
    setTimeout(() => setTimeWarningVisible(false), 5000);
  }
}, [flow.timeRemaining, timeWarningShown]);
```

Banner:
```tsx
<AnimatePresence>
  {timeWarningVisible && (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      className="bg-warning/8 border-b border-warning/15 px-4 py-2 text-center"
    >
      <p className="text-body-sm text-warning font-medium">
        Restam 5 minutos para o término da prova.
      </p>
    </motion.div>
  )}
</AnimatePresence>
```

### Verificação
- Aos 5 minutos restantes: banner aparece suavemente
- Após 5 segundos: banner desaparece suavemente
- Não aparece novamente se o estudante já viu
- Tom: informativo, não alarmista

---

## Step 7 — Confirmação de Saída via Navigation Blocker

### Conceito
Se o estudante tentar sair da rota `/prova` durante a prova, interceptar com confirmação.

### Implementação

React Router v6 não tem `usePrompt` estável. Alternativa com `beforeunload` (já implementado) + UX de "sair":

O botão "Encerrar" no header já abre o modal de confirmação. Para back/forward do browser, o `beforeunload` já funciona.

Adicionar aviso no modal de confirmação de saída se necessário:
```tsx
// No SubmitConfirmModal, se quiser uma opção de "sair sem enviar":
// NÃO implementar — o padrão é que o timer continua e a prova fica salva.
// O beforeunload já cobre esse caso.
```

**Decisão:** Manter `beforeunload` como mecanismo de proteção. Não adicionar complexidade de navigation blocker.

### Verificação
- Fechar aba: browser mostra confirmação nativa (beforeunload)
- Voltar no browser: beforeunload protege

---

## Step 8 — Feedback Visual de Autosave (`useExamFlow.ts` + `SimuladoExamPage.tsx`)

### Conceito
Wiring real do estado `saving` para o header exibir "Salvando..." quando houver persist em andamento.

### Implementação

Em `useExamFlow.ts`, expor estado de saving:
```tsx
// Adicionar ao return:
saving: storage.isSaving, // precisa ser exposto do useExamStorageReal
```

Se `useExamStorageReal` não expõe `isSaving`, adicionar:
```tsx
// Em useExamStorageReal, adicionar ref/state:
const [isSaving, setIsSaving] = useState(false);

// No saveStateDebounced: setIsSaving(true) antes, setIsSaving(false) no finally
// Expor: return { ..., isSaving };
```

Em `SimuladoExamPage.tsx`:
```tsx
// ANTES: saving={false} // TODO
// DEPOIS: saving={flow.saving ?? false}
```

### Verificação
- Ao responder questão: "Salvando" aparece brevemente no header
- Após persist: volta a "Salvo"
- Sem flickering excessivo (debounce de 2s já ajuda)

---

## Resumo de arquivos editados

| # | Arquivo | Tipo de mudança |
|---|---------|----------------|
| 1 | `src/pages/SimuladoExamPage.tsx` | Swipe, offline banner, retomada, time warning, aria-live, saving wiring |
| 2 | `src/components/exam/QuestionDisplay.tsx` | Lightbox animado, skip link |
| 3 | `src/components/exam/QuestionNavigator.tsx` | Aria-labels |
| 4 | `src/hooks/useExamFlow.ts` | Expor saving state |
| 5 | `src/hooks/useExamStorageReal.ts` | Expor isSaving (se não existe) |

## Verificação final da Fase 3

```bash
npm run build
npm run lint
npm run test
```

### Checklist visual (manual)
- [ ] Mobile: swipe entre questões funciona sem conflito com scroll
- [ ] Offline: banner aparece e some ao reconectar
- [ ] Retomada: tela intermediária mostra progresso anterior
- [ ] Lightbox: zoom-in/out suave
- [ ] Screen reader: anuncia mudança de questão
- [ ] Skip link: funcional com Tab
- [ ] Timer: contraste WCAG AA em todos os estados
- [ ] 5min warning: banner temporário elegante
- [ ] Autosave: "Salvando" / "Salvo" reflete estado real
- [ ] Dark mode: tudo adapta

### Critérios de aceitação
1. A experiência é resiliente em cenários adversos (offline, retomada)
2. Acessibilidade atende WCAG AA em cores e navegação
3. Mobile tem gestos nativos sem prejuízo à funcionalidade
4. Cada estado especial é tratado com a mesma qualidade visual do fluxo principal
5. Nenhum feedback falso: "Salvo" só aparece quando realmente persistiu
