# Spec: Redesign da tela /simulados

**Data:** 2026-04-01
**Escopo:** Visual — sem alteração de lógica, rotas, contratos de dados ou copy funcional.
**Arquivos-alvo:** `src/pages/SimuladosPage.tsx`, `src/components/SimuladoCard.tsx` (substituído por componentes novos inline ou em arquivo dedicado).

---

## Objetivo

Reinventar a UI de `/simulados` para nível premium alto, mantendo exatamente as mesmas informações, copys e jornada do usuário (acessar simulado para fazer, ver feitos, ver próximos).

---

## Estrutura de layout

### 1. PageHeader
Sem mudança de conteúdo. Título "Simulados", subtítulo existente, badge "ENAMED 2026".

### 2. Card "Como funciona" — redesenhado
- Card branco com fio de cor wine no topo (`2px` linear-gradient `#8e1f3d → transparent`).
- Ícone premium `Info` (Lucide) em quadrado arredondado com fill `rgba(142,31,61,.12)` e borda `rgba(142,31,61,.18)`.
- Título bold + descrição existente.
- Pills de regras-chave: "Não é possível pausar", "Resultado liberado após a janela", "Ranking disponível após encerramento".
- Box-shadow sutil wine.

### 3. Hero card — simulado principal
Card dark premium full-width, border-radius 24px, com três camadas atmosféricas (dois glows radiais + overlay radial lateral) e fio branco translúcido no topo.

**Estado 1 — Janela aberta (`available` ou `in_progress`)**
- Gradient: `142deg, #5a1530 → #2e0c1e → #160610`.
- Borda: `rgba(232,56,98,.28)`.
- Status badge: dot pulsante wine (`@keyframes pulse`) + label "Janela aberta" ou "Em andamento".
- Badge `#N` (sequenceNumber) no canto direito — quadrado arredondado translúcido.
- Título, meta-row com ícone Calendar + datas + quantidade de questões.
- CTAs: `btn-primary` ("Iniciar Simulado" com ícone Play, ou "Continuar Simulado") + `btn-secondary` ("Como funciona").
- Ticker de deadline: `<Clock>` + "Janela fecha em X dias e Yh — realize agora para entrar no ranking" — fundo `rgba(232,56,98,.1)`, borda `rgba(232,56,98,.18)`.

**Estado 2 — Sem ativo, próximo simulado (`upcoming` mais próximo)**
- Gradient: `142deg, #3d0d22 → #220810 → #120408` — mesmo wine, mais escuro/apagado.
- Borda: `rgba(142,31,61,.3)`.
- Glows wine subdued (não vermelhos vivos).
- Status badge: anel vazio wine-rosa + "Em breve".
- Título, meta-row com ícone Calendar + data de abertura.
- Countdown em blocos numéricos (dias / horas / min) — `background rgba(255,255,255,.06)`, borda `rgba(255,255,255,.08)`.
- CTA desabilitado: ícone Lock + "Ainda não disponível".
- Info row: ícone Clock + "Liberado automaticamente em DD/MM às 00:00".

**Estado 3 — Sem ativo e sem upcoming (edge case)**
- Hero não renderiza. Exibe diretamente a timeline com `EmptyState` inline ao topo.

---

## Timeline vertical — abaixo do hero

Section label "Histórico e próximos" com regra decorativa à direita. Nota auxiliar: "Mais recente primeiro · clique para ver detalhes".

**Spine:** linha vertical `1.5px` com gradiente `rgba(142,31,61,.35) → rgba(142,31,61,.04)`.

**Ordenação:** `closed_waiting` e `completed` e `available_late` por data desc (mais recente primeiro), depois `upcoming` restantes (os que não estão no hero) ao final.

### Nós e cards por status

