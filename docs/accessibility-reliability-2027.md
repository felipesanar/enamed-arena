# Acessibilidade e confiabilidade 2027

## Escopo e estado

Implementação local de F3-8/F1-10. Não há SDK Sentry, DSN, conta de monitoramento, credenciais de staging ou declaração de monitoramento ativo. Não houve rede externa, instalação, leitura de `.env`, commit, deploy ou envio de mensagens. O fluxo Supabase real não foi validado.

Design combo 0 → 3 → 5: contexto em PRODUCT.md, DESIGN.md, layouts premium, tokens de src/index.css e referências locais. Protótipo HTML criado antes do React em `docs/design/exam-accessibility-prototype.html`. Mantidos Plus Jakarta Sans, tokens, Tailwind 3, shadcn, Lucide e composição existente. Sem direção visual nova, tema novo ou motion. Na retomada, a visão geral do MCP Dendê retornou os critérios de alvo 44px, foco visível e reduced-motion; a biblioteca não foi instalada nem houve migração do shadcn existente. Isso não certifica conformidade integral com Dendê. Sem launcher Impeccable ou instalação local.

## Comportamentos

- `SkipLink`: primeiro link dos dois layouts, visível no foco, âncora nativa para `#main-content`, foco programático no `main tabIndex=-1`, rolagem instantânea inclusive com reduced-motion. Um ID por layout ativo; rotas e App não foram alterados. O outline do main não é removido. O `main` interno preexistente de ExamPage não foi alterado, conforme escopo.
- Timer visual mantém `role=timer`, número atualizado e `aria-live=off`. Dígitos usam `text-foreground`, sem atenuação por pulso; o pulso preexistente fica apenas no ícone decorativo, com reduced-motion. Região separada `role=status` anuncia a retomada uma vez e marcos 5min/2min/1min/30s/10s/esgotado. Ao saltar marcos, anuncia uma vez o tempo atual real (601→79 anuncia 1 minuto e 19 segundos), não o valor antigo do marco. Mantém a mensagem entre marcos; correções para cima não repetem marcos já anunciados. Nenhuma mudança no timerhook, deadline ou finalização. `Finalizar` usa `text-foreground` também em hover/foco, sem mudança no CSS global.
- Mapa de atalhos agora é um Popover acionável por teclado/clique/toque, com botão 44×44px também no mobile. Antes de responder: 1–5 alternativas; depois: 1–3 confiança baixa/média/alta; R revisão, H alta certeza, setas navegação. O mapa do Flow não foi modificado.
- Hook de teclado ignora eventos consumidos, Ctrl/Meta/Alt, composição IME, inputs/textarea/select, ancestrais contenteditable/role=textbox e diálogos modais abertos. `enabled`, `preventInInputs` e mapa numérico preservados. `preventDefault` somente quando há handler efetivamente chamado. Shift não foi bloqueado indiscriminadamente.

## Pendência Esc

**Esc sem penalidade NÃO está resolvido por este job.** O Flow ainda abre a confirmação por Escape, enquanto o navegador pode sair do fullscreen e o Integrity contabilizar essa saída. Não é seguro afirmar que `preventDefault` evita a ação reservada do navegador. O texto do mapa informa que Esc pode sair da tela cheia.

Coordenação necessária com Codex/orquestrador do job Flow/Integrity: separar intenção de abrir/fechar confirmação de infração, não penalizar a saída de fullscreen provocada por Escape, preservar a confirmação e acrescentar testes do hook de integridade/Flow com a sequência real `keydown`/`fullscreenchange`, incluindo navegadores que consomem Escape. Não tocar contador, deadline ou finalizar automaticamente para contornar o problema. Esta é uma pendência do critério integral F3-8, fora dos arquivos autorizados aqui.

## Preload recovery

`installPreloadRecovery` escuta exclusivamente `vite:preloadError`. Não intercepta `window.error` nem outros erros e não encaminha o payload Vite para analytics. O listener é substituível/idempotente e tem cleanup/HMR.

