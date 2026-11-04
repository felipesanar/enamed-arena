# Test runtimes (2027)

## Problema e separacao

O CI b922 descobriu testes Deno puros no Vitest. Separadamente, os testes
Node de `caderno-pattern-insights` falhavam antes de coletar casos porque
`src/test/setup.ts` acessava `window` sem verificar sua existencia.
O setup agora instala o mesmo mock de `matchMedia` apenas quando ha DOM.

- Vitest: testes de `src/` e todos os testes Edge compativeis, incluindo
  `_shared/adminAuthorization.test.ts`, `presencial/sessionRules.test.ts` e os
  wrappers dual-runtime `_shared/aiEditionContext.test.ts` e
  `_shared/geminiModel.test.ts`. O ambiente padrao continua jsdom; os testes
  Node podem continuar usando sua diretiva de ambiente.
- Somente Deno: `caderno-reminders/handler.test.ts`,
  `calendar-notifications/worker.test.ts`, `hubspot-contact-sync/handler.test.ts`
  e `ops-health-alerts/worker.test.ts`, sob `supabase/functions/`.
  Somente esses quatro arquivos foram adicionados ao exclude do Vitest.
- As exclusoes anteriores de `supabase/functions/gemini-*/**` permanecem;
  esses testes nao foram adicionados ao novo job de seis arquivos.

## CI Deno

O job `deno-test` usa `actions/checkout@v4` e `denoland/setup-deno@v2` com
`deno-version: "2.9.8"`. O build depende tambem desse job; os jobs existentes
de lint, typecheck, testes, edge pins e audit foram preservados.

```sh
deno test --no-config --no-lock supabase/functions/caderno-reminders/handler.test.ts supabase/functions/calendar-notifications/worker.test.ts supabase/functions/hubspot-contact-sync/handler.test.ts supabase/functions/ops-health-alerts/worker.test.ts supabase/functions/_shared/aiEditionContext.test.ts supabase/functions/_shared/geminiModel.test.ts
```

Sao exatamente seis arquivos, incluindo os dois dual-runtime em ambos os
runners. Typecheck normal, nenhuma permissao `--allow-*`, nenhum secret ou
env de producao. As dependencias dos handlers sao injetadas nos testes;
nao e necessario conceder leitura local, rede ou ambiente. O runtime sera
obtido pelo setup do CI, sem instalacao nesta tarefa.

## Validacao local

Executado nesta tarefa, antes da correcao, com o config padrao:

```sh
node node_modules/vitest/vitest.mjs run supabase/functions/caderno-pattern-insights/handler.test.ts supabase/functions/caderno-pattern-insights/scope.test.ts --maxWorkers=2
```

Resultado vermelho: 2 suites falharam, nenhum caso coletado,
`ReferenceError: window is not defined` em `src/test/setup.ts:3`.
Os testes existentes foram usados como regressao, sem mudar assertions.

Executado nesta tarefa, depois da correcao:

```sh
node node_modules/vitest/vitest.mjs run supabase/functions src/admin/contexts/AdminPeriodContext.test.tsx --maxWorkers=2
node node_modules/vitest/vitest.mjs list supabase/functions src/admin/contexts/AdminPeriodContext.test.tsx --filesOnly --maxWorkers=2
```

Resultado verde: **17 arquivos, 206 testes passando**, nenhum falhando.
A lista confirmou os 16 arquivos Edge legitimos mais o teste DOM, incluindo
os dois wrappers e os testes adminAuthorization/sessionRules.
YAML validado com a biblioteca `yaml` ja instalada e assertions Node:
sem erros de parse/chaves duplicadas, comando exato dos seis arquivos,
versao do Deno, dependencia do build e presenca dos jobs anteriores.

Evidencia independente do orquestrador/Codex, nao executada nesta tarefa:
Deno 2.9.8, base `155f172`, os mesmos seis arquivos com
`deno test --no-config --no-lock --cached-only`, typecheck normal e nenhuma
permissao extra: **25 passando, 0 falhando**. Log local conferido em
`.superpowers/ci-runtimesQA-independent-deno.log` (ignorado pelo Git).

Limites: nenhuma suite global, GitHub Actions, push, deploy ou instalacao
foi executada. A execucao real do workflow aguarda integracao pelo
orquestrador; a evidencia Deno local acima pertence a validacao independente.
