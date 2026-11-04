# Validacao SQL Local

## Estado Real

Job `f1-sqlqa-643d`, 04/11/2026. Nenhuma conexao de producao, rede externa,
leitura de `.env`, alteracao de migration ou mudanca de papel global foi feita.
O preflight passou apos provisionamento dos roles pelo operador. A suite SQL
foi executada novamente com ICU e a migration real de auditoria:
**6 fixtures F0 passando + fixture de auditoria passando**.
O baseline local nao e um dump de producao; nao existe evidencia de diff vazio.

Evidencia desta rodada:

- `node --test scripts/sql-local/catalog.test.mjs scripts/sql-local/harness.test.mjs`: **19 passando, 0 falhando**, testes do harness/gerador, nao testes SQL. O ciclo vermelho desta rodada falhou por ausencia de createDatabaseArgs; o guard SQL de locale tambem rejeitou o banco antigo C/C antes de passar nos novos bancos ICU.
- Catalogo Unicode: `scripts/sql-local/runs/20261104075418503_34180/report.json`, status `completed`. Restauracao, verificacao do catalogo, selftest SQL e verificacoes de roles passaram. Sete migrations F0 + a migration extra real de auditoria aplicadas; T1/T2/T3/T4/T5/T6 passaram.
- Fixture extra `fase0_admin_audit.sql`: passou, **93 assercoes**, mais verificacoes RLS de leitor/admin. Arquivo real externo a este worktree, sem copia ou adaptacao.
- Modo T6 vazio isolado: `scripts/sql-local/runs/20261104075437199_36368/report.json`, status `completed`, T6 passou; outras cinco fixtures `not_run` por desenho desse modo.
- Historico: `20261104072409551_31624` tinha falha de auditoria T2; superada nesta rodada pela migration real. Replay `20261104072546246_35308` continua documentado como parcial por trigger duplicado, sem skip de migration.
- Runs anteriores que pararam por `anon` ausente sao historicos; esse pre-requisito esta resolvido. Nao foram necessarios roles adicionais.
- Todos os runs, logs e SQL gerado ficam em `scripts/sql-local/runs/`, ignorado por `.gitignore` local. Nao versionar o snapshot original, SQL restaurado nem outputs de maquina.
- Checks anteriores de diff constam no historico; a verificacao atual usa testes Node, sintaxe e execucao SQL real.

## Banco Unicode Para F1

Banco F0 validado nesta rodada, preservado para Codex ensaiar F1 model/target:
`enamed_test_sqlqa_20261104075418503_34180_catalog`.
Contem catalogo sanitizado restaurado, sete migrations F0 e a correcao real de
auditoria. F1 **nao foi aplicada nem testada por este job**.

O log `024-state-after-fixtures.log` confirmou zero auth.users, zero attempts,
zero simulados de fixture/repro e as 25 capabilities capturadas. Os papeis
continuam NOLOGIN/NOSUPERUSER, anon/auth sem BYPASSRLS e service_role com BYPASSRLS.
O banco `enamed_test_sqlqa_20261104075418503_34180_t6` foi reservado ao T6 vazio.
Nenhum banco antigo foi alterado para trocar seu locale ou apagado.

### Locale Unicode

Toda nova criacao usa template0 e flags fixas `--encoding=UTF8`,
`--locale-provider=icu`, `--icu-locale=en-US`, incluindo o banco vazio T6.
O banco de manutencao continua `enamed_test_fase0`; seu locale nao e alterado.
Falha em criar ICU ou em validar o casing encerra a rodada; nao ha fallback C.
`locale-check.sql` verifica provider `i`, datlocale `en-US`, UTF8,
`lower(chr(205))=chr(237)`, caixa inversa e lower de CLINICA MEDICA com acentos.
Todos passaram, com metadados em `report.locales` e logs `locale-*`.

Com ICU, datcollate/datctype ainda aparecem como C/C neste PostgreSQL portatil;
o provider efetivo e `i`, datlocale `en-US`, e o comportamento Unicode foi
verificado em SQL. **ICU en-US e aproximacao Unicode do libc en_US.UTF-8 de
producao, nao prova igualdade completa de ordenacao/collation.** Nao foi alterada
nenhuma funcao normalize_exam_area do produto, nem feita conexao a producao.

