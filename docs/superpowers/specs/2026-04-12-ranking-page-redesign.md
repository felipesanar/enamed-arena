# Redesign — Tela de Ranking

**Data:** 2026-04-12
**Escopo:** `src/components/ranking/RankingView.tsx`, `src/services/rankingApi.ts`, novo hook `src/hooks/useCutoffScore.ts`
**Status:** aprovado para implementação

---

## Contexto e Motivação

A tela de Ranking (`/ranking`) é onde o aluno compara seu desempenho após a liberação dos resultados. A UI atual é funcional mas sem vida: hero card genérico, tabela densa, sem feedback personalizado sobre onde o aluno está nem se passaria no vestibular de residência.

O objetivo é transformar essa tela numa experiência premium de reconhecimento de esforço, com contexto imediato de posição, desempenho relativo e nota de corte.

---

## Decisões de Design

- **Hero card:** wine sólido (mesma linguagem de `ResultadoPage`)
- **KPI cards:** gradientes coloridos por estado, glow orbs, sem abreviações anglófonas
- **Layout de tabela:** lista contínua (sem paginação) — top 10 + separador + vizinhos ±2 + linha do usuário + sticky bar no rodapé
- **Responsividade:** mobile (coluna única) e desktop (hero + KPIs lado a lado; tabela com colunas extras)

---

## Spec Detalhada

### 1. Hero Card (wine sólido)

Idêntico ao hero de `ResultadoPage` em linguagem visual:

```css
background: linear-gradient(155deg, #7a1a32 0%, #5c1225 45%, #3d0b18 100%);
border-radius: 22px;
box-shadow: 0 24px 56px -14px rgba(142,31,61,0.65), inset 0 1px 0 rgba(255,255,255,0.08);
```

Glow orb: `position: absolute; top: -50px; right: -50px; width: 200px; height: 200px; background: radial-gradient(circle, rgba(255,255,255,0.06) 0%, transparent 70%)`.

**Conteúdo (mobile — linha única horizontal):**
- Esquerda: ícone Trophy em badge `rgba(255,255,255,0.12)` 46×46px + label "Sua posição" + `#42 de 318`
- Direita: label "Sua nota" + score `color: #ffcbd8` + "Média: 61%" + delta `▲ +7pp acima` em `rgba(74,222,128,0.7)`

**Delta:** `(currentUser.score - stats.notaMedia)` — prefixo `▲` quando positivo (`rgba(74,222,128,0.7)`), `▼` quando negativo (`rgba(248,113,113,0.7)`).

**Desktop:** hero ocupa metade esquerda do grid 2 colunas; posição em `font-size: 3rem`; score em `font-size: 2.2rem`; delta embaixo.

Exibido apenas quando `currentUser` existe. Quando não há attempt/resultado do usuário, o hero não aparece (mantém comportamento atual).

---

### 2. KPI Cards (2 cards lado a lado)

Exibidos apenas quando `currentUser` existe. Grid `grid-cols-2 gap-2.5 mb-2.5`.

Cada card tem:
- `border-radius: 18px; padding: 15px 13px 13px; position: relative; overflow: hidden`
- Glow orb no canto superior direito: `position: absolute; top: -28px; right: -28px; width: 90px; height: 90px; border-radius: 50%`
- Pseudo-elemento `::before` com textura grain sutil (SVG data URL)

#### Card 1 — Desempenho

Calcula `percentil = Math.round(currentUser.position / filteredParticipants.length * 100)`.

| Percentil | Estado | Cor do card | Mensagem |
|-----------|--------|------------|---------|
| ≤ 25 | bom | green `rgba(34,197,94,0.14)` border `rgba(34,197,94,0.25)` | "Entre os melhores 🏆" |
| 26–50 | médio-bom | green (mesma) | "Acima da média 💪" |
| 51–75 | médio | orange `rgba(251,146,60,0.1)` border `rgba(251,146,60,0.2)` | "Em desenvolvimento 💪" |
| > 75 | fraco | orange (mesmo) | "Em desenvolvimento 💪" |

Subtexto sempre: `"Você está no {percentil}º percentil — acima de {100 - percentil}% dos candidatos."` (para bom) ou `"Você está abaixo de {percentil}% dos candidatos — tudo bem, é aqui que começa a virada!"` (para fraco/médio).

Glow orb: verde para bom, laranja para fraco.

#### Card 2 — Nota de Corte

