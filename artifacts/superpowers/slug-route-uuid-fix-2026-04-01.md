# Correção: URL com slug vs UUID no Supabase

## Problema
Rotas como `/simulados/simulado-2-cirurgia-emergencia/start` passavam o slug para queries PostgREST com `id=eq....` e `simulado_id=eq....`, gerando `22P02` (tipo uuid inválido).

## Solução
- `isUuidString()` em `src/lib/simulado-id.ts` distingue UUID de slug.
- `simuladosApi.getSimulado(idOrSlug)` consulta por `id` ou `slug`.
- `useSimuladoDetail`: carrega config primeiro; `getQuestions` / `getAttempt` usam `config.id`.
- `useExamFlow`: `useExamStorageReal(simulado?.id ?? '')` para RPCs e FK sempre com UUID.
- `useExamResult`: resolve simulado antes de `getAttempt`.

## Verificação
- `npm run test -- --run` — 47 testes OK (incl. `simulado-id.test.ts`).

## Revisão
- **Nit:** Comentário em `getSimulado` atualizado para não mencionar filtro `published` inexistente.
