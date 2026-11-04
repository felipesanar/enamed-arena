# IA Por Edição: Servidor 2027

Implementação de F2-1 (MCP) e F2-2 (três summaries Gemini), conforme `docs/contracts/ai-edition-2027.md`. Somente fontes locais; sem commit, deploy, SQL, rede externa ou alteração de artefatos gerados nesta execução.

## Contrato HTTP

Os três endpoints mantêm os campos métricos do body anterior e a resposta `{ markdown }`. Aceitam adicionalmente:

```typescript
{
  simuladoId?: string; // UUID real, não título nem sequência
  editionContext?: {
    editionId: string;
    editionLabel: string;
    format: {
      questions: number;
      options: number;
      duration_minutes: number;
      scoring: 'raw' | 'tri';
      proficient_min?: number;
    };
    percentile: number | null; // Top X%, valor exato de computePercentile, 1..99
    cutoffReference: { label: string; source: string; value: number } | null;
  };
  // No comparative, cada entrada de simulados também recebe simuladoId?: string.
}
```

- `OPTIONS` mantém CORS; apenas `POST` é permitido. Header ausente, token inválido ou falha de `auth.getUser(jwt)` retorna 401 antes de consultas ou geração. Não basta decodificar o JWT.
- O cliente Supabase usa URL/chave pública anon e o JWT do usuário, com sessão persistente e refresh desligados. Nunca usa service-role nem imita `auth.uid()` via argumento RPC.
- JSON inválido e métricas/contexto contraditórios retornam 400; limite textual de body de 128 Ki caracteres retorna 413. Falha de catálogo/RPC retorna 503; falha/configuração interna retorna 500; erro de provedor, rede ou resposta inválida retorna 502. Erros não expõem bodies upstream, JWTs, nomes ou métricas; não há logs de payload.
- `editionId`, rótulo e todos os campos de formato são conferidos contra `exam_editions`. Formato é reconstruído por whitelist, sem merge com valores enviados pelo cliente. Campos extras no formato são recusados.
- `simuladoId`, quando enviado, exige metadados daquele ID, associação à mesma edição e `results_release_at` válido e já alcançado. Não se usa nome ou sequência para inferir edição/ano. Nenhuma nota é buscada para contornar a liberação.
- Em série identificada por contexto, ID global ou algum ID de entrada, todas as entradas precisam de `simuladoId` válido, liberado e da mesma edição. Séries com edições diferentes são recusadas.
- Sem contexto nem IDs, o body legado continua aceito, mas edição/formato/corte/percentil ficam desconhecidos. Uma série legada não comprova comparabilidade longitudinal. Se apenas um ID identifica a edição, o catálogo fornece seu formato; percentil e corte permanecem desconhecidos.
- Percentil ausente/null é desconhecido. Valor fornecido precisa ser número finito em 1..99; é repassado literalmente, sem arredondamento, inversão, `100-score` ou algoritmo próprio do servidor. O teste usa o `computePercentile` real do cliente.
- `cutoffReference` não nulo precisa coincidir exatamente em valor, rótulo e fonte com um match da RPC `get_user_cutoff_context(p_user_id, p_reference_edition_id)`, usando a edição validada. Tanto o envelope como a linha precisam identificar essa referência. Uma referência inexistente ou inventada retorna 400, não substituição silenciosa.
- O DTO atual não contém um ID separado de processo de referência. Nesta entrega só se aceita referência da mesma chave de catálogo validada; um processo diferente requer evolução explícita do contrato. Não se adivinha outra referência a partir do rótulo, do ano ou de D6.
- Os antigos `cutoffContext`, `specialty` e `institutions` do ranking não são fonte confiável e não entram no prompt como corte/destino. Uma fonte conhecida é contextual, não permite subtrair nota TRI de percentual bruto. Sem valor/fonte, não se apresenta chance de aprovação. Todas as análises são estimativas pedagógicas, sem calcular nota/proficiência TRI ou escrever grades/dados.

