# UX Simulado Flow — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar todas as melhorias UX/UI do fluxo de simulados definidas na auditoria de 2026-04-03, do clicar em "Iniciar" até a tela pós-prova.

**Architecture:** Mudanças cirúrgicas em 7 arquivos existentes + 1 arquivo de tipos. Nenhum arquivo novo criado. Cada task é independente e pode ser commitada separadamente. As mudanças seguem os padrões existentes do projeto (shadcn/ui, Tailwind, Framer Motion).

**Tech Stack:** React 18, TypeScript, Tailwind CSS 3.4, shadcn/ui (Radix Dialog), Framer Motion 12, lucide-react

---

> **Nota:** Bloco B3 (atalhos de teclado) e legenda desktop do navegador já estão implementados no código atual. O plano implementa os demais blocos da spec.

---

## Arquivos modificados

| Arquivo | Tasks |
|---------|-------|
| `src/pages/SimuladosPage.tsx` | Task 1 |
| `src/pages/SimuladoDetailPage.tsx` | Task 1, Task 4 |
| `src/components/exam/QuestionDisplay.tsx` | Task 2 |
| `src/pages/SimuladoExamPage.tsx` | Task 3, Task 5, Task 6, Task 7 |
| `src/types/exam.ts` | Task 5 |
| `src/components/exam/SubmitConfirmModal.tsx` | Task 5 |
| `src/components/exam/ExamCompletedScreen.tsx` | Task 6 |
| `src/hooks/useExamTimer.ts` | Task 8 |
| `src/components/exam/ExamHeader.tsx` | Task 8 |

---

## Task 1: Bloco A — Modal online/offline como primeiro passo na SimuladosPage

**Objetivo:** Mover o modal de escolha de modo para aparecer imediatamente ao clicar "Iniciar Simulado" na página `/simulados`. Remover o modal da `SimuladoDetailPage`; após o checklist, o botão navega diretamente para a prova.

**Files:**
- Modify: `src/pages/SimuladosPage.tsx`
- Modify: `src/pages/SimuladoDetailPage.tsx`

- [ ] **Step 1: Adicionar imports no SimuladosPage.tsx**

Abra `src/pages/SimuladosPage.tsx`. Substitua a linha de import do react-router-dom e adicione novos imports:

```tsx
// Trocar:
import { Link } from "react-router-dom";
// Por:
import { Link, useNavigate } from "react-router-dom";
```

Adicione após os imports existentes de lucide-react:

```tsx
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
```

Adicione `Monitor` e `FileText` ao import do lucide-react existente:

```tsx
// Trocar:
import { Play, Lock, Clock, Calendar, CalendarPlus } from "lucide-react";
// Por:
import { Play, Lock, Clock, Calendar, CalendarPlus, Monitor, FileText } from "lucide-react";
```

- [ ] **Step 2: Refatorar HeroCardActive para abrir modal**

Substitua a função `HeroCardActive` inteira em `SimuladosPage.tsx`:

```tsx
function HeroCardActive({ sim }: { sim: SimuladoWithStatus }) {
  const navigate = useNavigate();
  const [showModeModal, setShowModeModal] = useState(false);
  const isInProgress = sim.status === "in_progress";
  const alreadyStarted = sim.userState?.started && !sim.userState.finished;

  return (
    <div
      className="relative w-full rounded-[24px] overflow-hidden p-5 md:p-6"
      style={{
        background: "linear-gradient(142deg, #5a1530 0%, #2e0c1e 55%, #160610 100%)",
        border: "1px solid rgba(232,56,98,.28)",
      }}
    >
      {/* White top thread */}
      <div
        className="absolute inset-x-0 top-0 h-px"
        style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,.12) 40%, transparent)" }}
      />
      {/* Glow 1 */}
      <div
        className="pointer-events-none absolute -top-12 -left-12 w-64 h-64 rounded-full"
        style={{ background: "radial-gradient(circle, rgba(232,56,98,.2) 0%, transparent 70%)" }}
      />
      {/* Glow 2 */}
      <div
        className="pointer-events-none absolute -bottom-16 -right-8 w-72 h-72 rounded-full"
        style={{ background: "radial-gradient(circle, rgba(142,31,61,.18) 0%, transparent 65%)" }}
      />
      {/* Lateral overlay */}
      <div
        className="pointer-events-none absolute inset-y-0 right-0 w-1/2"
        style={{ background: "radial-gradient(ellipse at right, rgba(90,21,48,.4) 0%, transparent 70%)" }}
      />

      <div className="relative z-10">
        {/* Top row */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span
              className="sim-dot-pulse w-2 h-2 rounded-full"
              style={{ background: "#e83862" }}
            />
            <span className="text-xs font-semibold uppercase tracking-wider text-white/80">
              {isInProgress ? "Em andamento" : "Janela aberta"}
            </span>
          </div>
          <span
            className="text-xs font-bold px-2.5 py-1 rounded-lg"
            style={{
              background: "rgba(255,255,255,.08)",
              border: "1px solid rgba(255,255,255,.12)",
              color: "rgba(255,255,255,.7)",
            }}
          >
            #{sim.sequenceNumber}
          </span>
        </div>

        {/* Title */}
        <h2
          className="font-bold text-white mb-3"
          style={{ fontSize: "clamp(18px, 3.5vw, 22px)" }}
        >
          {sim.title}
        </h2>

        {/* Meta row */}
        <div className="flex flex-wrap items-center gap-3 mb-5 text-white/60 text-xs">
          <span className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5" />
            {format(parseISO(sim.executionWindowStart), "dd/MM", { locale: ptBR })}
            {" – "}
            {format(parseISO(sim.executionWindowEnd), "dd/MM", { locale: ptBR })}
          </span>
          <span>{sim.questionsCount} questões</span>
        </div>

        {/* Deadline ticker */}
        <div
          className="flex items-center gap-2 rounded-lg px-3 py-2 mb-5 text-xs font-medium"
          style={{
            background: "rgba(232,56,98,.1)",
            border: "1px solid rgba(232,56,98,.18)",
            color: "rgba(255,255,255,.75)",
          }}
        >
          <Clock className="w-3.5 h-3.5 shrink-0 text-[#e83862]" />
          {formatDeadlineTicker(sim.executionWindowEnd)} — realize agora para entrar no ranking
        </div>

        {/* CTAs */}
        <div className="flex flex-wrap gap-2">
          {alreadyStarted ? (
            <Link
              to={`/simulados/${sim.slug}/prova`}
              className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-opacity hover:opacity-90"
              style={{ background: "#e83862", color: "#fff" }}
            >
              <Play className="w-4 h-4" />
              Continuar Simulado
            </Link>
          ) : (
            <button
              type="button"
              onClick={() => setShowModeModal(true)}
              className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-opacity hover:opacity-90"
              style={{ background: "#e83862", color: "#fff" }}
            >
              <Play className="w-4 h-4" />
              Iniciar Simulado
            </button>
          )}
          <button
            type="button"
            className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-opacity hover:opacity-80"
            style={{
              background: "rgba(255,255,255,.08)",
              border: "1px solid rgba(255,255,255,.12)",
              color: "rgba(255,255,255,.75)",
            }}
            onClick={() => window.dispatchEvent(new CustomEvent(COMO_FUNCIONA_MODAL_OPEN_EVENT))}
          >
            Como funciona
          </button>
        </div>
      </div>

      {/* Mode selection modal */}
      <Dialog open={showModeModal} onOpenChange={setShowModeModal}>
        <DialogContent className="max-w-lg w-full rounded-2xl border border-border p-6 md:p-8 gap-0">
          <DialogHeader className="mb-6">
            <DialogTitle className="text-heading-2 text-foreground text-center">
              Como deseja realizar o simulado?
            </DialogTitle>
            <DialogDescription className="text-body text-muted-foreground text-center mt-2">
              Escolha a experiência que melhor se adapta ao seu momento.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <button
              onClick={() => {
                setShowModeModal(false);
                navigate(`/simulados/${sim.slug}/start`);
              }}
              className="flex flex-col items-center gap-3 p-6 rounded-xl border-2 border-primary/20 bg-accent/30 hover:border-primary hover:bg-accent transition-all text-center group"
            >
              <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                <Monitor className="h-7 w-7 text-primary" />
              </div>
              <p className="text-body font-semibold text-foreground">Experiência online</p>
              <p className="text-body-sm text-muted-foreground">
                Realize o simulado na plataforma com tela cheia
              </p>
            </button>
            <button
              disabled
              className="flex flex-col items-center gap-3 p-6 rounded-xl border-2 border-dashed border-border bg-muted/30 text-center opacity-60 cursor-not-allowed"
            >
              <div className="h-14 w-14 rounded-2xl bg-muted flex items-center justify-center">
                <FileText className="h-7 w-7 text-muted-foreground" />
              </div>
              <p className="text-body font-semibold text-muted-foreground">Experiência offline</p>
              <p className="text-body-sm text-muted-foreground">
                Gere o PDF e suba o gabarito após finalizar
              </p>
              <span className="text-caption text-muted-foreground bg-muted px-2 py-0.5 rounded">
                Em breve
              </span>
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
```

- [ ] **Step 3: Limpar SimuladoDetailPage — remover modal**

Abra `src/pages/SimuladoDetailPage.tsx`.

**3a. Remover imports não mais usados:**

```tsx
// Trocar:
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
// Remover completamente (Dialog não é mais usado no arquivo)
```

```tsx
// Trocar:
import {
  Clock, Play, AlertTriangle,
  Wifi, Monitor, CheckCircle2, Lock, Sparkles, FileText, Square, CheckSquare,
  CalendarPlus,
} from "lucide-react";
// Por (remove FileText):
import {
  Clock, Play, AlertTriangle,
  Wifi, Monitor, CheckCircle2, Lock, Sparkles, Square, CheckSquare,
  CalendarPlus,
} from "lucide-react";
```

**3b. Remover estado `showExamChoiceModal`:**

```tsx
// Remover esta linha:
const [showExamChoiceModal, setShowExamChoiceModal] = useState(false);
```

**3c. Mudar o botão "Iniciar Simulado" para navegar diretamente:**

```tsx
// Trocar:
<button
  onClick={() => setShowExamChoiceModal(true)}
  disabled={!allChecked}
  className={cn(
    "inline-flex items-center gap-2 px-10 py-4 rounded-xl text-body-lg font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 active:scale-[0.995]",
    allChecked
      ? "bg-primary text-primary-foreground hover:bg-wine-hover shadow-sm hover:shadow-md"
      : "bg-muted text-muted-foreground cursor-not-allowed"
  )}
>
  <Play className="h-5 w-5" />
  Iniciar Simulado
</button>

// Por:
<button
  onClick={() => navigate(`/simulados/${id}/prova`)}
  disabled={!allChecked}
  className={cn(
    "inline-flex items-center gap-2 px-10 py-4 rounded-xl text-body-lg font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 active:scale-[0.995]",
    allChecked
      ? "bg-primary text-primary-foreground hover:bg-wine-hover shadow-sm hover:shadow-md"
      : "bg-muted text-muted-foreground cursor-not-allowed"
  )}
>
  <Play className="h-5 w-5" />
  Iniciar Simulado
</button>
```

**3d. Remover o bloco Dialog inteiro** (linhas 281–326, o `{/* Exam choice modal */}` e todo o `<Dialog>...</Dialog>` dentro do `<PremiumCard>`).

- [ ] **Step 4: Verificar no browser**

```bash
npm run dev
```

- Abrir `/simulados`
- Clicar "Iniciar Simulado" no hero card → modal deve aparecer imediatamente
- Clicar "Experiência online" → deve navegar para `/simulados/:id/start` (checklist)
- No checklist, completar e clicar "Iniciar" → deve navegar diretamente para a prova (sem modal intermediário)

- [ ] **Step 5: Commit**

```bash
git add src/pages/SimuladosPage.tsx src/pages/SimuladoDetailPage.tsx
git commit -m "feat: mover modal online/offline para primeiro passo na SimuladosPage"
```

