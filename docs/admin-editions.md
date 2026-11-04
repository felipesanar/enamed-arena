# Admin de edições (F1-3)

## Integração

- Depende de F0 e de `20261104065001_fase1_edition_model.sql`, ainda em outro job. Esta migration não recria o modelo, não corrige `tg_admin_audit` e não liga `editions_ui`.
- `/admin/edicoes` é lazy, dentro de `AdminGuard`, com `EditionsUiGate` e `content.manage`. A página também protege sua montagem isolada. Flag ausente, pendente, inválida ou com erro permanece fechada pelo `useAppConfig` existente.
- Menu, paleta e recentes filtram Edições com flag e capacidade. As consultas a edições/matrizes/sequência e controles de clone só são montados/disparados na experiência habilitada.
- Flag desligada mantém os métodos/payloads antigos de criação/edição de simulados: não acrescenta `edition_id`, nem chama o método de publicação novo. O trigger SQL, entretanto, protege toda nova transição para publicado, inclusive clientes antigos; não há bypass legado para publicar prova incompleta.
- Tipos compartilhados e tipos gerados não foram modificados. Os casts ficam apenas na fronteira Supabase para objetos/RPCs ainda não gerados.

## Fluxos

- Edições: lista, carregamento, vazio, erro com retry, criação/edição e confirmação de salvamento. Todos os cinco estados do contrato estão disponíveis. Matriz é carregada do banco; pode permanecer desconhecida no rascunho. Não há atribuição automática de fonte, corte ou calendário de 2027.
- Datas oficiais permanecem strings `YYYY-MM-DD` ou `null`, sem conversão para instante UTC. Confirmar data exige uma data preenchida. Formato inicial proposto: 100 questões, 4 alternativas, 300 minutos e TRI, sem referência de proficiência ou corte presumida; é editável antes de salvar.
- Simulados: filtro/coluna de edição e clone em rascunho pelo menu da linha. Clone pede edição e nova janela, permite copiar questões/alternativas e não copia tentativas, respostas ou resultados.
- Novo simulado exige edição com a flag ativa e sugere sequência/slug por edição. A sugestão não reserva sequência: a constraint do banco é a autoridade em concorrência. Em conflito, os campos são preservados para correção/retry.
- `saveSimuladoWithEdition` salva primeiro como rascunho e só então chama `admin_publish_simulado`. O callback expõe o ID salvo antes da validação, permitindo reutilizar o mesmo rascunho se publicar falhar. Isso é deliberadamente **duas operações**, não uma transação de salvamento+publicação: a falha mantém o rascunho e informa o bloqueio ao administrador. A clonagem, por outro lado, é integralmente transacional no servidor.
- Guards de exclusão e `attempts_count` autoritativa de F0 foram preservados. Nenhuma contagem do cliente autoriza exclusão no servidor.

## Segurança e SQL

- `admin_upsert_edition(jsonb)` recebe DTO completo, valida identificação explícita, cinco status, calendário, confirmação, formato e matriz existente. ID de update inexistente gera erro, sem insert substituto. Escrita direta em `exam_editions` é revogada para authenticated; a RPC registra before/after.
- `admin_clone_simulado(uuid,uuid,timestamptz,timestamptz,timestamptz,boolean)` exige `content.manage`, bloqueia a edição destino e a origem, aloca `max(sequence)+1` e depende também da unique por edição. Falhas em qualquer questão/alternativa revertem tudo. IDs são novos, status é draft e proveniência aponta para a origem imediata.
- O clone usa duração da edição destino. Questões/alternativas são preservadas para revisão: divergência de quantidade/formato impede publicação posterior. Área de outra matriz não é reaproveitada; aliases normalizados e não ambíguos resolvem o destino, ou `area_id` permanece nulo no rascunho. Imagens continuam referenciando os objetos originais de Storage.
- `admin_publish_simulado(uuid)` e o trigger de entrada em published validam formato, duração, quantidade real e números 1..N únicos, alternativas A..N únicas, exatamente uma correta, texto preenchido, área da matriz e ordem/validade das janelas. Updates históricos que não entram em published não passam pela nova revalidação. Guards F1 de mudança de edição/matriz permanecem ativos.
- Locks de opções coordenam alterações com clone/publicação; os locks de questões/edição vêm também do modelo F1. A fixture de concorrência entre sessões continua necessária na integração.
- RPCs mutantes usam SECURITY DEFINER, search_path fixo, `admin_require`, ACL explícita e auditoria. Helpers internos não são RPCs executáveis por authenticated/anon/PUBLIC. Rollback manual está comentado na migration e não apaga histórico nem Storage.

## Interface e Tempo