### Extras Explicitos

`--extra-migration` e `--extra-test` aceitam um arquivo cada, apenas em modo
catalog. O caminho real deve estar dentro deste workspace enamed-arena,
incluindo os worktrees irmaos, e corresponder a supabase/migrations com timestamp
ou supabase/tests/fase0_*.sql. Caminhos fora do workspace, escapes por realpath,
arquivos ausentes e tipos incorretos sao recusados antes de criar artefatos/DB.
O hash e revalidado antes de executar. Nao ha adaptacao nem copia desses SQLs;
psql aponta ao arquivo original, com guard e ON_ERROR_STOP.

Na rodada verde, arquivos em
`../fase0-2027-fase0-audit/supabase/` (relativo a este worktree):

- Migration: `migrations/20261104073257_fase0_admin_audit_record_fix.sql`, SHA-256 `a1bc76ff6cb2c4e26d0171da5393b7479e68bcccc0739af29972d3e74898b9d9`.
- Teste: `tests/fase0_admin_audit.sql`, SHA-256 `91675c0fc45e2aed22c5ce08659e2fec148d17c30245e2728706ecfef00cd023`.

Executar novamente desde este worktree (gera novos bancos, nao modifica o validado):

```powershell
node scripts/sql-local/run.mjs --maintenance-db enamed_test_fase0 --mode catalog --catalog "C:/Users/felipe.souza/Documents/Projetos (Sanar)/enamed-arena/.claude/worktrees/fase1-edicoes/.superpowers/editions/production-schema.json" --extra-migration "../fase0-2027-fase0-audit/supabase/migrations/20261104073257_fase0_admin_audit_record_fix.sql" --extra-test "../fase0-2027-fase0-audit/supabase/tests/fase0_admin_audit.sql"
```

## Historico Sem A Correcao

Banco para investigacao/F1, com catalogo restaurado e sete migrations F0:
`enamed_test_sqlqa_20261104072409551_31624_catalog`. Fixtures e repro usam rollback;
nao ha dados de aluno. Este banco tem **falha T2 conhecida**, nao e baseline verde.
O banco `enamed_test_sqlqa_20261104072409551_31624_t6` esta vazio apos rollback T6.
O banco `enamed_test_sqlqa_20261104072546246_35308_replay` e replay parcial,
**nao usar como baseline F1**. Outros bancos e seus estados estao nos reports
ignorados; todos foram preservados, nenhum cleanup foi executado.

`state-check.sql` executado no banco catalogo apos a repro confirmou endpoint
127.0.0.1:54737, zero auth.users, zero attempts, zero simulados das fixtures/repro,
25 capabilities, anon/authenticated NOLOGIN NOSUPERUSER NOBYPASSRLS e
service_role NOLOGIN NOSUPERUSER BYPASSRLS.

Repro minima do defeito legado (executada; termina com erro, transacao desfeita
na desconexao):

```powershell
node scripts/sql-local/check-file.mjs enamed_test_sqlqa_20261104072409551_31624_catalog supabase/tests/local/audit-release-repro.sql
```

Com `auth.uid()` nao nulo, um UPDATE em simulados entra no CASE de
`tg_admin_audit()`, cuja expressao referencia campos de tres tipos de registro.
O PostgreSQL rejeita `NEW.question_number` inexistente em simulados antes de
registrar a auditoria. O corpo e os triggers vieram do catalogo real, sem
adaptacao. Nao foi corrigido nem desabilitado o trigger para tornar T2 verde.
`inspect-audit.sql` mostra funcao e bindings locais sem dados de aluno.

O banco-semente autorizado agora e `enamed_test_fase0`, no endpoint ja fixado.
Nao conectar `postgres`/`template1` nem ampliar a allowlist silenciosamente.

Os papeis locais `anon`, `authenticated` e `service_role` ja existem.
O preflight exige anon/authenticated sem SUPERUSER/BYPASSRLS nem membership em
postgres/service_role; service_role deve ser BYPASSRLS sem SUPERUSER. O harness
nao cria nem altera roles, que sao globais ao cluster. T6 tambem foi ajustado
para exigir papeis existentes, em vez de cria-los dentro de uma transacao.

