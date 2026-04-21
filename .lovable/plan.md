

## Auditoria — Página Desempenho: espaçamentos, margens e estrutura

### Diagnóstico (severo)

**Causa raiz:** `/desempenho` está marcado como rota *full-bleed* no `DashboardLayout` (`isFullBleedRoute`), ou seja, o `<main>` recebe `p-0`. Como a `DesempenhoPage` também não adiciona padding nem container de largura máxima, **todo o conteúdo cola nas bordas do viewport** — título, subtítulo, hero, breadcrumb, listas e barras. No viewport atual (1110px) o subtítulo "Análise detalhada…" é **cortado à direita**.

**Outros problemas estruturais visíveis:**
1. Sem `max-width` no conteúdo → em telas largas o hero vira uma barra horizontal extensa de baixa densidade.
2. `PageHeader` usa `md:max-w-[min(28rem,42vw)]` + `md:text-right` no subtítulo, o que combinado com `p-0` do main faz o texto vazar/clipar.
3. "TEMA" e "RESUMO DO DESEMPENHO" não têm separação visual hierárquica clara — overline cola direto na lista anterior.
4. Cards de tema (acordeão) aparecem como linhas edge-to-edge sem respiro lateral — falta agrupamento em "card-de-cards".
5. "Evolução por especialidade": as linhas (ícone + nome + barra) estão dentro de um card, mas o card também encosta nas bordas.
6. Hierarquia: o hero domina demais o topo; o resto da página sente-se "solto" sem ritmo de seções.
7. Mobile herda os mesmos problemas (sem padding lateral).

### Estratégia de correção

**Princípio:** trazer `/desempenho` para o **mesmo grid de container das outras páginas** (Simulados, Caderno de Erros), com padding lateral consistente, largura máxima legível e ritmo vertical bem definido entre seções.

### Plano de implementação (3 arquivos)

**1. `src/components/premium/DashboardLayout.tsx`**
- Remover `desempenho` da regra `isFullBleedRoute` (manter apenas `comparativo` se necessário). Resultado: `/desempenho` passa a usar o mesmo `px-4 md:px-8 py-6 md:py-8` das demais páginas.

**2. `src/pages/DesempenhoPage.tsx`**
- Envolver todo o conteúdo (header + painel) em `<div className="mx-auto w-full max-w-[1280px]">` para limitar largura em monitores ultra-wide e centralizar.
- Garantir `min-w-0` no wrapper para evitar overflow horizontal.

**3. `src/components/desempenho/DesempenhoSimuladoPanel.tsx`** (refino de ritmo)
- Aumentar `space-y` entre seções de `space-y-5 md:space-y-6` para `space-y-6 md:space-y-8` (respiro entre hero/breadcrumb/temas/resumo/evolução).
- Hero: reduzir padding interno em desktop (`md:p-7` → `md:p-6`) para densidade mais elegante depois que o hero não é mais full-bleed.
- "TEMA" (lista de acordeões) → envolver em um **card branco** (`rounded-2xl border bg-card p-4 md:p-5`) com a `SectionHeader` interna, igualando o tratamento usado em "Evolução por especialidade".
- Breadcrumb: dar `px-1` e separar do hero com `pt-1` + ajustar para usar `text-[12px]` consistente.
- Cards "Onde você brilha" / "Próximo foco": adicionar `min-w-0` interno para evitar overflow do título quando especialidade longa.
- `MiniStat` no hero: limitar `max-w-[110px]` no nome da área para não estourar.

### Resultado esperado

- Conteúdo respeitando o mesmo container/padding do resto do app (consistência).
- Subtítulo nunca mais cortado — terá `px-8` à direita garantido.
- Hero proporcional e premium, não mais uma "faixa" colada nas bordas.
- Hierarquia visual clara: hero → breadcrumb → cards de tema (em card) → resumo → evolução, com espaçamento generoso e consistente.
- Mobile: padding lateral de 16px restaura a leitura confortável.

### Arquivos afetados
- `src/components/premium/DashboardLayout.tsx`
- `src/pages/DesempenhoPage.tsx`
- `src/components/desempenho/DesempenhoSimuladoPanel.tsx`

### Risco / rollback
- Mudança puramente de layout/CSS, sem schema/RPC/hooks/rota.
- Rollback simples por arquivo.

