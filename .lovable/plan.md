## Objetivo

1. Corrigir os erros de build de TypeScript no módulo admin (surgiram após a regeração do `types.ts`).
2. Ajustar a página de Flashcards: colocar as estatísticas (Total / Decks / Para hoje) na mesma linha do título, à direita; e reduzir um pouco a altura dos painéis "Estudar" e "Criar".

---

## Parte 1 — Corrigir erros de build

### a) Tabelas admin (`AuditLogRow`, `SegmentBreakdownRow`)
O componente `AdminDataTable` exige `T extends Record<string, unknown>`. `interface` em TS não satisfaz essa restrição, mas um `type` (alias de objeto) satisfaz.

- Em `src/admin/types.ts`: converter `export interface AuditLogRow {...}` e `export interface SegmentBreakdownRow {...}` para `export type AuditLogRow = {...}` e `export type SegmentBreakdownRow = {...}` (mesmos campos, só troca `interface` → `type =`).
- Resolve `AdminAuditoria.tsx(192)` e `AdminInteligencia.tsx(415)`.

### b) Argumentos de RPC com `string | null` (`src/admin/services/adminApi.ts`)
Os tipos gerados passaram a recusar `null` nos argumentos. Os RPCs de filtro usam `IS NULL` para "todos", então é preciso **manter o `null` em runtime** — a correção é apenas de tipo, com cast `as string`:

- L594 `getPerformanceByArea`: `p_simulado_id: simuladoId as string` (idem `p_segment` já é string).
- L600 `getPerformanceByTheme`: `p_simulado_id: simuladoId as string`, `p_area: area as string`.
- L606 `getScoreDistribution`: `p_simulado_id: simuladoId as string`.
- L662–665 `updateQuestion`: `p_explanation`, `p_image_url`, `p_explanation_image_url`, `p_image_url_2` recebem `... as string` (preserva o envio de `null` quando o campo é limpo).

### c) Cast do retorno de questões (L640)
`admin_get_simulado_questions` retorna `options` como `Json`, incompatível com `AdminQuestionOption[]`. Corrigir o cast para passar por `unknown`:
- `return (data ?? []) as unknown as AdminQuestionFull[]`.

Nenhuma alteração em `src/integrations/supabase/types.ts` (arquivo gerado).

---

## Parte 2 — Layout da página de Flashcards

### a) Stats na mesma linha do título (à direita)
No `PageHeaderPremium` (desktop), hoje o título fica em cima e os stats numa linha abaixo. Ajustar para que, no desktop, os tiles de stat fiquem na mesma linha do bloco título/subtítulo, alinhados à direita.

- `src/components/caderno/ui/PageHeaderPremium.tsx`: no ramo desktop, mover o bloco de stats para dentro da linha superior (`flex items-start justify-between`), à direita, com `items-end`/alinhamento à direita. O ramo mobile permanece igual (stats abaixo, scrolláveis).
- Observação: o `PageHeaderPremium` é compartilhado por outras abas do Caderno (Favoritos, Treino, etc.), então elas também passarão a exibir os stats na mesma linha do título — comportamento consistente. Se preferir aplicar **só** em Flashcards, eu isolo a mudança nessa página.

### b) Painéis "Estudar" e "Criar" um pouco menores em altura
Reduzir levemente o padding vertical/altura dos tiles e CTAs:

- `StudyPanel.tsx`: reduzir o padding do card "Revisar devidos" (`py-3` → `py-2.5`) e dos tiles de modos (`p-3` → `p-2.5`), encurtando a altura geral.
- `CreatePanel.tsx`: reduzir padding do card "Gerar com Prof. San" e do "Criar flashcard" (`p-4` → `p-3.5`) e os espaçamentos internos (`mt-3`/`mt-3.5` levemente menores), além do CTA (`py-2.5` → `py-2`).

Ajustes finos de valores serão validados visualmente no preview após a implementação.

---

## Verificação
- Confirmar que o build/typecheck passa sem os erros listados.
- Abrir `/caderno/flashcards` no preview e conferir: stats à direita do título na mesma linha; painéis Estudar/Criar mais baixos; nenhuma quebra de layout nas demais abas do Caderno.
