# Redesign — Ranking "Você primeiro"

**Data:** 2026-06-16
**Escopo:** Refazer a UI/UX da página `/ranking`, priorizando o ranking interno (gamificado e pessoal). Nota de corte é rebaixada (cobertura baixa hoje).
**Status:** aprovado para implementação (pendente revisão do spec)

---

## Contexto e Motivação

A página atual (`RankingPage` → `RankingView`) empilha tudo dentro de **um único card** (`rounded-2xl bg-background p-5`), o que achata o conteúdo numa coluna central sem aproveitar a largura — o `DashboardLayout` já fornece o padding externo (`px-4 md:px-8`), então o card-mãe é redundante. O painel de **nota de corte ("Você passaria?")** ocupa o topo, apesar de a cobertura de cortes ser baixa no momento.

O objetivo é uma experiência **premium e gamificada com foco no aluno** ("Você primeiro"): a colocação pessoal, o percentil e a evolução do aluno dominam o topo; a tabela e a nota de corte são secundárias.

Decisões já tomadas no brainstorm:
- **Direção de layout:** A — "Você primeiro" (hero pessoal domina o topo).
- **Gamificação:** apenas dados atuais + derivados no front. **Sem backend novo, sem migração.**
- **Mecânicas DENTRO:** anel de percentil + posição gigante; "subiu/caiu" por **delta de percentil**; sparkline de evolução de nota.
- **Mecânicas FORA:** pódio top 3; ligas nomeadas (Bronze→Diamante).
- **Nota de corte:** preservada, mas **rebaixada** para seção secundária recolhida.

---

## Achados de Viabilidade (dados)

- `get_user_performance_history` (via `simuladosApi.getUserPerformanceHistory`) retorna **`score_percentage` por simulado**, mas **não** retorna posição/rank. → Sparkline de **nota** é barato (1 RPC já existente).
- O rank/posição vem de `get_ranking_for_simulado` (via `fetchRankingForSimulado`), que retorna `posicao` e `total_candidatos` por participante. → Para o climb por percentil precisamos buscar o ranking do **simulado anterior** 1x (lazy) e extrair a linha do usuário.
- **Limitação conhecida (gotcha PostgREST max-rows=1000):** `get_ranking_for_simulado` devolve um array; se o usuário estiver ranqueado além de 1000, a linha dele pode não vir na página. Para a escala atual (centenas) é seguro. Se o climb não encontrar a linha do usuário, faz fallback silencioso (badge "estreia"/oculto). Um RPC dedicado para "posição de um usuário" resolveria, mas é backend → fora de escopo.

---

## Arquitetura

```
RankingPage (page)
 ├─ useRanking()            → allParticipants, filteredParticipants, currentUser, stats, filtros
 ├─ useRankingEvolution()   → scoreSeries (sparkline) + climb (delta de percentil)   [NOVO]
 └─ <RankingView
        heroStanding={...}   → posição/percentil GLOBAL (de allParticipants)         [NOVO prop]
        heroEvolution={...}  → série + climb                                          [NOVO prop, opcional]
        ...props atuais />

AdminRankingPreviewPage (admin) → <RankingView ...> SEM heroEvolution
                                   (hero estático: anel + posição + nota, sem climb/sparkline)
```

`RankingView` permanece **majoritariamente presentational**. A busca de evolução/climb fica no `RankingPage` (page-level) e é injetada por props — assim o preview admin (que não tem "evolução do aluno" significativa) não dispara essas buscas nem mostra dados enganosos.

---

## Spec Detalhada

### 1. Shell / layout

- **Remover** o wrapper `<div className="rounded-2xl bg-background p-5">` em `RankingView`. O conteúdo passa a ser uma pilha de seções full-width (`space-y-4`/`space-y-5`) dentro do padding que o `DashboardLayout` já dá.
- Manter `PageHeader` no `RankingPage` (título "Ranking", badge "ENAMED 2026").
- Sem `max-w` artificial. Mobile = coluna única; desktop = hero em linha (3 zonas).

### 2. Hero — `RankingHero.tsx` (NOVO)