- Durante `/simulados/:id/prova` e `/simulados/:id/gabarito`, inclusive variações de caixa/segmentos codificados equivalentes ao roteador, nunca recarrega automaticamente. O fluxo presencial logado edita respostas nessa mesma rota de gabarito; `/presencial/:codigo` é apenas redirecionamento para ranking.
- Fora de prova, permite uma tentativa automática por aba em 60s, persistindo a marca antes da recarga. Reinstalação/HMR não contorna a marca; timestamp inválido/futuro bloqueia a tentativa. Eventos repetidos no documento não disparam novas recargas.
- Cache `enamed_exam_v1:*` com questões sujas, cache legado ou ilegível bloqueia recarga automática. Estado `enamed_offline_*`, incluindo tentativa pendente e formatos de rascunho desconhecidos, também bloqueia fora da rota; não depende de helpers futuros de drafts. Ponteiros `enamed_exam_active_v1:*` não são confundidos com payloads. Storage inacessível falha de modo conservador. Nenhum token, resposta ou cache é removido pelo recovery.
- Aviso acessível usa Alert existente e botão explícito **Recarregar e retomar**. Não promete que dados voláteis foram salvos: alterações ainda não sincronizadas podem ser perdidas. Não move foco automaticamente nem inicia timer/finalização.
- A instalação ocorre antes da montagem do App; estado do aviso fica disponível mesmo se a falha preceder a montagem. A política protege caches conhecidos; não substitui persistência/flush do outro job. A rotina preexistente de limpeza de análises `sanor:*` em reload manual no main não foi ampliada nem usada como correção de chunk; respostas/cache de prova não são limpos.

## Observabilidade configurável

`configureErrorMonitoring` aceita `enabled`, `transport` e `release` opcional. Padrão `enabled=false`; sem transporte nada é enviado. Um provider futuro poderá adaptar um serviço aprovado com DSN real, sem expor o erro original ao SDK:

```ts
configureErrorMonitoring({
  enabled: true,
  release: '2027.1',
  transport: approvedSanitizedTransport,
});
```

O transporte recebe **apenas** `source`, nome de erro normalizado, código estável (`render_failure`, `runtime_failure`, `unhandled_rejection`), rota sanitizada e release de build opcional. Segmentos de rota fora da lista estática, incluindo UUIDs, números, slugs e emails, viram `:id`; query/hash não entram. Nunca recebe `message`, `stack`, `cause`, texto de resposta, JWT, usuário, email, session ou payload de analytics. Strings de rejection e getters hostis não são serializados.

Boundary usa logger com mensagem estática e adapter. Preserva `error_boundary_triggered` com apenas `source=boundary` e `code=render_failure`, mesmo com provider disabled, contendo falhas do analytics; não envia message/stack/rota crua. Fallback/ações continuam visíveis, sem mostrar mensagem crua nem em dev. Listeners `window.error`/`unhandledrejection` não cancelam eventos. Deduplicação por relatório sanitizado e teto de 10/minuto; guard cobre reentrada síncrona, sem bloquear novos relatórios enquanto uma Promise estiver pendente. Rejeições do transporte são capturadas sem re-reportar. `SIGNED_OUT` limpa estado de sessão/dedup, preservando configuração global e transporte. `resetErrorMonitoring` permanece disponível para shutdown explícito. Não há contexto de usuário retido; transportes devem ter seu próprio timeout/cancelamento e não anexar contexto automático do SDK.

## E2E sem confundir mock

`e2e/critical.config.ts` separa três modos, sem usar o config Lovable, iniciar servidor ou carregar env files:

- Padrão: somente `critical-path.spec.ts`, sem mocks de auth. Fluxo real exige `CRITICAL_E2E_ENV=STAGING`, origem HTTPS com marcador staging no hostname, `E2E_EXPECTED_SUPABASE_PROJECT_REF` válido (20 caracteres minúsculos/numéricos), `E2E_FIXTURE_EMAIL`, `E2E_FIXTURE_PASSWORD`, `E2E_FIXTURE_SIMULADO_ID` e `E2E_ALLOW_FIXTURE_MUTATION=true`. Produção `lljnbysgcwvkhlnaqxtt` é rejeitada. Sem os pré-requisitos: **SKIPPED com motivo** localmente e erro de configuração em CI.
- Safety: `CRITICAL_E2E_MODE=safety`, somente `critical-safety.spec.ts`. Testes de configuração e páginas sintéticas interceptadas integralmente; nenhum request externo é efetivado, nenhuma credencial real é usada. Exercita frontend staging apontando produção, origens desconhecidas, auth/rest/functions/storage, fontes, cookies, service workers, redirects e WebSockets. Não equivale ao fluxo Supabase real.
- Harness: `CRITICAL_E2E_MODE=harness`, executa apenas `accessibility.spec.ts`. Usa componentes React reais e CSS/tokens locais compilados por dependências existentes, com DOM e relógio sintéticos. Toda requisição fora da página sintética é abortada. Sem App, auth, Supabase ou analytics. **Não é E2E de backend**. Chromium pode vir de `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`; não há download/instalação.

O fluxo real está preparado para login por senha, uma resposta, confirmação HTTP de gravação de answers, reload/retomada e conclusão. Exige **usuário próprio com onboarding completo e uma prova isolada publicada de UMA questão**, ainda não finalizada por esse usuário, prazo suficiente e banco de staging descartável. Preparar/resetar fixture externamente antes de cada execução. Não usa conta real de aluno, não cria seeds/admin por API, não intercepta auth, não envia email nem aciona notificações. Depois de finalizar, a fixture precisa ser renovada por operação autorizada; o teste não apaga tentativas. Um resultado futuro depende também dos contratos de persistência e seletores do job Flow.

Não basta a URL conter staging: antes de navegar/login, o teste instala fence para permitir somente o projeto Supabase explicitamente esperado e assets GET/HEAD do próprio frontend. Auth/rest/functions/storage de produção ou origem desconhecida, fetch/XHR/beacon desconhecidos e WebSockets desconhecidos são abortados antes do forward, com falha redigida. Contexto começa sem storageState/cookies e com service workers bloqueados. CSS `fonts.googleapis.com/css2` e arquivos de fonte Plus Jakarta Sans em `fonts.gstatic.com` são recusados sem marcar violação de backend, somente quando classificados como stylesheet/font e GET/HEAD; não há exceção para fetch/XHR/POST nesses hosts. Não se permite rede externa de fontes. O responsável ainda deve garantir isolamento real da infraestrutura/fixture. Traces, vídeos e screenshots do fluxo autenticado ficam desligados; não publicar artifacts de login/storageState/credenciais. O teste não registra respostas de rede nem valores de credenciais.

Workflow `.github/workflows/critical-e2e.yml`: somente `workflow_dispatch` em main, ambiente **STAGING**, concorrência 1, sem deploy e sem PR/fork trigger. Usa `ubuntu-latest`, checkout com `persist-credentials=false`, setup-node via `.nvmrc`, `npm ci` e instalação Chromium pelo CLI Playwright existente. Instalações são apenas instruções de CI, não foram executadas localmente. Executa safety antes do fluxo real. Configurar proteção/aprovação humana do environment, secrets de fixture e vars de URL/ID/project ref; nunca em PR. Este workflow não foi disparado.

## Validação local

RED observado antes da implementação: componentes ausentes; timer com live a cada segundo; atalhos consumindo SELECT/modifiers/IME/defaultPrevented. Novas regressões tiveram RED para reconfiguração após transporte pendente e rotas de prova com caixa/encoding equivalentes.

Na revisão final, RED reproduziu anúncios antigos após salto, reload indevido no gabarito/draft offline, transporte pendente travando relatórios, logout removendo configuração, analytics sanitizado ausente e contraste por classe de Finalizar. Após correções, 32 testes dirigidos em cinco arquivos passaram. A regressão de fontes também teve RED: assets negados marcavam unsafe indevidamente antes do ajuste específico.

Comando unitário restrito (Vitest 5, dois workers):

