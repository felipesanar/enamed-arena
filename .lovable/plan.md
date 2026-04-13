

# Export XLSX de ranking de questões por simulado

## Problema

1. O CSV gerado anteriormente saiu com encoding quebrado (caracteres como "Ã©" em vez de "é")
2. Não existe botão no admin para baixar esse relatório -- foi gerado manualmente via query

## Solução

### 1. Migration: adicionar `area`, `theme` e `total_responses` ao RPC existente

O RPC `admin_simulado_question_stats` já retorna as questões ordenadas por `correct_rate ASC` (piores primeiro), mas faltam `area`, `theme` e contagem de respostas. Alterar o `SELECT` final para incluir:

```sql
q.area,
q.theme,
(SELECT count(*) FROM attempt_question_results aqr2 
 WHERE aqr2.question_id = q.id AND aqr2.was_answered = true) as total_responses
```

### 2. Instalar dependência `xlsx` (SheetJS)

Biblioteca client-side para gerar arquivos `.xlsx` sem servidor. Leve (~200KB gzipped), sem problemas de encoding.

### 3. Criar utilitário de export XLSX

Novo arquivo `src/admin/utils/exportQuestionRanking.ts`:
- Recebe os dados do RPC + título do simulado
- Gera planilha com colunas: Ranking, Questao, Area, Tema, % Acerto, Total Respostas, Indice Discriminacao, Alternativa Errada Mais Comum
- Destaca as 30 piores com cor de fundo (amarelo claro)
- Formata headers em negrito
- Auto-ajusta largura de colunas
- Dispara download do arquivo `.xlsx`

### 4. Botão de download no AdminSimulados

Adicionar ícone `Download` na coluna Acoes de cada simulado (ao lado de Analytics, Editar, etc.):
- Desabilitado se não há participantes
- Ao clicar: busca `adminApi.getSimuladoQuestionStats(id)`, gera XLSX, dispara download
- Toast de loading/sucesso/erro

### Tipos atualizados

`SimuladoQuestionStat` ganha 3 novos campos opcionais:
```typescript
area: string
theme: string
total_responses: number
```

## Arquivos modificados

| Arquivo | Mudanca |
|---------|---------|
| `supabase/migrations/...` | Adicionar area, theme, total_responses ao RPC |
| `src/admin/types.ts` | Novos campos em SimuladoQuestionStat |
| `src/admin/services/adminApi.ts` | Mapear novos campos |
| `src/admin/utils/exportQuestionRanking.ts` | Novo - gera XLSX |
| `src/admin/pages/AdminSimulados.tsx` | Botao Download por simulado |
| `package.json` | Adicionar `xlsx` |