```powershell
node --test scripts/sql-local/catalog.test.mjs scripts/sql-local/harness.test.mjs
node scripts/sql-local/run.mjs --maintenance-db enamed_test_fase0
```

Apenas T6, depois de os roles locais estarem provisionados pelo operador:

```powershell
node scripts/sql-local/run.mjs --maintenance-db enamed_test_fase0 --mode integrations
```

Nao ha instalacao, Docker, dependencia npm adicional ou variavel de ambiente.
Os executaveis sao chamados por caminho completo em:

```text
C:/Users/felipe.souza/Documents/Projetos (Sanar)/enamed-arena/.claude/worktrees/fase0-2027/.superpowers/editions/pg17-1260616/pgsql/bin
```

## Restauracao Do Catalogo

O modo `catalog` substitui o replay historico pelo catalogo explicitamente
autorizado e aplica depois somente migrations F0 a partir de `20261104000000`.
Nao e fallback automatico apos erro de migration:

```powershell
node scripts/sql-local/run.mjs --maintenance-db enamed_test_fase0 --mode catalog --catalog "C:/Users/felipe.souza/Documents/Projetos (Sanar)/enamed-arena/.claude/worktrees/fase1-edicoes/.superpowers/editions/production-schema.json"
```

O arquivo autorizado foi processado, com SHA-256
`9cfa42cdd632df5815c4e5c7bbb67a4cf0be44b27b876eddf9991ba1c6309526`:
34 relacoes, 115 funcoes, 125 constraints, 79 policies, 5 ACLs de coluna e
25 linhas capturadas de role_capabilities. O SQL de restauracao e verificacao
foi executado e passou nas rodadas `20261104072409551_31624` e
`20261104075418503_34180` (Unicode + auditoria).
A primeira verificacao encontrou apenas diferenca de pretty-print de CHECK
(`CHECK ((...))` vs `CHECK (...)`). O harness foi corrigido com TDD para usar
`pg_get_constraintdef(oid,true)`, como na captura, sem alterar constraints.

O restaurador mantem definicoes de funcoes, owners suportados, SECURITY DEFINER,
RLS/force RLS e ACLs explicitas de tabelas, colunas e funcoes. Gera verificacoes
de owner, flags RLS, ACLs, SECURITY DEFINER e constraints antes de F0. Campos
obrigatorios ausentes, owners/roles ou formatos nao suportados falham fechado.
Policies sao recriadas, mas nao ha comparacao completa de suas expressoes.

Limites: auth/servicos continuam doubles; grantor historico nao e impersonado;
owners/USAGE de schemas, privileges do banco, memberships, reloptions de views,
collations, internals das extensoes e defaults globais nao estao reproduzidos.
Defaults de schema capturados sao aplicados apenas para owner postgres; outros
owners sao registrados como desvio. Nao ha equivalencia completa de producao,
pgdiff vazio, ou validacao de servicos Supabase gerenciados nesta rodada.

## Protecoes

- Host literal `127.0.0.1`, porta `54737`, usuario `postgres`; banco correspondente a `^enamed_test_[a-z0-9_]+$`, ate 63 caracteres. URLs, parametros libpq embutidos, hosts alternativos e banco principal sao recusados antes de spawn.
- O banco de manutencao de createdb/dropdb tambem obedece a allowlist. Nao ha fallback para postgres/template1. `template0` e apenas a fonte do CREATE DATABASE, nao um destino de conexao.
- `psql -X -w -v ON_ERROR_STOP=1`; ambiente PG herdado removido; passfile apontado ao dispositivo nulo e SSL desabilitado no loopback trust. Sem prompt, service file ou leitura de senha.
- Guard SQL confere endereco/porta reais, session_user, nome do banco e `plpgsql.check_asserts=on` antes das fixtures.
- Timeout de 180 segundos por subprocesso; erro SQL, spawn, timeout e sinal geram status nao verde. O primeiro erro encerra preflight/preparacao/replay; nada de pular migration que falhou. Fixtures sao transacoes independentes: cada uma para no primeiro erro, registra failed e permite tentar as demais, sem declarar a suite verde.
- Cada rodada cria nomes unicos para T6 e replay. Nao se conecta a banco desconhecido para destrui-lo e recria-lo. Bancos/evidencias ficam preservados mesmo em falha.
- No replay legado, grants locais que imitam defaults da API sao aplicados antes do replay, nunca depois dos REVOKEs F0. No modo catalogo, esses grants amplos sao DESABILITADOS e substituidos exclusivamente por ACLs capturadas. Identidade e capacidade nao sao retornos constantes: auth.uid le claims e has_capability vem das funcoes reais.
- Report registra status individual, SHA-256 de cada migration tentada e adaptacoes. Logs redigem tokens com formato JWT; nao ha dump de dados de producao. As fixtures usam somente dados sinteticos.

