

# Fix: Caderno de Erros -- erro 400 ao salvar

## Causa raiz

Na `CorrecaoPage`, o modal recebe `simuladoId={id}` onde `id` vem de `useParams()` -- ou seja, o **slug** da URL (ex: `simulado-1-cirurgia-emergencia`). A tabela `error_notebook` tem uma FK `simulado_id → simulados(id)` que exige UUID. O Supabase retorna 400 porque o valor não é um UUID valido.

## Correção

Trocar uma unica linha em `src/pages/CorrecaoPage.tsx`:

```diff
- simuladoId={id}
+ simuladoId={simulado.id}
```

`simulado` ja vem resolvido pelo `useSimuladoDetail(id)` que faz a consulta por slug ou UUID e retorna o objeto com o `id` correto (UUID).

## Arquivo afetado

| Arquivo | Mudanca |
|---------|---------|
| `src/pages/CorrecaoPage.tsx` | Linha ~509: usar `simulado.id` em vez de `id` |