---

## Task 2: Bloco B1 — Label visível no botão "Eliminar alternativa"

**Objetivo:** Tornar o botão de eliminar alternativa mais descobrível. Atualmente é um ícone de lixeira pequeno, invisível no desktop até hover. Adicionar label de texto visível no hover.

**Files:**
- Modify: `src/components/exam/QuestionDisplay.tsx`

- [ ] **Step 1: Substituir o botão de eliminar**

Substitua o bloco `{/* Eliminate/restore */}` completo (linhas 133-149) em `QuestionDisplay.tsx`:

```tsx
{/* Eliminate/restore — label visible on hover */}
<button
  type="button"
  onClick={(e) => {
    e.stopPropagation();
    onEliminateOption(opt.id);
  }}
  className={cn(
    'absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium',
    'transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 active:scale-90',
    isEliminated
      ? 'opacity-100 text-destructive hover:bg-destructive/10'
      : 'opacity-100 sm:opacity-0 sm:group-hover:opacity-100 text-muted-foreground hover:text-foreground hover:bg-muted',
  )}
  title={isEliminated ? 'Restaurar alternativa' : 'Eliminar alternativa'}
  aria-label={isEliminated ? 'Restaurar alternativa' : 'Eliminar alternativa'}
>
  {isEliminated
    ? <><Undo2 className="h-3.5 w-3.5" aria-hidden /><span className="hidden sm:inline">Restaurar</span></>
    : <><Trash2 className="h-3.5 w-3.5" aria-hidden /><span className="hidden sm:inline">Eliminar</span></>
  }
</button>
```

- [ ] **Step 2: Verificar no browser**

```bash
npm run dev
```

- Abrir uma prova
- No desktop: hover sobre uma alternativa → deve aparecer "Eliminar" com ícone
- Clicar → alternativa fica com line-through e botão muda para "Restaurar"
- No mobile: botão deve aparecer sem hover

- [ ] **Step 3: Commit**

```bash
git add src/components/exam/QuestionDisplay.tsx
git commit -m "feat: label visível no botão eliminar alternativa (B1)"
```

---

## Task 3: Bloco B2 — Tooltip direto no botão "Alta certeza"

**Objetivo:** O botão "Alta certeza" no `SimuladoExamPage` já tem texto explicativo abaixo (muito sutil). Adicionar um `title` attribute e melhorar o texto de ajuda para ficar mais visível e contextual.

**Files:**
- Modify: `src/pages/SimuladoExamPage.tsx`

- [ ] **Step 1: Adicionar title e melhorar texto de ajuda**

Em `SimuladoExamPage.tsx`, localize o botão de alta certeza (por volta da linha 163) e adicione `title`:

```tsx
// Trocar:
<button
  onClick={flow.toggleHighConfidence}
  className={cn(
    'inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-body-sm font-medium transition-all',
    flow.isHighConfFlagged
      ? 'bg-success/10 text-success border border-success/30'
      : 'bg-muted text-muted-foreground hover:bg-muted/80',
  )}
>
  <Zap className="h-3.5 w-3.5" />
  {flow.isHighConfFlagged ? 'Alta certeza ✓' : 'Alta certeza'}
</button>

// Por:
<button
  onClick={flow.toggleHighConfidence}
  title="Marque quando tiver certeza da resposta — aparece nos seus resultados para análise de calibração"
  className={cn(
    'inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-body-sm font-medium transition-all',
    flow.isHighConfFlagged
      ? 'bg-success/10 text-success border border-success/30'
      : 'bg-muted text-muted-foreground hover:bg-muted/80',
  )}
>
  <Zap className="h-3.5 w-3.5" />
  {flow.isHighConfFlagged ? 'Alta certeza ✓' : 'Alta certeza'}
</button>
```

Melhore também o texto explicativo abaixo dos botões (linha ~177):

```tsx
// Trocar:
<p className="mt-1.5 text-[10px] text-muted-foreground/60 leading-snug">
  <strong className="text-muted-foreground/70">Marcar p/ revisar:</strong> volta nessa questão antes de finalizar.{' '}
  <strong className="text-muted-foreground/70">Alta certeza:</strong> indica confiança na resposta — útil na análise pós-prova.
</p>

// Por:
<p className="mt-1.5 text-[10px] text-muted-foreground/70 leading-snug">
  <strong className="text-muted-foreground/80">Revisar:</strong> para voltar antes de finalizar.{' '}
  <strong className="text-muted-foreground/80">Alta certeza:</strong> marca sua confiança — aparece nos resultados para você calibrar seu desempenho.
</p>
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/SimuladoExamPage.tsx
git commit -m "feat: tooltip e texto melhorado no botão alta certeza (B2)"
```

---

## Task 4: Blocos D+E — Checklist adaptativo + aviso de fullscreen

**Objetivo:** Detectar se o usuário já fez alguma prova (veterano). Se sim, mostrar banner resumido em vez do checklist completo. Adicionar item informativo sobre fullscreen no checklist.

**Files:**
- Modify: `src/pages/SimuladoDetailPage.tsx`

- [ ] **Step 1: Adicionar imports necessários**

Em `SimuladoDetailPage.tsx`, adicione `useSimulados` e o ícone `Maximize2`:

```tsx
// Adicionar ao import de hooks (após useSimuladoDetail):
import { useSimulados } from "@/hooks/useSimulados";
```

```tsx
// Trocar a linha de imports lucide-react:
import {
  Clock, Play, AlertTriangle,
  Wifi, Monitor, CheckCircle2, Lock, Sparkles, Square, CheckSquare,
  CalendarPlus,
} from "lucide-react";
// Por (adiciona Maximize2):
import {
  Clock, Play, AlertTriangle,
  Wifi, Monitor, CheckCircle2, Lock, Sparkles, Square, CheckSquare,
  CalendarPlus, Maximize2,
} from "lucide-react";
```

- [ ] **Step 2: Adicionar item de fullscreen ao checklist**

Substitua o `CHECKLIST_BASE` array (linhas 37-42):

