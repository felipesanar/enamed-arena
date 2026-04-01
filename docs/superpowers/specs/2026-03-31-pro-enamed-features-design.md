# Design — PRO ENAMED: UX/UI Features

**Data:** 2026-03-31
**Status:** Aprovado
**Escopo:** Login page, SimuladoCard, HomePagePremium, RankingPage

---

## 1. Login Page

### 1a. BrandLockup — LogoPro placeholder

**O que muda:** O bloco de marca no topo do formulário de login passa de ícone + texto simples para um lockup horizontal que serve de placeholder visual para o logo definitivo do PRO ENAMED.

**Componente:** `BrandLockup` dentro de `src/pages/LoginPage.tsx`

**Novo layout:**
```
┌─────────────────────────────────┐
│  [quadrado gradiente roxo "P"]  SanarFlix  │
│                                 PRO ENAMED │
└─────────────────────────────────┘
```
- Container: `inline-flex`, fundo `#1e293b`, borda `#334155`, border-radius 12px, padding `10px 16px`
- Ícone: 32×32px, `linear-gradient(135deg, #7c3aed, #a855f7)`, border-radius 8px, letra **P** branca bold
- Texto superior: "SanarFlix" em `#c4b5fd`, 9px, uppercase, letter-spacing 0.14em
- Texto inferior: "PRO ENAMED" em `#f1f5f9`, 15px, font-weight 700
- Nota: substituir pelo asset real quando disponível; componente chamado `LogoPro`

### 1b. AuthShell — copy atualizado

| Prop | Antes | Depois |
|------|-------|--------|
| `heroEyebrow` | "Entrada Premium SanarFlix" | "PRO ENAMED" |
| `heroTitle` | "Preparação para o ENAMED, com direção." | "Simulados para o ENAMED, com direção" |
| `heroSubtitle` | "Entre e continue de onde parou." | "Entre, realize os simulados e compare seu desempenho no ranking nacional." |

Atualizar também `MobileHeaderAndHero` com o mesmo copy.

---

## 2. SimuladoCard

### 2a. Ordenação — mais recente primeiro

`simuladosApi.listSimulados()` em `src/services/simuladosApi.ts`:

```ts
// antes
.order('sequence_number', { ascending: true })

// depois
.order('sequence_number', { ascending: false })
```

### 2b. Bloqueio para usuários não-PRO

**Novas props em `SimuladoCard`:**
```ts
isLocked: boolean
worstArea?: string | null
```

**Comportamento quando `isLocked = true`:**
- Wrapper: `div` clicável (não `Link`) com `onClick` que abre `PRO_ENAMED_URL` em nova aba
- Opacidade do card: `0.65`
- Badge adicional no cabeçalho ao lado do status: `🔒 PRO` (fundo `#7c3aed25`, texto `#c4b5fd`, borda `#7c3aed40`)
- CTA substitui botão "Iniciar Simulado →" por texto desabilitado: `🔒 Disponível apenas para Aluno PRO` (fundo `#1e293b`, texto `#94a3b8`)
- `PRO_ENAMED_URL = "https://sanarflix.com.br/sanarflix-pro-enamed"` (constante no topo do arquivo ou em `src/lib/constants.ts`)

**Comportamento quando `isLocked = false`:**
- Comportamento atual preservado (sem alterações)

### 2c. Badge de grande área — pior desempenho global

**Badge vermelho** exibido abaixo da data, apenas quando `worstArea` está preenchido:
```
📌  Foco: Clínica Médica
```
- Fundo `#ef444415`, borda `#ef444430`, texto `#fca5a5`, font-size 11px
- Não aparece quando `worstArea` é `null` (usuário sem histórico)

**Origem do dado — computado em `SimuladosPage`:**
1. `useUserPerformance()` → `summary.last_simulado_id`
2. `useSimuladoDetail(last_simulado_id)` + `useExamResult(last_simulado_id)` (mesmo padrão de `DesempenhoPage`)
3. `computePerformanceBreakdown(examState, questions)` → `byArea[]` ordenado melhor→pior
4. `worstArea = byArea[byArea.length - 1]?.area ?? null`
5. Valor único passado como prop para **todos** os cards (é o pior desempenho global do usuário, não por simulado)

**Condição de renderização em `SimuladosPage`:**
```ts
const isLocked = segment !== 'pro'
// worstArea só é computado se !isLocked && last_simulado_id existe
```

---

## 3. HomePagePremium — "Seu caminho até aqui"

**Componente:** `HeroPerformanceCard` dentro de `src/components/premium/home/HomePagePremium.tsx`

### 3a. Label de ranking com segmento