O SQL historico e confiado como codigo do repositorio, nao como entrada arbitraria.
Antes de usar este harness com migrations novas, revisar chamadas externas e novas
dependencias. Nao apontar o script para SQL remoto ou snapshots privados.

## Ordem E Doubles

1. Preflight read-only no banco-semente.
2. Criar banco vazio exclusivo T6, executar `fase0_integration_jobs.sql`, que usa seus proprios mocks em transacao com rollback.
3. Criar outro banco vazio, instalar doubles locais explicitos e testar negativamente os helpers de assercao.
4. Reaplicar todos os arquivos historicos em ordem de nome ate `20261104054334_fase0_question_release.sql`, inclusive as sete migrations F0. Nenhum skip automatico de duplicatas ou migrations de dados.
5. Verificar identidade/ownership e executar T1, T2, T3, T4 e T5 em transacoes com rollback. T2 recebe `sql_local=true`; sem essa variavel preserva seu caminho pgTAP original.

Os doubles vivem em `supabase/tests/local/bootstrap.sql`:

| Dependencia | Double | O que nao comprova |
|---|---|---|
| Auth | auth.users minimo, auth.uid/auth.role leem claims; roles reais existentes | JWT assinado, GoTrue, PostgREST, refresh/expiracao de sessao |
| Storage | buckets/objects/foldername minimos, RLS habilitada | upload, assinatura, gateway, demais colunas/privilegios reais |
| pg_net | net.http_post e alias legado extensions.http_post inertes | transporte HTTP, async worker, resposta ou entrega |
| Vault | tabela vazia privada, nenhum secret real | criptografia, permissao gerenciada, secret Edge correspondente |
| cron | tabela job e schedule/unschedule sem worker | extensao instalada, scheduler, execucao automatica em 5 minutos |
| pgTAP | apenas no_plan/ok/is/throws_ok/lives_ok/finish usados por T2 | compatibilidade geral com pgTAP ou seu protocolo TAP |

O helper minimo executa SQL como INVOKER. `ok(NULL)` falha; `throws_ok` exige
excecao e SQLSTATE correto, e mensagem exata quando fornecida. O selftest exige
que falso, NULL, valores diferentes, ausencia de excecao, SQLSTATE/mensagem
incorretos e erro inesperado falhem. Tambem confere que SQL dinamico nao herda
privilegios de owner. O contador reporta assercoes realmente executadas; nao ha
linhas PASS pre-fabricadas. Esse selftest SQL foi executado e passou.

Somente duas adaptacoes textuais explicitas de SQL em memoria:

- A migration historica `20260402191728...` nao instala pg_net: usa o transporte inerte. Todo seu restante, inclusive trigger, permanece no replay.
- `20261104053227_fase0_attempt_jobs.sql` verifica a interface mock cron.schedule em vez de pg_extension. Nao se insere registro falso no catalogo pg_extension. A precondicao original de extensao e uma exigencia de deploy real que esta rodada **nao valida**. O corpo de fila/manutencao e o agendamento permanecem inalterados.

Cada substituicao exige exatamente uma ocorrencia do texto esperado; drift falha
fechado. Nao sao adaptadas regras de auth, RLS, scoring, release ou FK de produto.
Extensoes adicionais, como pgcrypto/unaccent, permanecem reais: se indisponiveis,
o replay para. A presenca do double nao autoriza mudar ACL de produto.