**Busca:** `useCutoffScore(userSpecialty, userInstitutions[0])` (ver seção 4).

**Estado: sem perfil** (`!userSpecialty || !userInstitutions[0]`):
```
background: rgba(255,255,255,0.04)
border: 1px solid rgba(255,255,255,0.09)
```
Conteúdo: ícone 🎯 + "Preencha sua especialidade e instituição para ver se você passaria." + link "Completar perfil →" apontando para `/configuracoes`.

**Estado: match encontrado + passa** (`currentUser.score >= cutoff.cutoff_score_general`):
```
background: linear-gradient(135deg, rgba(99,179,237,0.12) 0%, rgba(139,92,246,0.06) 100%)
border: 1px solid rgba(99,179,237,0.22)
```
Valor: `"Passaria ✓"` em `#7dd3fc`
Sub: `"Corte geral: {X}% · Cotas: {Y}%"` (cotas só se `cutoff_score_quota != null`)
Link: `"Ver todas as notas ↗"` — abre modal (ver seção 5).

**Estado: match encontrado + não passa** (`currentUser.score < cutoff.cutoff_score_general`):
```
background: linear-gradient(135deg, rgba(239,68,68,0.10) 0%, rgba(220,38,38,0.05) 100%)
border: 1px solid rgba(239,68,68,0.20)
```
Valor: `"Ainda não ✗"` em `#f87171`
Sub: `"Faltam {corte - score}pp para o corte geral de {X}%"`
Link: `"Ver todas as notas ↗"`

**Estado: sem match** (especialidade/instituição não está na tabela):
Mesma aparência do estado "sem perfil" mas com texto: "Não encontramos nota de corte para sua combinação. Ver todas →" apontando para o modal.

---

### 3. Banner de Baixa Confiabilidade

Exibido quando `filteredParticipants.length < 30`, acima dos filtros.

```
background: rgba(251,146,60,0.07)
border: 1px solid rgba(251,146,60,0.22)
border-radius: 13px; padding: 11px 13px
```

Ícone ⚠️ + texto: **"Ranking com poucos participantes"** — com menos de 30 candidatos, os resultados podem não refletir o desempenho real. Consulte a [nota de corte oficial →] (abre modal da seção 5).

---

### 4. Hook `useCutoffScore`

**Arquivo:** `src/hooks/useCutoffScore.ts`

```typescript
export interface CutoffScoreResult {
  loading: boolean;
  cutoff: {
    institution_name: string;
    practice_scenario: string;
    specialty_name: string;
    cutoff_score_general: number;
    cutoff_score_quota: number | null;
  } | null;
}

export function useCutoffScore(specialty: string, institution: string): CutoffScoreResult
```

Faz query em `enamed_cutoff_scores` filtrando por `specialty_name` e `institution_name` com normalização (trim + lowercase + ilike). Usa React Query com `staleTime: Infinity` (dados estáticos). Retorna o primeiro resultado encontrado ou `null`.

**Função de busca em `rankingApi.ts`:**
```typescript
export async function fetchCutoffScore(
  specialty: string,
  institution: string,
): Promise<CutoffScoreRow | null>
```

Query: `supabase.from('enamed_cutoff_scores').select('*').ilike('specialty_name', specialty.trim()).ilike('institution_name', `%${institution.trim()}%`).maybeSingle()`.

---

### 5. Modal de Notas de Corte

Componente: `src/components/ranking/CutoffScoreModal.tsx`

Disparado pelo link "Ver todas as notas ↗" nos KPI cards e no banner.

- Overlays com `backdrop-filter: blur(8px); background: rgba(0,0,0,0.6)`
- Card central wine escuro `border-radius: 20px; padding: 24px`
- Cabeçalho: título "Notas de Corte ENAMED" + botão fechar ✕
- Se `userSpecialty` preenchida: mostra primeiro as linhas da especialidade do usuário destacadas; abaixo, todas as demais
- Colunas: Instituição, Especialidade, Corte geral, Corte cotas
- Se `cutoff_score_quota == null`: exibe "—"
- Scroll interno; mobile-friendly

Busca todos os registros via `fetchAllCutoffScores()` (nova função em `rankingApi.ts` que faz `select('*').order('institution_name').order('specialty_name')`).

---

### 6. Tabela Reestruturada

Substitui a tabela atual por layout de cards de linha (dark glass). Remove `PremiumCard` wrapper externo.