```tsx
const CHECKLIST_BASE = [
  { key: "duration", icon: Clock, title: "Duração da prova", getDesc: (s: { estimatedDuration: string; questionsCount: number }) => `${s.estimatedDuration} · ${s.questionsCount} questões` },
  { key: "noPause", icon: AlertTriangle, title: "Sem pausa", getDesc: () => "O cronômetro não pode ser pausado após iniciar." },
  { key: "connection", icon: Wifi, title: "Conexão estável", getDesc: () => "Respostas salvas automaticamente. Mantenha conexão ativa." },
  { key: "environment", icon: Monitor, title: "Ambiente adequado", getDesc: () => "Local tranquilo, sem interrupções." },
  { key: "fullscreen", icon: Maximize2, title: "Prova em tela cheia", getDesc: () => "A prova abre automaticamente em fullscreen. Sair do fullscreen é registrado." },
] as const;
```

- [ ] **Step 3: Adicionar tipo para nova chave e detecção de veterano**

Substitua a declaração de tipos e adicione a detecção de veterano na função principal. Localize as linhas após os tipos (perto de linha 44-51):

```tsx
type BaseChecklistKey = (typeof CHECKLIST_BASE)[number]["key"];
type ChecklistKey = BaseChecklistKey | "rankingNational";
```

Dentro de `SimuladoDetailPage()`, adicione após as declarações existentes de estado:

```tsx
// Detectar veterano: usuário que já completou alguma prova (dados já em cache pelo React Query)
const { simulados: allSimulados } = useSimulados();
const isVeteran = allSimulados.some(s => s.userState?.finished === true);
const [showFullChecklist, setShowFullChecklist] = useState(false);
```

- [ ] **Step 4: Substituir a seção do checklist com lógica adaptativa**

Localize o bloco que começa com `{/* Clickable Checklist */}` (linha ~223) e substitua **tudo** entre o `<div className="text-center mb-8">` (que tem o título "Pronto para começar?") e o `<p className="text-caption text-muted-foreground text-center mt-6">` (que mostra a data de resultado). Ou seja, substitua o interior do `<PremiumCard variant="hero">` do checklist:

```tsx
<PremiumCard variant="hero">
  <div className="text-center mb-6">
    <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
      <Play className="h-7 w-7 text-primary" />
    </div>
    <h2 className="text-heading-2 text-foreground mb-2">
      {isVeteran ? "Tudo pronto?" : "Pronto para começar?"}
    </h2>
    {simulado.status === "available_late" && (
      <div className="inline-flex items-start gap-2 px-4 py-3 rounded-xl bg-primary/[0.06] border border-primary/15 text-left text-body-sm text-foreground max-w-lg mx-auto mb-4">
        <Sparkles className="h-4 w-4 text-primary shrink-0 mt-0.5" aria-hidden />
        <span>
          Você faz agora o mesmo simulado completo da preparação nacional.{" "}
          <strong className="text-foreground">Sua nota não entra no ranking nacional</strong>{" "}
          porque a janela oficial encerrou — resultado e gabarito seguem valendo para o seu estudo.
        </span>
      </div>
    )}
    {!isVeteran && (
      <p className="text-body text-muted-foreground max-w-lg mx-auto">
        Confirme os itens abaixo antes de iniciar. A prova não pode ser pausada.
      </p>
    )}
  </div>

  {/* Veteran: banner resumido */}
  {isVeteran && (
    <div className="max-w-2xl mx-auto mb-6">
      <div className="flex flex-wrap items-center justify-center gap-3 px-4 py-3 rounded-xl bg-muted/50 border border-border text-body-sm text-foreground mb-4">
        <span className="flex items-center gap-1.5">
          <Clock className="h-4 w-4 text-muted-foreground" />
          {simulado.questionsCount} questões · {simulado.estimatedDuration}
        </span>
        <span className="flex items-center gap-1.5">
          <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          Sem pausa
        </span>
        <span className="flex items-center gap-1.5">
          <Maximize2 className="h-4 w-4 text-muted-foreground" />
          Tela cheia
        </span>
      </div>
      <div className="text-center mb-2">
        <button
          onClick={() => navigate(`/simulados/${id}/prova`)}
          className="inline-flex items-center gap-2 px-10 py-4 rounded-xl text-body-lg font-semibold transition-all duration-200 bg-primary text-primary-foreground hover:bg-wine-hover shadow-sm hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 active:scale-[0.995]"
        >
          <Play className="h-5 w-5" />
          Iniciar Simulado
        </button>
      </div>
      <div className="text-center">
        <button
          type="button"
          onClick={() => setShowFullChecklist(v => !v)}
          className="text-caption text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2"
        >
          {showFullChecklist ? "ocultar detalhes ↑" : "ver detalhes ↓"}
        </button>
      </div>
    </div>
  )}

  {/* Checklist completo — sempre para novatos, colapsável para veteranos */}
  {(!isVeteran || showFullChecklist) && (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-2xl mx-auto mb-8">
        {checklistItems.map((item) => {
          const checked = checkedItems.has(item.key);
          const CheckIcon = checked ? CheckSquare : Square;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => toggleCheck(item.key)}
              className={cn(
                "flex items-start gap-3 p-4 rounded-xl text-left transition-all duration-200",
                checked
                  ? "bg-primary/[0.06] border border-primary/20"
                  : "bg-muted/50 border border-transparent hover:border-border"
              )}
            >
              <CheckIcon
                className={cn(
                  "h-5 w-5 shrink-0 mt-0.5 transition-colors",
                  checked ? "text-primary" : "text-muted-foreground"
                )}
              />
              <div>
                <p className={cn("text-body font-medium", checked ? "text-foreground" : "text-foreground/80")}>
                  {item.title}
                </p>
                <p className="text-body-sm text-muted-foreground">
                  {item.getDesc(simulado)}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      {!isVeteran && (
        <div className="text-center">
          <button
            onClick={() => navigate(`/simulados/${id}/prova`)}
            disabled={!allChecked}
            className={cn(
              "inline-flex items-center gap-2 px-10 py-4 rounded-xl text-body-lg font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 active:scale-[0.995]",
              allChecked
                ? "bg-primary text-primary-foreground hover:bg-wine-hover shadow-sm hover:shadow-md"
                : "bg-muted text-muted-foreground cursor-not-allowed"
            )}
          >
            <Play className="h-5 w-5" />
            Iniciar Simulado
          </button>
          {!allChecked && (
            <p className="text-caption text-muted-foreground mt-3">
              Confirme todos os itens acima para prosseguir.
            </p>
          )}
        </div>
      )}
    </>
  )}

  <p className="text-caption text-muted-foreground text-center mt-6">
    Resultado em {formatDate(simulado.resultsReleaseAt)}.
  </p>
</PremiumCard>
```