| Status | Nó | Card background | Status label color |
|--------|----|-----------------|--------------------|
| `in_progress` | dot wine pulsante | `rgba(255,248,250,.9)` + borda wine suave | wine `#e83862` |
| `closed_waiting` | dot âmbar | `rgba(252,248,238,.8)` + borda âmbar | âmbar `#a07018` |
| `completed` | dot branco translúcido | `#fff` + sombra sutil | verde `#2d8f5a` |
| `available_late` | dot ghost (7×7) | `rgba(244,241,245,.55)` opacity `.6` | muted `#9e7a8e` |
| `upcoming` (restantes) | dot wine-rosa suave | `rgba(60,15,32,.45)` + borda `rgba(142,31,61,.2)` | rosa-vinho `rgba(220,140,170,.75)` |

**Conteúdo de cada card:**
- Status label com ícone Lucide (Play, Lock, Check, Clock, Coffee) + texto uppercase.
- Título do simulado + data + `#sequenceNumber`.
- Lado direito:
  - `completed`: score em destaque (`20px font-weight:900 color:#8e1f3d`) + CTA "Ver resultado →"
  - `in_progress`: CTA "Continuar →"
  - `closed_waiting`: ícone Lock + "Aguardando"
  - `available_late`: CTA "Treinar →" + tag "Disponível como treino · não entra no ranking"
  - `upcoming`: CTA "Agenda →"

**Rodapé da timeline:** link "Ver todos os anteriores" com ícone ChevronDown — inicialmente lista os 5 mais recentes, expandindo ao clicar (estado local no componente).

---

## Ícones

Todos Lucide (`lucide-react`), sem emojis. Mapa de uso:

| Contexto | Ícone |
|----------|-------|
| Como funciona | `Info` |
| CTA Iniciar/Continuar | `Play` |
| Ainda não disponível / Aguardando | `Lock` |
| Concluído | `CheckCircle2` |
| Em andamento | `Play` |
| Fora da janela | `Coffee` |
| Em breve | `Clock` |
| Deadline ticker | `Clock` |
| Data | `Calendar` |
| Ver todos | `ChevronDown` |
| CTAs com seta | `ArrowRight` |

---

## Animações (Framer Motion)

- `useReducedMotion` respeita preferência do sistema — sem animações se ativo.
- Hero card: `initial={{ opacity:0, y:16 }} animate={{ opacity:1, y:0 }}` com `duration:0.5`.
- "Como funciona": `delay:0.05`.
- Timeline items: stagger `delay: index * 0.04`, `duration:0.4`, `y:10 → 0`.
- Dot pulsante: `@keyframes` CSS puro (não Framer) para não bloquear thread.

---

## Estados de loading e erro

- Loading: skeleton de altura fixa para o hero (h-[220px] rounded-[24px]) + 3 skeleton cards na timeline.
- Erro: `EmptyState variant="error"` existente — sem mudança.
- Nenhum simulado: `EmptyState` existente — sem mudança.

---

## Responsividade

- Hero: padding menor em mobile (`p-5 md:p-6`), título `text-[20px] md:text-[22px]`.
- Countdown blocks: gap reduzido em mobile.
- Timeline: padding-left reduzido em mobile, cards com padding menor.
- "Como funciona" pills: `flex-wrap`.
- Nenhuma mudança de layout estrutural — coluna única em todos os breakpoints.

---

## Arquivos impactados

| Arquivo | Mudança |
|---------|---------|
| `src/pages/SimuladosPage.tsx` | Reescrita completa da UI — mantém mesmos hooks/dados |
| `src/components/SimuladoCard.tsx` | Não alterado (componente existente não é mais usado diretamente na listagem) |

> `SimuladoCard.tsx` não é removido — pode ser usado em outros contextos. Os novos componentes (`HeroCard`, `TimelineItem`) vivem inline em `SimuladosPage.tsx` por ora, extraíveis depois se necessário.

---

## Fora de escopo

- Nenhuma mudança em hooks (`useSimulados`), tipos, rotas ou lógica de negócio.
- Nenhum novo estado de dados.
- Nenhuma alteração em outras telas.
- Nenhum novo arquivo de componente obrigatório (tudo inline em `SimuladosPage.tsx`).