**Estrutura:**
```
Container: background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07); border-radius: 15px; overflow: hidden
```

**Header de colunas:**
- Mobile: `# | Candidato | Nota`
- Desktop: `# | Candidato | Especialidade | Instituição | Nota`

**Badges de posição:**
- #1: `bg: rgba(251,191,36,0.15) color: #fbbf24`
- #2: `bg: rgba(156,163,175,0.15) color: #9ca3af`
- #3: `bg: rgba(180,83,9,0.15) color: #d97706`
- Demais: `bg: rgba(255,255,255,0.07) color: rgba(255,255,255,0.45)`
- Usuário: `bg: rgba(255,150,170,0.15) color: #ff9ab0`

**Linha do usuário:** `background: rgba(122,26,50,0.28)`, nome em `#fff font-weight: 600`, score em `#ffcbd8`, badge "Você" wine.

**Ordem de exibição:**
1. Posições 1–10 (sempre)
2. Separador: `"posições {11} – {currentUser.position - 3}"` (só se gap > 3)
3. Vizinhos acima: posições `[currentUser.position - 2, currentUser.position - 1]`
4. Linha do usuário
5. Vizinhos abaixo: posições `[currentUser.position + 1, currentUser.position + 2]`

Se o usuário está no top 10: sem separador, linha simplesmente destacada inline.
Se não há `currentUser`: exibe todos os participantes (comportamento atual de lista completa).

**Sticky bar** (rodapé do container, sempre visível):
```
background: linear-gradient(135deg, rgba(122,26,50,0.72), rgba(60,12,24,0.82))
border-top: 1px solid rgba(255,150,170,0.14)
```
Conteúdo: "Sua posição" label + `#N de M` + score.
Só exibida quando `currentUser` existe.

**Anonimização:** já implementada via `participantLabel()`. Confirmar que está ativa em `participantDisplay="public"` — outros usuários aparecem como "Candidato #N". ✓ (já funciona, manter sem mudança).

---

### 7. Responsividade

**Mobile** (padrão, `max-width` sem breakpoint):
- Hero card full width
- KPI cards: `grid-cols-2`
- Tabela: 3 colunas (`# | Candidato | Nota`)
- Filtros: chips em wrap

**Desktop** (`md:` breakpoint, ≥ 768px):
- Top section: `grid-cols-2` — hero à esquerda, KPI cards empilhados à direita
- Tabela: 5 colunas (`# | Candidato | Especialidade | Instituição | Nota`)
- Hero com fonte maior (`text-5xl` para posição, `text-4xl` para score)

---

### 8. Remoções

- `SectionHeader` "Ranking Completo" — removido (o header da tabela é suficiente)
- `PremiumCard` wrapper da tabela — substituído pelo container custom
- `PremiumCard` wrapper do hero atual — substituído pelo novo hero wine
- `PremiumCard` do filtro — substituído pelo `filter-bar` glass
- `SimuladoResultNav` dentro de `RankingView` — removido (não faz sentido semântico no ranking)

---

### 9. Elementos Mantidos

- Toda a lógica de filtros (comparação, segmento, especialidade, instituição) — sem mudanças
- `useRanking` hook — sem mudanças
- Analytics (`trackEvent`) — sem mudanças
- Seletor de simulados (chips de simulados quando há mais de um) — mantido, reestilizado com chips wine
- `PageHeader` — removido da `RankingView`, mantido no `RankingPage` wrapper (ou removido também se a nova UI dispensar)
- `EmptyState` para ranking sem participantes — mantido

---

## Arquivos a modificar/criar

| Arquivo | Natureza |
|---------|----------|
| `src/components/ranking/RankingView.tsx` | Modificar — toda a UI |
| `src/services/rankingApi.ts` | Modificar — adicionar `fetchCutoffScore`, `fetchAllCutoffScores` |
| `src/hooks/useCutoffScore.ts` | Criar — hook de busca de nota de corte |
| `src/components/ranking/CutoffScoreModal.tsx` | Criar — modal de notas de corte |

---

## Acessibilidade

- Hero card: `aria-label` na posição e score
- KPI cards: conteúdo textual semântico (não depende só de cor)
- Modal: `role="dialog"`, `aria-modal="true"`, foco gerenciado, `Esc` para fechar
- Sticky bar: `aria-hidden="true"` (informação duplicada já visível na tabela)
- Badges de medalha: `aria-label="1º lugar"` etc.