Card wine sólido na linguagem do projeto (mesma família de `ResultadoPage`/superfícies always-dark):

```css
background: linear-gradient(155deg,#7a1a32 0%,#5c1225 46%,#3d0b18 100%);
border-radius: 22px;
box-shadow: 0 24px 56px -14px rgba(142,31,61,0.6), inset 0 1px 0 rgba(255,255,255,0.08);
```
- Glow orbs (`radial-gradient`, `pointer-events:none`) no canto superior direito e inferior esquerdo.
- Superfície always-dark → `text-white` é correto nos dois temas (ver memória [[dark-mode-superficies-always-dark]]).
- **Topo do hero:** overline "Ranking ENAMED 2026 · {título do simulado}".

**Três zonas (desktop, `md:` em linha; mobile empilhado):**

**Zona A — Anel de percentil + posição (`PercentileRing.tsx`, NOVO):**
- SVG circular: trilha `rgba(255,255,255,0.12)`, arco preenchido conforme percentil em tom âmbar/rosado claro (`#ffbf6b`), `stroke-linecap:round`.
- Centro: **`#{position}`** gigante (`font-weight:700`, ~34px) + "de {total}" pequeno.
- Preenchimento do arco = `(100 - percentil)%` da circunferência (quanto melhor o percentil, mais cheio).
- Count-up animado da posição no mount; arco desenha (dashoffset animado). Respeita `prefers-reduced-motion`.

**Zona B — Colocação + climb:**
- "Sua colocação" (overline) + **"Top {percentil}%"** grande.
- **`ClimbBadge.tsx` (NOVO)** logo abaixo (ver §4).
- Frase de incentivo curta: "Você está à frente de {total - position} candidatos." (sem corte/liga).

**Zona C — Nota + sparkline:**
- Card interno "Sua nota" → **`{score}%`** em `#ffcbd8` + delta "{+/-}N vs média" (verde/vermelho) usando `stats.notaMedia`.
- Card interno "Sua evolução" → **`EvolutionSparkline.tsx`** (ver §5). Some quando não há `heroEvolution` (ex.: admin preview) ou < 2 pontos.

**Fonte do standing (decisão deliberada):** o hero usa o standing **global** (`heroStanding`, derivado de `allParticipants`, recorte "todos"), não o filtrado. Filtros de comparação/segmento afetam a **tabela** abaixo, não a colocação do hero. Isso mantém "Top X%" estável e significativo.

**Estado aspiracional (sem `currentUser`):** quando o aluno ainda não tem resultado no simulado selecionado, o hero mostra anel vazio + "Você ainda não está no ranking" + CTA contextual (ex.: link para o simulado/resultados). Sem climb/sparkline.

### 3. `heroStanding`

Computado no `RankingPage` a partir de `allParticipants`:
```ts
const me = allParticipants.find(p => p.isCurrentUser);
const total = allParticipants.length;
const percentil = clamp(Math.ceil((me.position / total) * 100), 1, 99); // Top X%
heroStanding = me ? { position: me.position, total, percentil, score: me.score } : null;
```
Helper `computePercentile(position, total)` vai para `src/lib/ranking-percentile.ts` (testável). Reusa a mesma fórmula da `RankingStatsRow` atual para consistência. No preview admin (sem `allParticipants` exposto), `RankingView` faz fallback para `currentUser` + `filteredParticipants.length`.

### 4. Climb badge — `ClimbBadge.tsx` (NOVO) + `useRankingEvolution`

**Métrica: delta de percentil** entre o simulado selecionado e o anterior.

`useRankingEvolution.ts` (NOVO hook, React Query, `staleTime` 5min):
1. `getUserPerformanceHistory(userId)` → mapa `simulado_id → { score, finished_at }`.
2. Monta `scoreSeries` ordenado pela ordem de `simuladosWithResults` (por `sequence_number` asc), incluindo só simulados presentes no histórico.
3. `previousSimuladoId` = simulado imediatamente anterior ao `selectedSimuladoId` nessa lista ordenada que exista no histórico.
4. (enabled se houver `previousSimuladoId`) `fetchRankingForSimulado(previousSimuladoId)` → acha a linha do usuário → `prevPercentil = computePercentile(posicao, total_candidatos)`.
5. Retorna `{ scoreSeries, climb, loading }`, onde:
   ```ts
   climb = prevPercentil == null
     ? { kind: 'debut' }
     : { kind: 'delta', prevPercentil, currPercentil, delta: prevPercentil - currPercentil };
   ```

