

# Correções no Drawer de Notas de Corte

## Problemas identificados

1. **Notas exibidas com `%`**: Os valores `cutoff_score_general` e `cutoff_score_quota` são números absolutos (ex: 77.0, 83.0), não percentuais. Todas as ocorrências de `{value}%` devem exibir apenas `{value}`.
2. **Sem feedback visual de filtros ativos**: Quando o usuário seleciona uma especialidade ou digita na busca, não há indicação clara de que filtros estão aplicados (ex: badge, cor diferente no botão "Filtrar", botão "Limpar filtros").
3. **Limite de 1000 registros**: Supabase retorna no máximo 1000 rows por default. A tabela tem 1058 registros. A query precisa de `.limit(2000)` ou paginação range-based.

## Plano

### 1. Remover `%` de todas as notas
- **Arquivo:** `src/components/ranking/CutoffScoreModal.tsx`
- Remover o sufixo `%` nas linhas 268, 289, 565, 572, 633, 639 (hero card scores, user row, other rows)

### 2. Feedback visual de filtros ativos
- **Arquivo:** `src/components/ranking/CutoffScoreModal.tsx`
- Computar `hasActiveFilters = specialtyFilter !== 'all' || search.trim() !== ''`
- Quando `hasActiveFilters`:
  - Mostrar um dot/badge wine no botão "Filtrar"
  - Exibir um botão "Limpar filtros" inline ao lado do contador de resultados
  - Alterar a cor do contador de resultados para wine quando filtrado

### 3. Buscar todos os registros (>1000)
- **Arquivo:** `src/services/rankingApi.ts`
- Na função `fetchAllCutoffScores`, adicionar `.range(0, 1999)` para garantir que todos os 1058+ registros sejam retornados (Supabase precisa de range explícito para ultrapassar o default de 1000)

