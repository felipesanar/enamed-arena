# Contagens administrativas antes do rollout SQL

Contrato aprovado pelo orquestrador, implementado e validado com testes direcionados nesta retomada. A frente de período já foi integrada em 5f34aeb e não foi refeita. Escopo: `src/admin/services/adminApi.ts:listSimulados`, `src/admin/services/adminApi.countsCompat.test.ts` e este documento. Prompt completo em `.superpowers/admin-periodQA/compat-counts.md`.

Produção ainda não dispõe de admin_simulado_attempt_counts. A listagem deve manter os simulados obtidos e preencher attempts_count:null somente quando houver erro inequívoco de resolução da própria função: PGRST202 com nome correto; ou42883 cujo message identifique a própria função inexistente, nunca um helper interno. Outros erros propagam, inclusive403/42501, rede/timeout e missingfunction de outra função.

Null é desconhecido, não zero. Não consultar attempts para substituir essa contagem: RLS pode ocultar dados. GetSimuladoAttemptsCount e as deleções continuam falhando antes da mutação se a contagem não for autoritativa. Não há qualquer mudança de autorização, SQL, schema ou produção.

O orquestrador fará o commit scoped e merge manual porque este job já passou por oc integrate. Nenhuma operação Git mutante foi realizada nesta entrega.

## Comportamento implementado

- O SELECT de simulados e a chamada única de `admin_simulado_attempt_counts` permanecem iguais.
- `PGRST202` permite fallback somente se `message` ou `details` identificar `function public.admin_simulado_attempt_counts` (ou o nome sem schema), com limite exato do identificador. Um nome com sufixo, como `_backup`, não corresponde.
- `42883` permite fallback somente se o próprio `message` tiver a forma `function [public.]admin_simulado_attempt_counts(assinatura) does not exist`. Referência à função-alvo em contexto/details não transforma ausência de helper interno em fallback.
- No fallback, todos os simulados já obtidos são preservados com `attempts_count: null`. Não se consulta `attempts`, não se tenta RPC alternativa e não se converte desconhecido em zero.
- Resposta bem-sucedida mantém o mapping anterior, inclusive contagens reais 0 e 5; item sem contagem continua com null.
- Erros de SELECT, autorização, autenticação, rede, timeout, falha interna e ausência de outra função continuam propagados. Rejeição de Promise por falha de rede também não é capturada como modo legado.
- `getSimuladoAttemptsCount`, `deleteSimulado` e `deleteQuestionsForSimulado` permanecem sem alteração: ausência da RPC impede chegar ao DELETE. Não houve mudança de UI, gating, callers ou banco.

## TDD e comandos reais

Primeiro foi criado o teste específico com mocks na fronteira Supabase, sem substituir métodos de `adminApi` por mocks:

```powershell
node node_modules/vitest/vitest.mjs run src/admin/services/adminApi.countsCompat.test.ts --maxWorkers=2
```

RED confirmado antes da implementação: 21 testes, 4 falhas e 17 aprovados. As quatro falhas eram os casos elegíveis de ausência da função-alvo (PGRST202 em message/details e 42883 com assinaturas); a implementação anterior rejeitava a listagem.

Após a alteração restrita de `listSimulados()`:

```powershell
node node_modules/vitest/vitest.mjs run src/admin/services/adminApi.countsCompat.test.ts src/admin/services/adminApi.editions.test.ts --maxWorkers=2
```

GREEN: 2 arquivos, 24 testes aprovados, exit 0. Cobertura específica: três simulados preservados com contagens desconhecidas; mapping de 0/5/null; erros não elegíveis; SELECT sem sucesso; rede rejeitada; nenhuma consulta à tabela attempts ou RPC alternativa; contagem e ambos os caminhos de deleção fail-closed para PGRST202 e 42883.

Inspeção de escopo por `git diff -- src/admin/services/adminApi.ts` confirmou que somente o método autorizado mudou. `git status --short` mostrou apenas os três arquivos desta entrega, incluindo este documento parcial preexistente à retomada.

## Limites

Testes unitários usam respostas PostgREST simuladas, com nomes e assinaturas explícitos. Não comprovam disponibilidade real da RPC, RLS ou permissões em produção. O matcher é deliberadamente conservador: mensagens fora dos formatos reconhecidos continuam falhando, sem autorizar deleções.

Não houve rede externa, pacotes, acesso a `.env`, SQL, produção, subagentes, suíte global, typecheck global ou QA visual. O check consolidado de TypeScript fica com o Codex. Nenhum arquivo de período, documentação de outro módulo ou `simuladosApi.ts` foi alterado neste follow-up.