- [ ] **Step 5: Verificar no browser**

```bash
npm run dev
```

**Para novato** (nenhuma prova finalizada): Deve aparecer o checklist completo com 5 itens incluindo "Prova em tela cheia".

**Para veterano** (ao menos uma prova com `userState.finished = true`): Deve aparecer o banner resumido com botão direto "Iniciar Simulado" e link "ver detalhes ↓".

- [ ] **Step 6: Commit**

```bash
git add src/pages/SimuladoDetailPage.tsx
git commit -m "feat: checklist adaptativo novato/veterano + aviso fullscreen (D+E)"
```

---

## Task 5: Bloco F — Questões em branco clicáveis no modal de finalização

**Objetivo:** Mostrar os números das questões sem resposta no modal de confirmação. Clicar em um número fecha o modal e navega para aquela questão.

**Files:**
- Modify: `src/types/exam.ts`
- Modify: `src/components/exam/SubmitConfirmModal.tsx`
- Modify: `src/pages/SimuladoExamPage.tsx`

- [ ] **Step 1: Extender ExamSummary com unansweredIndices**

Em `src/types/exam.ts`, substitua a interface e a função:

```typescript
export interface ExamSummary {
  total: number;
  answered: number;
  unanswered: number;
  markedForReview: number;
  highConfidence: number;
  unansweredIndices: number[]; // índices 0-based das questões sem resposta
}

export function computeExamSummary(
  state: ExamState,
  questionIds: string[]
): ExamSummary {
  const answered = questionIds.filter(id => !!state.answers[id]?.selectedOption).length;
  const unansweredIndices = questionIds
    .map((id, i) => ({ id, i }))
    .filter(({ id }) => !state.answers[id]?.selectedOption)
    .map(({ i }) => i);
  return {
    total: questionIds.length,
    answered,
    unanswered: questionIds.length - answered,
    markedForReview: questionIds.filter(id => state.answers[id]?.markedForReview).length,
    highConfidence: questionIds.filter(id => state.answers[id]?.highConfidence).length,
    unansweredIndices,
  };
}
```

- [ ] **Step 2: Adicionar prop onNavigateToQuestion no SubmitConfirmModal**

Em `src/components/exam/SubmitConfirmModal.tsx`, atualize a interface de props e o componente:

```tsx
interface SubmitConfirmModalProps {
  open: boolean;
  summary: ExamSummary;
  submitting: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  onNavigateToQuestion: (index: number) => void;
}

export function SubmitConfirmModal({
  open,
  summary,
  submitting,
  onConfirm,
  onCancel,
  onNavigateToQuestion,
}: SubmitConfirmModalProps) {
```

- [ ] **Step 3: Substituir o bloco de aviso de questões em branco**

No `SubmitConfirmModal`, substitua o bloco `{summary.unanswered > 0 && (...)}` (linhas 79-86):

```tsx
{summary.unanswered > 0 && (
  <div className="flex items-start gap-2 p-3 rounded-xl bg-warning/10 mb-6">
    <AlertTriangle className="h-4 w-4 text-warning shrink-0 mt-0.5" aria-hidden />
    <div className="flex-1 min-w-0">
      <p className="text-body-sm text-warning mb-2">
        Você tem {summary.unanswered} {summary.unanswered === 1 ? 'questão' : 'questões'} sem resposta.
      </p>
      <div className="flex flex-wrap gap-1.5">
        {summary.unansweredIndices.slice(0, 12).map(i => (
          <button
            key={i}
            type="button"
            onClick={() => {
              onCancel();
              onNavigateToQuestion(i);
            }}
            className="h-7 w-7 rounded-md text-[11px] font-bold bg-warning/15 text-warning border border-warning/30 hover:bg-warning/25 transition-colors"
          >
            {i + 1}
          </button>
        ))}
        {summary.unansweredIndices.length > 12 && (
          <span className="text-body-sm text-muted-foreground self-center">
            +{summary.unansweredIndices.length - 12} mais
          </span>
        )}
      </div>
    </div>
  </div>
)}
```

- [ ] **Step 4: Passar onNavigateToQuestion no SimuladoExamPage**

Em `src/pages/SimuladoExamPage.tsx`, localize o `<SubmitConfirmModal` e adicione a prop:

```tsx
<SubmitConfirmModal
  open={flow.showSubmitModal}
  summary={flow.summary}
  submitting={flow.submitting}
  onConfirm={flow.finalize}
  onCancel={() => flow.setShowSubmitModal(false)}
  onNavigateToQuestion={(index) => {
    flow.setShowSubmitModal(false);
    flow.handleNavigate(index);
  }}
/>
```

- [ ] **Step 5: Verificar no browser**

```bash
npm run dev
```

- Abrir prova, deixar algumas questões sem resposta
- Clicar "Finalizar" → no modal, os números das questões em branco devem aparecer como botões
- Clicar em um número → modal fecha e navega para aquela questão

- [ ] **Step 6: Commit**

```bash
git add src/types/exam.ts src/components/exam/SubmitConfirmModal.tsx src/pages/SimuladoExamPage.tsx
git commit -m "feat: questões em branco clicáveis no modal de finalização (F)"
```

---

## Task 6: Bloco G — ExamCompletedScreen com celebração e CTA condicional