```powershell
node node_modules/vitest/vitest.mjs run src/components/SkipLink.test.tsx src/components/AppLayout.test.tsx src/components/premium/DashboardLayout.test.tsx src/components/exam/ExamTimerAnnouncement.test.tsx src/components/exam/ExamHeader.test.tsx src/hooks/useKeyboardShortcuts.test.tsx src/lib/preloadRecovery.test.ts src/components/PreloadRecoveryNotice.test.tsx src/lib/errorMonitoring.test.ts src/components/ErrorBoundary.test.tsx --maxWorkers=2
```

Descoberta/configuração sem credenciais:

```powershell
node node_modules/@playwright/test/cli.js test --config e2e/critical.config.ts --list
$env:CRITICAL_E2E_ENV='DISABLED' # Garante que esta verificacao local nao execute o fluxo real.
node node_modules/@playwright/test/cli.js test --config e2e/critical.config.ts
```

Harness offline (usar caminho do Chromium já disponível, sem instalar):

```powershell
$env:CRITICAL_E2E_MODE='harness'
$env:PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH='<Chromium local existente>'
node node_modules/@playwright/test/cli.js test --config e2e/critical.config.ts
```

O protótipo e harness exercitam foco por Tab/Enter, timer sem flood, atalhos mobile, aviso de recovery, ausência de overflow e controles de 44px em 375/768/1440, claro/escuro. Isso não é auditoria WCAG completa, teste com leitor de tela real ou validação visual de todas as páginas. App força tema claro preexistente; dark foi exercitado isoladamente, não habilitado no produto. Fonte remota não foi carregada. Testes globais, typecheck/build global e revisão Codex ficam para o orquestrador. Esc/Integrity, DSN/transporte aprovado, ambiente/credenciais/fixture E2E e execução Supabase permanecem externos.

Resultados anteriores preservados: 42 testes unitários em 10 arquivos e 12 cenários Chromium do harness/protótipo. Não foram repetidos como QA amplo na revisão final. O Codex confirmou timer 30s/179s com CSS real: contraste 17,75:1 claro e 16,35:1 escuro, texto estático e pulso somente no ícone/reduced-motion. ESLint anterior sem erros, somente dois warnings preexistentes de constantes não utilizadas em DashboardLayout. A geração do CSS do harness sinaliza classes ambíguas já presentes no conteúdo global, sem alterar esses arquivos fora do escopo.

Resultados finais dirigidos, após retomada e revisão:

- `node node_modules/vitest/vitest.mjs run src/components/exam/ExamTimerAnnouncement.test.tsx src/lib/errorMonitoring.test.ts src/lib/preloadRecovery.test.ts src/components/ErrorBoundary.test.tsx src/components/exam/ExamHeader.test.tsx --maxWorkers=2`: **32 passed, 5 arquivos**.
- `CRITICAL_E2E_MODE=safety` com `node node_modules/@playwright/test/cli.js test --config e2e/critical.config.ts`: **5 passed**, fontes recusadas sem falso unsafe e auth de produção bloqueado antes do encaminhamento. Todas as respostas permitidas são mocks locais.
- `CRITICAL_E2E_MODE=harness` com o mesmo CLI e `--grep 'recovery 375/dark'`: **1 passed**, incluindo contraste de `Finalizar` **≥4,5:1** nos estados normal/hover/foco. A primeira tentativa pontual encontrou sobreposição do aviso de recovery no próprio teste; a medição passou a ocorrer antes de simular essa falha, sem mudança adicional no produto.
- Fluxo real com `CRITICAL_E2E_ENV=DISABLED`: **1 SKIPPED**, nenhuma navegação/login/mutação real. `--list`: somente 1 cenário real; safety não entra nessa contagem.
- ESLint dirigido aos arquivos da revisão: **0 erros, 0 warnings**. `git diff --check`: sem erros de whitespace, apenas avisos de conversão LF/CRLF do ambiente.

Nenhuma suíte global, typecheck/build global, instalação local, commit, deploy ou execução Supabase real foi realizada. Monitoramento externo continua desabilitado sem transporte aprovado; Esc/Integrity permanece fora deste escopo.