Render do badge:
- `delta > 0` → **subiu**: pill verde (`rgba(74,222,128,*)`), ícone `arrow-up-right`, texto **"Subiu do top {prev}% para o top {curr}%"**.
- `delta < 0` → **caiu**: pill vermelho suave, ícone `arrow-down-right`, "Caiu do top {prev}% para o top {curr}%".
- `delta == 0` → **manteve**: pill neutro, "Você manteve o top {curr}%".
- `kind: 'debut'` → "Sua estreia no ranking" (sem delta).
- Pulso sutil quando subiu; `prefers-reduced-motion` desliga.

### 5. Sparkline — `EvolutionSparkline.tsx` (NOVO)

- SVG `polyline` da `scoreSeries` (nota por simulado, ordem cronológica). Último ponto destacado (círculo).
- Stroke âmbar (`#ffbf6b`) sobre o wine. Sem eixos (é micro-viz). `preserveAspectRatio="none"`, altura fixa (~38px).
- Anima o traçado no mount (stroke-dashoffset) com `prefers-reduced-motion` desligando.
- Renderiza só com ≥ 2 pontos; senão a Zona C mostra só a nota.

### 6. Nota de corte — `RankingCutoffSection.tsx` (NOVO wrapper)

- Move o `RankingApprovalPanel` atual para **depois da tabela** e o envolve numa seção **recolhida por padrão** (`<details>`/disclosure controlado).
- Cabeçalho da seção (sempre visível): "Você passaria?" + resumo curto quando disponível ("{reached} de {N} instituições alcançadas") + chevron expandir.
- Expandido: renderiza o `RankingApprovalPanel` **sem alterações de lógica** (régua, lista por instituição, link "ver tabela completa" → `CutoffScoreModal`).
- Estados `no_profile`/`loading`/`ready` preservados. Quando `showApprovalPanel={false}` (admin), a seção inteira não renderiza (comportamento atual).

### 7. Tabela — `RankingTable.tsx`

- Mantém a mecânica atual (`buildTableRows`: top 10 → separador "posições X–Y" → vizinhos ±2 → você; sticky bar wine no rodapé).
- Restyle premium e **full-width** (remoção do card-mãe ajuda). Mantém anonimização via `participantLabel` (`Candidato #N`).
- `PositionBadge` mantém medalhas 1/2/3 e destaque do usuário.

### 8. Filtros + seletor de simulado

- `RankingSimuladoSelector` e `RankingFilterBar` mantidos (comparar por especialidade/instituição; segmento). Restyle leve para casar com o hero. Lógica de filtros, analytics (`trackEvent`) e `usePersistedState` **inalterados**.
- Atenção ao gotcha [[tailwind-opacity-on-var-gotcha]] ao estilizar pills no dark (evitar `bg-[var(--x)]/40`).

### 9. Remoções / migrações

- **Remover** `RankingStatsRow.tsx` — suas 3 KPIs (posição, percentil, vs média) são **absorvidas pelo hero**. Migrar a fórmula de percentil para `ranking-percentile.ts`.
- **Remover** o wrapper `rounded-2xl bg-background p-5` em `RankingView`.

### 10. Ordem final das seções em `RankingView`

1. `toolbar` (admin) — quando passado
2. `RankingSimuladoSelector` (quando > 1 simulado)
3. **`RankingHero`** (com `currentUser`) ou hero aspiracional
4. `RankingLowConfidenceBanner` (quando < 30 participantes)
5. `RankingFilterBar`
6. `RankingTable`
7. **`RankingCutoffSection`** (recolhida) — quando `showApprovalPanel !== false`
8. `CutoffScoreModal` (montado, controlado por estado)

### 11. Responsividade