## Prompts E Modelo

`_shared/aiEditionContext.ts` valida metadados e monta o bloco de contexto conhecido/desconhecido. `_shared/geminiModel.ts` concentra gates HTTP, autenticação, configuração, transporte e erros. Cada summary mantém um `handler.ts` com prompt/validação próprios e `index.ts` como adapter Deno/Supabase.

Foram removidas metas/cortes fixos e referências a formato oficial presumido. No comparativo, também saíram cenários como `acima_corte` e `rumo_a_corte`, que embutiam corte não validado. Permanecem resultados por prova, média, extremos, desvio padrão, deltas por área e observações de comportamento. A redação solicita hipóteses neutras, não causas comprovadas. Os formatos de saída continuam Markdown: performance em quatro seções, ranking em três seções sem promessa de aprovação, comparativo em dois parágrafos.

`GEMINI_MODEL` é lido no runtime por `Deno.env.get`, nunca de arquivo de segredos. Ausente: `gemini-2.5-flash`, modelo já utilizado nos três endpoints. Configuração presente inválida, inclusive vazia, falha fechada. IDs aceitam somente alfanuméricos, ponto, hífen e underscore, até 128 caracteres; modelo e chave são URL-escaped. O override legado `thinkingBudget: 0` fica restrito ao Flash original; outros modelos usam seus defaults de thinking, evitando impor uma opção incompatível ao Pro. Preservado um retry em 429/5xx. Nenhum SDK Gemini novo. Import Supabase exato: `https://esm.sh/@supabase/supabase-js@2.49.4`.

O adapter explicita uma interface somente leitura para DI. A conversão de tipo na fronteira evita instanciação recursiva excessiva dos generics PostgREST do SDK durante o check Deno; não há `ts-ignore`, relaxamento de strict ou alteração de configuração do app. Handlers e testes não dependem da execução dos módulos remotos do SDK.

## MCP

`get_my_performance` recebe `edition_id` UUID opcional com Zod 4. O usuário sempre é `ctx.getUserId()` do OAuth verificado, nunca um argumento do input. Sem ID explícito, `edition-scope.ts` resolve alvo do onboarding, termo de graduação igual ao código, próxima edição com data real do catálogo e, por fim, edição sem data `preparing`/`active` ou `planned`, em ordem de ano/termo/código/ID. O calendário usa America/Sao_Paulo, sem inventar data oficial. Alvo explícito desconhecido é erro; nenhuma edição resolvida retorna mensagem neutra e `{ scope: null, performance: [] }` sem RPC global.

Consulta única de métricas: `get_user_performance_summary({ p_user_id: caller, p_edition_id: resolved, p_include_training: false })`. Retorno inclui `scope: { edition_id, edition_label, include_training: false }` e o array real da RPC, inclusive vazio. Nenhum SELECT de `user_performance_summary` nem fallback para notas brutas. Erros são genéricos, sem repassar mensagens SQL.

Prova em fonte SQL, não em produção: `20261104084903_fase1_performance_scope.sql` faz a summary delegar ao histórico com ownership `p_user_id=auth.uid()`. O histórico filtra edição, liberação e treino antes de agregar, com seleção da tentativa elegível. O teste verifica essa cadeia na migration; doubles não comprovam aplicação da migration ou RLS em ambiente real.

As cinco tools continuam read-only; auth issuer/audience e `acceptResourceClaim: false`, JWT do caller e gate PRO do notebook não foram alterados. `supabase/functions/mcp/index.ts` e `deno.json` permanecem intocados. O orquestrador deve regenerá-los pelo gerador oficial Linux após integrar estas fontes. Não executar o gerador Windows nem usar o bundle anterior como evidência desta entrega.

## Verificação Local

TDD: helpers/handlers e MCP receberam testes antes da implementação; falhas iniciais de módulos/exports inexistentes e nove falhas MCP foram observadas. Os antigos testes Deno que duplicavam algoritmos descontinuados foram substituídos por testes dos builders de produção.