## Limites Do Replay

Ha uma colisao legada **reproduzida no replay local**:
`20260326143000...` cria o trigger
`update_user_performance_summary_updated_at`; `20260326170737...`, linha 32,
tenta cria-lo novamente sem DROP. Tambem ha policies repetidas nesses arquivos
e nos dois arquivos de attempt_question_results de 26/03. Portanto a ordem pura
parou antes de chegar a F0, com erro de trigger duplicado na linha 35 da segunda
migration. Nao houve alteracao desses arquivos nem um skip
que esconda essa falha.

`supabase/tests/local/legacy-replay-repro.sql` preserva uma reproducao a partir
dos arquivos reais, para banco vazio permitido. Ela nao foi executada. Usa guard,
preflight, bootstrap e a sequencia ate a colisao; o erro esperado encerra psql e
a desconexao desfaz a transacao. Outra falha anterior deve ser registrada como
tal, nunca substituida por essa expectativa estatica.

Se necessario, o orquestrador pode autorizar reconciliacao da ordem/baseline em
nova rodada. Para comparar metadados reais, entregar resultado SQL sanitizado de
`supabase/tests/local/catalog-request.sql`: apenas SELECTs de colunas,
constraints, policies, ACLs e assinaturas/owners de funcoes. Nao inclui linhas
de usuarios, dados Vault, headers, filas HTTP, cron.command nem corpos de
funcoes legadas. O operador deve revisar os resultados antes de fornecer o
arquivo. Este job nao executou essas consultas em nenhum servico externo.

## Cobertura Local

| Fixture | Protecoes previstas | Nesta rodada |
|---|---|---|
| T1 exam_editions | seeds, invoker, ACL e RLS negativo/positivo por capacidade | passou |
| T2 exam_integrity | ownership, SQL role vs claim forjada, nota/deadline inalteraveis, respostas atrasadas +30/+31s, FKs de resposta, gates de resultados/ranking | passou com a migration real de auditoria |
| T3 question_release | gabarito/comentario inacessivel, release, upcoming/NULL/draft, owner vs outro usuario/admin | passou |
| T4 safe_finalization | 10/100, brancos, idempotencia, ACL, queue cutoff, falha isolada e expiracao | passou |
| T5 preserve_history | FKs RESTRICT imediatas/validadas, catalogo e DELETE de fixture, ACL de contagem | passou |
| T6 integration_jobs | rotacao/ausencia/duplicacao de secrets sinteticos, erro de enqueue, payload, cron idempotente e ACL | passou |
| Extra admin_audit | nove operacoes nas tres tabelas, identidade, snapshots/diff, maintenance, falha atomica e ACL/RLS | passou: 93 assercoes + RLS |

O ensaio concorrente de duas sessoes descrito no final de T2 continua manual e
nao foi automatizado/executado aqui. O PASS de T2 nao deve ser citado
como prova desse ensaio. As FKs de T5 sao exercitadas a partir da definicao de
catalogo em tabelas temporarias; nao substituem todo o fluxo de exclusao admin.
T4 inclui chamadas como owner: isso nao prova sozinho todos os gates REST.

Mesmo uma suite local verde nao comprova Supabase real: ACL/default privileges
do baseline, Auth/REST, concorrencia, worker cron, Vault/Edge, HTTP e entrega
HubSpot/email exigem validacao autorizada separada. Ver
`docs/fase0-integracoes-deploy.md`. Nao executar backlog historico nem rollout
com base neste ensaio.

## Limpeza

Depois de revisar as evidencias, o operador pode remover somente os bancos
registrados por uma rodada:

```powershell
node scripts/sql-local/cleanup.mjs scripts/sql-local/runs/ID_DA_RODADA/report.json
```

Cleanup valida endpoint, runId e cada nome exato de banco antes de chamar
`dropdb.exe` por caminho completo. Nao usa FORCE, nao mata sessoes, nao apaga
banco-semente, arquivos, diretorios ou junctions. Repetir o harness cria uma nova
rodada independente, sem reaproveitar estado parcial como baseline valido.