**Nova prop:** `segmentFilter: SegmentFilter` (já disponível em `useRanking()`, só precisa ser passada)

**Mapeamento de label:**
```ts
const SEGMENT_LABEL: Record<SegmentFilter, string> = {
  all: 'Geral',
  sanarflix: 'Aluno SanarFlix',
  pro: 'Aluno PRO',
}
```

**Label atualizado** (linha do snapshot de ranking):
```
// antes: `Simulado: ${rankingTitle}`
// depois: `${rankingTitle} · ${SEGMENT_LABEL[segmentFilter]}`
```
Só exibido quando `rankingTitle` existe.

### 3b. Empty state — sem ranking configurado

**Condição:** `!selectedSimuladoId && rankPosition === null`

Substitui o bloco de snapshot de ranking por:
```
┌─────────────────────────────────────────┐
│  Veja como você está no ranking         │
│  Acesse a aba Ranking para escolher um  │
│  simulado e ver sua posição entre os    │
│  participantes.                         │
│                                         │
│  [  Ir para o Ranking →  ]              │
└─────────────────────────────────────────┘
```
- CTA: `Link to="/ranking"`, fundo `rgba(232,56,98,0.15)`, borda `rgba(232,56,98,0.3)`, texto `#e83862`

---

## 4. RankingPage — Filtros

**Arquivo:** `src/pages/RankingPage.tsx`

### 4a. Segmento — visibilidade por tipo de usuário

Importar `useUser` (ou `useSegment`) para obter `segment`. Filtrar as opções do segmento antes de renderizar:

```ts
const SEGMENT_OPTIONS: Array<{ key: SegmentFilter; label: string }> = [
  { key: 'all',       label: 'Todos' },
  { key: 'sanarflix', label: 'Aluno SanarFlix' },
  { key: 'pro',       label: 'Aluno PRO' },
]

const allowedSegments = useMemo((): SegmentFilter[] => {
  if (segment === 'pro')      return ['all', 'sanarflix', 'pro']
  if (segment === 'standard') return ['all', 'sanarflix']
  return ['all']   // guest
}, [segment])

const visibleSegmentOptions = SEGMENT_OPTIONS.filter(o => allowedSegments.includes(o.key))
```

**Reset automático:** `useEffect` que observa `allowedSegments` — se `segmentFilter` não está na lista permitida, chama `setSegmentFilter('all')`.

**Ícones por opção:**
- `all` → `Globe`
- `sanarflix` → `Users`
- `pro` → `Crown` (com cor `#c4b5fd` quando inativo)

> `Globe` e `Crown` não estão nos imports atuais de `RankingPage.tsx` — adicionar ao import do lucide-react junto com os existentes.

### 4b. Instituição como sub-filtro de Especialidade

**Row principal de comparação:** exibe apenas `'all'` e `'same_specialty'`.

O botão de "Especialidade" é considerado **ativo visualmente** quando `comparisonFilter === 'same_specialty' || comparisonFilter === 'same_institution'`.

**Sub-filtro** (renderizado apenas quando `comparisonFilter !== 'all'`):
```tsx
{comparisonFilter !== 'all' && (
  <div className="border-t border-border pt-3 flex items-center gap-2">
    <span className="text-caption text-muted-foreground">Restringir à:</span>
    <button
      onClick={() =>
        setComparisonFilter(
          comparisonFilter === 'same_institution' ? 'same_specialty' : 'same_institution'
        )
      }
      disabled={userInstitutions.length === 0}
      className={cn(...)}
    >
      <Building className="h-3.5 w-3.5" />
      <span>{userInstitutions[0] || 'Instituição'}</span>
    </button>
  </div>
)}
```

**Clicar em "Todos"** → `setComparisonFilter('all')` (comportamento atual preservado).
`ComparisonFilter` type e `useRanking` hook ficam **intactos**.

---

## Arquivos modificados

| Arquivo | Mudança |
|---------|---------|
| `src/pages/LoginPage.tsx` | `LogoPro` component, heroEyebrow/Title/Subtitle, MobileHeaderAndHero copy |
| `src/services/simuladosApi.ts` | `ascending: false` em `listSimulados()` |
| `src/components/SimuladoCard.tsx` | Props `isLocked`, `worstArea`; lógica de bloqueio e badge |
| `src/pages/SimuladosPage.tsx` | Computa `isLocked` e `worstArea`; passa para todos os cards |
| `src/components/premium/home/HomePagePremium.tsx` | Passa `segmentFilter` para `HeroPerformanceCard`; label com segmento; empty state |
| `src/pages/RankingPage.tsx` | Filtragem de segmentos por tipo de usuário; instituição como sub-filtro |