- **Mobile:** hero em coluna única (anel centralizado no topo → colocação+climb → nota+sparkline). Tabela em 3 colunas (`# | Candidato | Nota`). Filtros em wrap.
- **Desktop (`md:`):** hero em linha (3 zonas). Tabela em 5 colunas (`# | Candidato | Especialidade | Instituição | Nota`).

### 12. Acessibilidade

- Anel: `role="img"` + `aria-label="{position}ª posição de {total} — top {percentil}%"`.
- Climb badge: texto semântico (não depende só de cor).
- Sparkline: `role="img"` + `aria-label` descrevendo a tendência ("nota subindo de X% para Y%").
- `RankingCutoffSection`: disclosure com `aria-expanded`/`aria-controls`.
- Todas as animações sob `prefers-reduced-motion` (via `useReducedMotion` do framer).
- Atenção ao gotcha [[framer-whileinview-zero-area-gotcha]] no traçado do sparkline/anel (largura 0% não dispara whileInView — animar via estado/mount, não whileInView).

---

## Contrato de Props (RankingView — adições)

```ts
interface RankingViewProps {
  // ...props atuais inalterados...
  /** Standing GLOBAL para o hero (de allParticipants). Ausente → fallback p/ currentUser+filtered. */
  heroStanding?: { position: number; total: number; percentil: number; score: number } | null;
  /** Série de evolução + climb. Ausente (ex.: admin) → hero sem sparkline/climb. */
  heroEvolution?: {
    scoreSeries: number[];
    climb:
      | { kind: 'debut' }
      | { kind: 'delta'; prevPercentil: number; currPercentil: number; delta: number };
  } | null;
}
```
Ambas opcionais → **`AdminRankingPreviewPage` não muda** (não passa nenhuma; hero renderiza estático).

---

## Arquivos a criar/modificar

| Arquivo | Natureza |
|---------|----------|
| `src/components/ranking/RankingHero.tsx` | **Criar** — hero wine (3 zonas) |
| `src/components/ranking/PercentileRing.tsx` | **Criar** — anel SVG + posição + count-up |
| `src/components/ranking/EvolutionSparkline.tsx` | **Criar** — sparkline de nota |
| `src/components/ranking/ClimbBadge.tsx` | **Criar** — badge subiu/caiu/manteve/estreia |
| `src/components/ranking/RankingCutoffSection.tsx` | **Criar** — wrapper recolhível do approval panel |
| `src/hooks/useRankingEvolution.ts` | **Criar** — série + climb (React Query) |
| `src/lib/ranking-percentile.ts` | **Criar** — `computePercentile`, helpers de climb (puro, testável) |
| `src/lib/ranking-percentile.test.ts` | **Criar** — testes unitários |
| `src/components/ranking/RankingView.tsx` | **Modificar** — remover wrapper, nova ordem, hero, props novas |
| `src/pages/RankingPage.tsx` | **Modificar** — chamar `useRankingEvolution`, computar `heroStanding`, passar props |
| `src/components/ranking/RankingStatsRow.tsx` | **Remover** — absorvido pelo hero |
| `src/components/ranking/RankingView.test.tsx` | **Modificar** — refletir nova estrutura |
| `src/services/rankingApi.ts` | **Modificar (mínimo)** — helper p/ extrair linha do usuário, se útil |

`AdminRankingPreviewPage.tsx` / `useRankingAdminPreview.ts`: **sem mudanças** (contrato preservado).

---

## Testes

- `ranking-percentile.test.ts`: `computePercentile` (bordas 1/99, clamp, total=0), cálculo de `delta` e `kind` do climb (subiu/caiu/manteve/debut).
- `RankingView.test.tsx`: renderiza hero com `currentUser`; renderiza estado aspiracional sem `currentUser`; cutoff section recolhida por padrão; admin preview (sem `heroEvolution`) não mostra sparkline/climb.
- Rodar `npm run test` e `npm run lint` ao final.

---

## Fora de escopo (explícito)

- Pódio top 3 e ligas nomeadas (decidido fora).
- Qualquer migração Supabase / novo RPC.
- Persistência de XP/streak/conquistas.