**Objetivo:** Melhorar a tela pós-prova com: título mais impactante, resumo da prova, notificação de email proeminente, e CTA "Ver resultado" condicional (só aparece quando resultado está disponível).

**Files:**
- Modify: `src/components/exam/ExamCompletedScreen.tsx`
- Modify: `src/pages/SimuladoExamPage.tsx`

- [ ] **Step 1: Adicionar novas props em ExamCompletedScreen**

Substitua a interface de props:

```tsx
interface ExamCompletedScreenProps {
  simuladoId: string;
  simuladoTitle: string;
  resultsReleaseAt: string;
  answeredCount: number;
  totalCount: number;
  highConfidenceCount: number;
  markedForReviewCount: number;
  notifyResultByEmail: boolean;
  notificationSaving: boolean;
  isWithinWindow?: boolean;
  resultsAvailable: boolean;
  onToggleNotifyResultByEmail: (enabled: boolean) => Promise<void>;
}
```

- [ ] **Step 2: Substituir o componente ExamCompletedScreen**

Substitua o componente inteiro pelo código abaixo:

```tsx
export function ExamCompletedScreen({
  simuladoId,
  simuladoTitle,
  resultsReleaseAt,
  answeredCount,
  totalCount,
  highConfidenceCount,
  markedForReviewCount,
  notifyResultByEmail,
  notificationSaving,
  isWithinWindow = true,
  resultsAvailable,
  onToggleNotifyResultByEmail,
}: ExamCompletedScreenProps) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: prefersReducedMotion ? 0 : 0.6 }}
        className="max-w-lg w-full text-center"
      >
        {/* Ícone com spring */}
        <motion.div
          initial={prefersReducedMotion ? false : { scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={prefersReducedMotion ? { duration: 0 } : { delay: 0.15, type: 'spring', stiffness: 200, damping: 18 }}
          className="h-20 w-20 rounded-3xl bg-success/10 flex items-center justify-center mx-auto mb-6"
        >
          <CheckCircle2 className="h-10 w-10 text-success" aria-hidden />
        </motion.div>

        <h1 className="text-heading-1 text-foreground mb-3">
          Prova entregue!
        </h1>
        <p className="text-body-lg text-muted-foreground mb-2">
          Você completou o <strong className="text-foreground">{simuladoTitle}</strong>.
        </p>
        {!isWithinWindow && (
          <div className="inline-flex items-start gap-2 px-4 py-3 rounded-xl bg-primary/[0.06] border border-primary/15 text-body-sm text-foreground text-left max-w-md mx-auto mb-3">
            <Sparkles className="h-4 w-4 text-primary shrink-0 mt-0.5" aria-hidden />
            <span>
              <strong className="text-foreground">Esta realização não entra no ranking nacional</strong>
              {' '}— a janela oficial já havia encerrado. Seu desempenho, gabarito e comentários seguem valendo para sua preparação.
            </span>
          </div>
        )}

        {/* Resumo da prova */}
        <div className="flex flex-wrap justify-center gap-3 mb-6">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-muted text-body-sm text-foreground">
            <CheckCircle2 className="h-3.5 w-3.5 text-success" aria-hidden />
            {answeredCount}/{totalCount} respondidas
          </span>
          {highConfidenceCount > 0 && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-success/10 text-body-sm text-success">
              <Zap className="h-3.5 w-3.5" aria-hidden />
              {highConfidenceCount} alta certeza
            </span>
          )}
          {markedForReviewCount > 0 && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-info/10 text-body-sm text-info">
              <Flag className="h-3.5 w-3.5" aria-hidden />
              {markedForReviewCount} para revisar
            </span>
          )}
        </div>

        <p className="text-body-sm text-muted-foreground mb-6">
          Suas respostas foram salvas com sucesso. Nada será perdido.
        </p>

        {/* Liberação do resultado */}
        <div className="premium-card p-5 mb-6 text-left">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-xl bg-accent flex items-center justify-center shrink-0">
              <Calendar className="h-5 w-5 text-primary" aria-hidden />
            </div>
            <div>
              <p className="text-body font-semibold text-foreground mb-1">Liberação do resultado</p>
              <p className="text-body-sm text-muted-foreground leading-relaxed">
                {resultsAvailable
                  ? 'O gabarito comentado, seu desempenho e o ranking já estão disponíveis!'
                  : <>O gabarito comentado, seu desempenho detalhado e o ranking serão liberados em{' '}
                    <strong className="text-foreground">{formatDate(resultsReleaseAt)}</strong>.</>
                }
              </p>
            </div>
          </div>
        </div>

        {/* Notificação por email — proeminente */}
        {!resultsAvailable && (
          <div className="premium-card p-4 mb-6 text-left border-primary/20">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-start gap-2.5">
                <Mail className="h-4 w-4 text-primary mt-0.5" aria-hidden />
                <div>
                  <p className="text-body-sm font-semibold text-foreground">Quer saber quando o resultado sair?</p>
                  <p className="text-caption text-muted-foreground">
                    Você recebe um email assim que ficar disponível.
                  </p>
                </div>
              </div>
              <button
                type="button"
                disabled={notificationSaving}
                onClick={() => onToggleNotifyResultByEmail(!notifyResultByEmail)}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-body-sm font-medium transition-colors disabled:opacity-60 shrink-0',
                  notifyResultByEmail
                    ? 'bg-primary text-primary-foreground hover:bg-wine-hover'
                    : 'border border-border bg-card hover:bg-muted'
                )}
              >
                {notifyResultByEmail ? 'Ativado ✓' : 'Ativar aviso'}
              </button>
            </div>
          </div>
        )}

        {/* CTAs — condicional ao status do resultado */}
        {resultsAvailable ? (
          <Link
            to={`/simulados/${simuladoId}/resultado`}
            className="inline-flex items-center justify-center gap-2 w-full px-6 py-4 rounded-xl bg-primary text-primary-foreground text-body-lg font-semibold hover:bg-wine-hover transition-colors mb-4 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 active:scale-[0.995]"
          >
            Ver resultado
            <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-0.5" aria-hidden />
          </Link>
        ) : (
          <Link
            to={`/simulados/${simuladoId}/correcao`}
            className="inline-flex items-center justify-center gap-2 w-full px-6 py-4 rounded-xl bg-accent text-foreground text-body-lg font-semibold hover:bg-muted transition-colors mb-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 active:scale-[0.995]"
          >
            Ver gabarito
            <ArrowRight className="h-5 w-5" aria-hidden />
          </Link>
        )}

        <Link
          to="/simulados"
          className="inline-flex items-center justify-center w-full px-6 py-3 rounded-xl border border-border bg-transparent text-muted-foreground text-body font-medium hover:bg-muted/50 hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 active:scale-[0.995]"
        >
          Voltar ao calendário
        </Link>
      </motion.div>
    </div>
  );
}
```