Comandos restritos ao escopo, sem downloads:

```powershell
node node_modules/vitest/vitest.mjs run src/lib/mcp/performance.test.ts src/lib/mcp/security.test.ts supabase/functions/_shared/aiEditionContext.test.ts supabase/functions/_shared/geminiModel.test.ts

# DENO_DIR e exe apontam para o runtime/cache privado fornecido no handoff.
& $deno test --cached-only --no-config supabase/functions/_shared/aiEditionContext.test.ts supabase/functions/_shared/geminiModel.test.ts supabase/functions/gemini-performance-summary/endpoints.test.ts supabase/functions/gemini-ranking-summary/helpers.test.ts supabase/functions/gemini-comparative-summary/analytics.test.ts
& $deno check --cached-only --no-config supabase/functions/gemini-performance-summary/index.ts supabase/functions/gemini-ranking-summary/index.ts supabase/functions/gemini-comparative-summary/index.ts

node node_modules/typescript/bin/tsc --noEmit --strict --skipLibCheck --module esnext --moduleResolution bundler --target es2022 --types node,vite/client src/lib/mcp/index.ts src/lib/mcp/performance.test.ts src/lib/mcp/security.test.ts
node node_modules/eslint/bin/eslint.js src/lib/mcp/tools/get-my-performance.ts src/lib/mcp/edition-scope.ts src/lib/mcp/performance.test.ts src/lib/mcp/security.test.ts
# Deno lint --no-config foi executado nos 13 arquivos Edge alterados/criados.
```

Os testes não têm permissão de rede e injetam fetch/Auth/RPC. Cobertura: dois formatos distintos (120/5/300 e 100/4/240), edição sem data, TRI sem corte, corte desconhecido/forjado, séries cruzadas, percentil exato do cliente, auth inválida/ausente, namespace OAuth, ausência de edição e liberação em fonte SQL. `deno check` verifica os entrypoints reais via cache de tipos. O cache local não contém todo o runtime remoto do SDK para importação em testes; por isso os testes executam handlers com doubles. ESLint ignora Edge Functions pelo config vigente, portanto o lint Edge é feito pelo Deno, sem editar o config.

Resultados finais locais: Vitest 33 passando/0 falhando; Deno 26 passando/0 falhando (os 11 testes dos helpers compartilhados aparecem nos dois runners, não são contagens independentes). Ambos exit 0. Check dos três entrypoints Deno, typecheck strict das fontes/testes MCP, ESLint MCP, Deno lint dos 13 arquivos Edge e `git diff --check`: exit 0. Nenhuma suíte global/build foi executada. Os testes também cobrem retry, falha de rede/modelo/requester, respostas inválidas e uso dos defaults de thinking em modelo configurado diferente do Flash original.

## Integrações Pendentes

- Frontend: enviar `editionContext` real e o resultado de `computePercentile`, além de `simuladoId` no summary individual e em cada entrada comparativa. Nesta entrega os clientes atuais continuam usando caminho legado/desconhecido; não se declara a integração ponta a ponta concluída.
- Frontend: revisar chaves/invalidação do cache de textos IA para que mensagens antigas com corte fixo não sejam reapresentadas como novas. Cache de UI não foi alterado neste escopo.
- SQL/ambiente: confirmar rollout autorizado de catálogo/cortes e da RPC F1, políticas de leitura e comportamento de release/RLS com usuários reais em ambiente autorizado. Nenhuma migração foi aplicada aqui.
- Bundle MCP: regeneração oficial Linux e revisão do artefato/manifest pelo orquestrador. Diagnósticos strict do bundle antigo gerado não foram mascarados.
- Conteúdo: revisão humana da redação revisada e da referência efetivamente cadastrada. D6 continua sem fonte inventada. Nenhuma chamada Gemini real foi feita para validar a saída do modelo.