- Componentes reais do app: Button, Label/Input no formulário existente, Dialog/Radix no clone, AdminPageHeader e shell administrativo. A implementação reutiliza tokens `admin-*` e a fonte herdada Plus Jakarta Sans; não instala Dendê nem substitui o design system existente. Overview do MCP Dendê consultado como referência, sem declarar conformidade da biblioteca não instalada.
- Layout de lista com tabela semântica e transformação em cartões abaixo de 600px, campos em uma coluna no celular, quebra de textos longos, foco visível e retorno ao disparador. Sem novos gráficos/KPIs ou animações decorativas; reduced-motion desativa transições na experiência nova.
- Entradas/saídas de janela usam `America/Sao_Paulo`, com indicação de horário de Brasília. O helper Intl valida roundtrip e rejeita datas inválidas e horários locais inexistentes, sem pacote adicional ou dependência do fuso do navegador.
- As fases de direção visual, novo protótipo e motion não foram repetidas: o HTML revisado é a referência, não produção. Capturas comparativas e medição de contraste em navegador ainda são pendências do orquestrador, não validações concluídas nesta execução.

## Verificação

Somente testes do escopo:

```powershell
npm run test -- src/admin/lib/brasiliaDateTime.test.ts src/admin/__tests__/editionsNavigation.test.ts src/admin/services/adminEditionsApi.test.ts src/admin/services/adminApi.editions.test.ts src/admin/__tests__/AdminEdicoes.test.tsx src/admin/__tests__/CloneSimuladoDialog.test.tsx src/admin/__tests__/AdminSimuladoForm.test.tsx src/admin/__tests__/AdminSimulados.test.tsx src/admin/__tests__/AdminSidebar.test.tsx
```

Resultado final desta execução: **9 arquivos, 56 testes passando e nenhum falhando** (exit 0). O lint restrito aos 24 arquivos TS/TSX alterados terminou com **0 erros e 52 avisos** (`no-explicit-any` e Fast Refresh, exit 0). `npm run typecheck` passou (exit 0) após reproduzir e corrigir os três acessos a `edition` possivelmente indefinida: a sugestão de sequência só atualiza o formulário após encontrar a edição, com narrowing explícito, sem non-null assertion. `git diff --check` não apontou erros de whitespace; emitiu apenas avisos de conversão LF/CRLF.

`supabase/tests/fase1_admin_editions.sql` é uma fixture transacional com rollback: ACLs/capacidade negativa, DTO, preservação de calendário, clone com IDs novos, origem/tentativas preservadas, falha forçada em alternativa sem clone parcial, publicação válida, bloqueio de publicação parcial/direta e preservação de 2026. A inspeção de gabarito usa `admin_get_simulado_questions` sob `authenticated`, com `content.manage`. A fixture também afirma que `authenticated` não tem SELECT em `question_options.is_correct` e que a leitura direta falha mesmo para o administrador. Nenhum GRANT adicional ou bypass de RLS/gates foi introduzido.

SQL executado no banco descartável de revisão fornecido pelo orquestrador, já com modelo F1, target e correção de auditoria, usando o PostgreSQL portátil autorizado. A migration administrativa foi reaplicada sem mudanças adicionais:

```powershell
$psql = 'C:/Users/felipe.souza/Documents/Projetos (Sanar)/enamed-arena/.claude/worktrees/fase0-2027/.superpowers/editions/pg17-1260616/pgsql/bin/psql.exe'
& $psql -X -w -h 127.0.0.1 -p 54737 -U postgres -d enamed_test_f1_admin_review_20261104 -v ON_ERROR_STOP=1 -f 'supabase/migrations/20261104073841_fase1_admin_editions.sql'
& $psql -X -w -h 127.0.0.1 -p 54737 -U postgres -d enamed_test_f1_admin_review_20261104 -v ON_ERROR_STOP=1 -f 'supabase/tests/fase1_admin_editions.sql'
```

- Reaplicação da migration: **exit 0**, encerrada em `COMMIT`.
- Fixture corrigida: **exit 0**, todas as asserções executadas, encerrada em `ROLLBACK`. Aviso de HubSpot sem segredo configurado no ambiente local; nenhuma configuração de segredo foi lida ou alterada.
- A revisão global anterior reportou 1.127 testes em 133 arquivos passando; essa suíte não foi repetida nesta correção.

Build sem plugin antigo, capturas 1440/768/375 claro/escuro e revisão integrada final ficam com o orquestrador. A revisão visual real será realizada por Codex. Nenhum deploy, commit ou ativação de flag foi realizado.

## Revisão Tablet e Concorrência