- [ ] **Step 3: Adicionar imports faltantes em ExamCompletedScreen**

No topo do arquivo, adicione os imports que faltam:

```tsx
// Trocar:
import { CheckCircle2, Calendar, ArrowRight, Mail, Sparkles } from 'lucide-react';
// Por:
import { CheckCircle2, Calendar, ArrowRight, Mail, Sparkles, Zap, Flag } from 'lucide-react';
import { cn } from '@/lib/utils';
```

- [ ] **Step 4: Passar as novas props em SimuladoExamPage**

Em `src/pages/SimuladoExamPage.tsx`, adicione import:

```tsx
import { canViewResults } from '@/lib/simulado-helpers';
```

Substitua o bloco `<ExamCompletedScreen ...>`:

```tsx
<ExamCompletedScreen
  simuladoId={flow.simulado.id}
  simuladoTitle={flow.simulado.title}
  resultsReleaseAt={flow.simulado.resultsReleaseAt}
  answeredCount={flow.summary.answered}
  totalCount={flow.summary.total}
  highConfidenceCount={flow.summary.highConfidence}
  markedForReviewCount={flow.summary.markedForReview}
  notifyResultByEmail={flow.notifyResultByEmail}
  notificationSaving={flow.notificationSaving}
  isWithinWindow={flow.isWithinWindow}
  resultsAvailable={canViewResults(flow.simulado.status)}
  onToggleNotifyResultByEmail={flow.setNotifyResultByEmail}
/>
```

- [ ] **Step 5: Verificar no browser**

```bash
npm run dev
```

- Completar uma prova → tela deve mostrar "Prova entregue!", badges de resumo (respondidas, alta certeza, revisão)
- Quando resultado não liberado: "Ver gabarito" como CTA principal + bloco de notificação por email proeminente
- Quando resultado liberado (`simulado.status === 'completed'`): "Ver resultado" como CTA principal

- [ ] **Step 6: Commit**

```bash
git add src/components/exam/ExamCompletedScreen.tsx src/pages/SimuladoExamPage.tsx
git commit -m "feat: celebração e CTA condicional na tela pós-prova (G)"
```

---

## Task 7: Bloco H — Mini-nav mobile com scroll automático

**Objetivo:** Adicionar uma barra de navegação fixa no rodapé no mobile mostrando todas as questões em scroll horizontal, com scroll automático para manter a questão atual visível.

**Files:**
- Modify: `src/pages/SimuladoExamPage.tsx`

- [ ] **Step 1: Adicionar useRef ao import de React**

Em `SimuladoExamPage.tsx`, confirme que `useRef` está importado:

```tsx
// Trocar:
import { useEffect, useCallback } from 'react';
// Por:
import { useEffect, useCallback, useRef } from 'react';
```

- [ ] **Step 2: Adicionar mini-nav antes do SubmitConfirmModal**

No return do componente `SimuladoExamPage`, localize a linha `<SubmitConfirmModal` e adicione o mini-nav **antes** dela:

```tsx
      {/* Mini-nav mobile — barra fixa no rodapé, scroll horizontal */}
      {flow.state && (
        <MobileQuestionNav
          questionIds={flow.questionIds}
          currentIndex={flow.currentIndex}
          answers={flow.state.answers}
          onNavigate={flow.handleNavigate}
        />
      )}
```

- [ ] **Step 3: Criar o componente MobileQuestionNav no mesmo arquivo**

Adicione antes do export default (ou após o componente `useFullscreen`):

```tsx
function MobileQuestionNav({
  questionIds,
  currentIndex,
  answers,
  onNavigate,
}: {
  questionIds: string[];
  currentIndex: number;
  answers: Record<string, import('@/types/exam').ExamAnswer>;
  onNavigate: (index: number) => void;
}) {
  const currentRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    currentRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'nearest',
      inline: 'center',
    });
  }, [currentIndex]);

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-card/95 backdrop-blur-sm border-t border-border px-3 py-2">
      <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide pb-safe">
        {questionIds.map((qId, i) => {
          const a = answers[qId];
          const isAnswered = !!a?.selectedOption;
          const isReview = !!a?.markedForReview;
          const isHighConf = !!a?.highConfidence;
          const isCurrent = i === currentIndex;

          return (
            <button
              key={qId}
              ref={isCurrent ? currentRef : undefined}
              onClick={() => onNavigate(i)}
              className={cn(
                'flex-shrink-0 h-7 w-7 rounded-md text-[10px] font-bold transition-all duration-150',
                'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1',
                isCurrent && 'ring-2 ring-primary ring-offset-1 scale-110',
                isAnswered && !isReview
                  ? 'bg-accent text-accent-foreground'
                  : isReview
                    ? 'bg-info/20 text-info'
                    : isHighConf
                      ? 'bg-success/20 text-success'
                      : 'bg-muted/70 text-muted-foreground',
              )}
            >
              {i + 1}
            </button>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Adicionar padding-bottom no main para não sobrepor mini-nav**

No mobile, o conteúdo principal precisa de padding inferior para não ficar atrás do mini-nav. Em `SimuladoExamPage.tsx`, localize a `<main>` do exam e adicione `pb-14 md:pb-0`:

```tsx
// Trocar:
<main className="flex-1 overflow-y-auto p-4 md:p-8">
// Por:
<main className="flex-1 overflow-y-auto p-4 md:p-8 pb-14 md:pb-0">
```

- [ ] **Step 5: Verificar no browser (modo mobile)**

```bash
npm run dev
```

- Abrir DevTools → modo mobile (iPhone ou similar)
- Iniciar uma prova → barra de questões deve aparecer no rodapé
- Navegar questões → scroll deve acompanhar questão atual automaticamente
- Cores: azul = respondida, amarelo = revisão, verde = alta certeza, cinza = em branco

- [ ] **Step 6: Commit**

```bash
git add src/pages/SimuladoExamPage.tsx
git commit -m "feat: mini-nav mobile com scroll automático no rodapé (H)"
```

---

## Task 8: P3 polish — Timer com aviso em 15 min + indicador "Salvo"

**Objetivo:** Adicionar estado intermediário no timer a 15 minutos (amarelo suave antes do warning) e um indicador visual de "Salvo" no header que pisca durante a sincronização.

**Files:**
- Modify: `src/hooks/useExamTimer.ts`
- Modify: `src/components/exam/ExamHeader.tsx`

- [ ] **Step 1: Ler o arquivo useExamTimer**

```bash
cat src/hooks/useExamTimer.ts
```

Observe as funções `getTimerColor` e `getTimerBgClass` e seus thresholds atuais. O padrão esperado é:
- `< 60s` → destructive
- `< 300s` (5 min) → warning
- resto → default

- [ ] **Step 2: Adicionar threshold de 15 minutos**

Em `src/hooks/useExamTimer.ts`, localize `getTimerBgClass` e `getTimerColor` e adicione o threshold de 900 segundos:

```typescript
export function getTimerBgClass(seconds: number): string {
  if (seconds < 60) return 'bg-destructive/10';
  if (seconds < 300) return 'bg-warning/10';
  if (seconds < 900) return 'bg-amber-50 dark:bg-amber-950/20';
  return 'bg-muted';
}

export function getTimerColor(seconds: number): string {
  if (seconds < 60) return 'text-destructive';
  if (seconds < 300) return 'text-warning';
  if (seconds < 900) return 'text-amber-600 dark:text-amber-400';
  return 'text-foreground';
}
```

- [ ] **Step 3: Adicionar prop `saving` e indicador no ExamHeader**

Em `src/components/exam/ExamHeader.tsx`, adicione `saving` à interface:

```tsx
interface ExamHeaderProps {
  title: string;
  currentQuestion: number;
  totalQuestions: number;
  timeRemaining: number;
  onFinalize: () => void;
  saving?: boolean;
}
```

Destructure o novo prop:

```tsx
export function ExamHeader({
  title, currentQuestion, totalQuestions, timeRemaining, onFinalize, saving = false,
}: ExamHeaderProps) {
```

Substitua o indicador de auto-save atual (linha ~68):

```tsx
{/* Auto-save indicator */}
<div className={cn(
  'hidden sm:flex items-center gap-1 text-caption transition-colors',
  saving ? 'text-primary' : 'text-muted-foreground/50',
)}>
  <Save className={cn('h-3 w-3', saving && 'animate-pulse')} />
  <span className="text-[10px]">{saving ? 'Salvando...' : 'Salvo'}</span>
</div>
```

- [ ] **Step 4: Passar saving para ExamHeader no SimuladoExamPage**

Em `src/pages/SimuladoExamPage.tsx`, verifique se `flow` expõe algum indicador de saving. Se não, passe `false` por ora (o indicador "Salvo" já melhora a UX sem a animação):

```tsx
<ExamHeader
  title={flow.simulado.title}
  currentQuestion={flow.currentIndex + 1}
  totalQuestions={flow.questions.length}
  timeRemaining={flow.timeRemaining}
  onFinalize={() => flow.setShowSubmitModal(true)}
  saving={false}
/>
```

- [ ] **Step 5: Verificar no browser**

```bash
npm run dev
```

- Abrir uma prova com > 15 min restantes → timer em cor neutra
- Com 15 min: timer muda para âmbar suave
- Com 5 min: timer muda para warning (laranja)
- Com 1 min: timer muda para destructive + pulse
- Header deve mostrar "Salvo" em cinza discreto

- [ ] **Step 6: Commit**

```bash
git add src/hooks/useExamTimer.ts src/components/exam/ExamHeader.tsx src/pages/SimuladoExamPage.tsx
git commit -m "feat: timer com aviso em 15min e indicador salvo no header (P3)"
```

---

## Self-Review

### Cobertura da spec

| Bloco | Task | Status |
|-------|------|--------|
| A — Modal move para SimuladosPage | Task 1 | ✅ |
| B1 — Eliminar alternativa visível | Task 2 | ✅ |
| B2 — Alta certeza tooltip | Task 3 | ✅ |
| B3 — Atalhos de teclado | — | ✅ já implementado |
| C — Legenda do navegador | — | ✅ já na sidebar; mobile sheet já tem legenda |
| D — Checklist adaptativo | Task 4 | ✅ |
| E — Aviso fullscreen no checklist | Task 4 | ✅ |
| F — Questões em branco clicáveis | Task 5 | ✅ |
| G — Celebração e CTA condicional | Task 6 | ✅ |
| H — Mini-nav mobile | Task 7 | ✅ |
| P3 — Timer 15min + save indicator | Task 8 | ✅ |

### Consistência de tipos

- `ExamSummary.unansweredIndices: number[]` definido em Task 5 Step 1, usado no SubmitConfirmModal em Task 5 Step 3 ✅
- `ExamCompletedScreen` novas props (`resultsAvailable`, `highConfidenceCount`, `markedForReviewCount`) definidas em Task 6 Step 1, passadas em Task 6 Step 4 ✅
- `SubmitConfirmModal.onNavigateToQuestion` definida em Task 5 Step 2, passada em Task 5 Step 4 ✅
- `ExamHeader.saving` definida em Task 8 Step 3, passada em Task 8 Step 4 ✅

### Sem placeholders

Todas as tasks contêm código completo. ✅