- Correção local em `editions.css`: somente entre 601 e 1100px, a coluna de ação usa padding horizontal de 6px e o botão de edição usa 8px e `white-space:nowrap`. As regras dos cartões abaixo de 600px e `AdminPageHeader` não foram alteradas. Padrões de layout Dendê consultados; mantidos os componentes/tokens existentes, sem migração de biblioteca. A verificação automatizada de CSS não substitui a repetição visual de 768px pelo Codex.
- Harness novo: `scripts/sql-local/admin-editions-concurrency.mjs` e `.test.mjs`, independente do harness do orquestrador, que foi apenas lido. A allowlist exige `127.0.0.1:54737`, usuário `postgres`, destino `enamed_test_admin_*` e template exato `enamed_test_f1_target_review_20261104`. Configurações PG herdadas são descartadas; `.env` não é lido. O template só recebe os comandos de criação/remoção do banco filho e leitura do catálogo, sem alteração dos seus dados.
- O harness cria seu próprio banco, aplica a migration administrativa original e executa a fixture transacional antes das disputas. Fixtures sintéticas são inseridas como postgres; chamadas de clone/publicação e inserções concorrentes de alternativas são executadas sob `authenticated` com `content.manage`. Observação dos locks é feita pelo holder com `RESET ROLE`, restaurando `authenticated` antes de continuar as operações de produto. ACL de `is_correct` continua revogada.
- Duas conexões psql persistentes reais: backends **37900** e **37488**, no ensaio `enamed_test_admin_concurrency_1793783228689_22936`. Cada barreira exigiu `pg_stat_activity.wait_event_type=Lock`, um lock não concedido em `pg_locks` e o PID do holder em `pg_blocking_pids`. Polling limitado a 4s, lock_timeout 6s, statement_timeout 8s e timeout do cliente 12s; não há sleep usado como evidência de bloqueio.
- Repetição final também passou: backends **34784** e **27524**, banco `enamed_test_admin_concurrency_1793783414125_28040`, mesmas três barreiras e resultados; banco removido e ausência confirmada ao final.
- Clone/clone na mesma edição: o primeiro clone manteve a transação aberta enquanto o segundo esperava o lock. Após commit, retornaram UUIDs distintos e sequências **4 e 5**. Origem, conteúdo retornado pela RPC de questões e contagem de tentativas permaneceram idênticos; os clones ficaram em draft, com questões novas e alternativas copiadas.
- Inserção/publicação: a alternativa B faltante ficou não confirmada na conexão A; publicação em B esperou e só publicou após o commit, com exatamente duas alternativas. Em outro simulado, uma terceira alternativa inválida ganhou o lock; após esperar seu commit, a publicação foi rejeitada com exit **3** e o simulado permaneceu `draft:3`. Esse exit 3 é esperado e verificado, não uma falha ignorada. Não foi necessário alterar a migration nesta rodada.
- Limites: prova em PostgreSQL local clonado do alvo, com serviços externos do harness local, não em Supabase/produção; sessões em isolamento padrão READ COMMITTED. Foram provados clone/clone e inserção que ganha o lock antes da publicação. Não se afirma imutabilidade de conteúdo publicado, cobertura de todas as ordens possíveis, de DELETE/UPDATE concorrentes ou teste de carga. O snapshot da origem desta fixture tem zero tentativas; não substitui os testes F0 de histórico com tentativas reais.

Comandos desta rodada e resultados:

```powershell
node --test scripts/sql-local/admin-editions-concurrency.test.mjs
node scripts/sql-local/admin-editions-concurrency.mjs
npm run test -- src/admin/__tests__/AdminEdicoes.test.tsx
npx --no-install eslint scripts/sql-local/admin-editions-concurrency.mjs scripts/sql-local/admin-editions-concurrency.test.mjs src/admin/pages/AdminEdicoes.tsx
```

- TDD: a execução inicial falhou por ausência do módulo; após implementação, **4 testes Node passaram, 0 falharam** (exit 0), incluindo allowlist, ambiente PG, barreira e regressão estática de CSS. Vitest: **5 testes passaram, 0 falharam** (exit 0).
- Prova real: script exit **0**; criação, migration e fixture exit **0**; sessões encerradas com exits **0 e 3** (rejeição deliberada da publicação inválida); remoção do banco exit **0** e catálogo confirmou ausência do banco. Nenhum ID sintético ficou retido.
- Lint restrito exit **0**. Para os dois MJS, também aplicado explicitamente `@eslint/js` recommended com `globals.node` via API do ESLint, sem editar configuração global: **0 erros e 0 avisos**. Sem suíte global, build, ativação de flag ou deploy. Harness visual ignorado do orquestrador não foi editado.
