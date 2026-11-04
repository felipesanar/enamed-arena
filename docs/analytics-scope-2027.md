# Analytics Scope 2027

## Escopo e fonte

Implementacao exclusivamente SQL de F2-1/F2-3. Contratos: `docs/contracts/analytics-scope-2027.md`, `docs/contracts/editions-2027.md` e `HANDOFF-2027.md`, secoes F2-1/F2-3. Nao altera frontend, modelo, finalizador, desempenho, cortes, importacao ou admin. Nao executa finalizacao, reprocessamento ou backfill de tentativas.

Antes de escrever a migration, `git status --short` estava vazio. Foram extraidas com `pg_get_functiondef` as **cinco definicoes reais atuais**, owners, ACLs e dependencias de `enamed_test_f1_target_review_20261104` em `127.0.0.1:54737`, `session_user=postgres`. O JSON pre-F0 nao foi usado para substituir funcoes.

| Assinatura original | MD5 de pg_get_functiondef inspecionado | Owner |
| --- | --- | --- |
| `get_area_score_history(uuid)` | `289ebad49fffe8fb764eee26d5eea276` | postgres |
| `get_user_attempt_behavior_stats(uuid)` | `3ce5391b21b146d35c66232e4b95a686` | postgres |
| `get_caderno_pattern_data(uuid)` | `7c45e170ae1e0813011d0c18bb7c57cb` | postgres |
| `get_confidence_calibration(uuid)` | `5727a943b8d007fa323cbc2f91f7cf78` | postgres |
| `get_ranking_for_simulado(uuid)` | `b6075ae99838841f9132629f4202672f` | postgres |

A consulta a `pg_depend`, com `refclassid='pg_proc'::regclass`, nao retornou dependentes dessas funcoes no catalogo inspecionado. A migration repete a verificacao antes de expandir cada assinatura; uma dependencia nova bloqueia a operacao. Todos os drops usam `RESTRICT`, nunca `CASCADE`.

## Contratos mantidos

- As quatro RPCs de analises recebem `p_edition_id uuid DEFAULT NULL`; o default `p_user_id DEFAULT auth.uid()` de behavior e preservado. Nao ficam overloads antigos de um argumento. Chamadas legadas continuam resolvendo pelos defaults.
- Os corpos atuais das quatro analises sao adaptados a partir das definicoes inspecionadas e salvas no checkpoint. As chaves JSON, colunas, tipos, motivos e eventuais gates existentes permanecem no corpo. O adaptador valida as assinaturas/fontes esperadas e falha atomicamente se nao as reconhecer.
- O escopo e aplicado nas fontes, antes das agregacoes, `LATERAL ... LIMIT 1`, ROI, amostras `LIMIT 30` e confusao recorrente. Nao e um filtro aplicado ao JSON pronto.
- Cada leitura de tentativas exige owner exato igual a `auth.uid()`, status finalizado, `finished_at`, simulado publicado e liberacao de resultados no servidor. O gate tambem se aplica aos caminhos SECURITY DEFINER de `attempt_question_results` e `answers` atraves de sua tentativa associada. Behavior permanece SECURITY INVOKER e conserva RLS.
- `NULL` mantem a visao cumulativa autorizada, mas nao restaura o vazamento de resultados ainda nao liberados. A serie cumulativa por area conserva a politica original de somente `submitted`; a edicao explicita inclui `submitted`/`expired` e escolhe o melhor resultado elegivel por simulado. Score decrescente, finish crescente e ID imutavel seguem F0. Treino fica fora dessa serie explicita.
- Behavior e calibracao conservam suas politicas de linhas, nao viram ranking. Calibracao conserva `submitted`; caderno/ROI conservam o historico de revisoes e treino liberado. Nao ha deduplicacao indevida desses eventos.
- O caderno associa a edicao pelo simulado da entrada ou da questao. Uma associacao contraditoria nao e aceita. Entradas manuais sem questao e sem simulado continuam no cumulativo, nunca na edicao explicita. Entradas associadas a simulado exigem publicacao/liberacao. Nao se atribui um legado sem associacao a edicao corrente.
- Nao existia gate PRO nos corpos reais dessas cinco RPCs; nao foi inventada nova politica comercial. Guards existentes seriam conservados pelo adaptador. Nao houve ampliacao de acesso a outros alunos. As ACLs diretas sao transportadas, exceto os grants `PUBLIC`/`anon` indevidos da antiga behavior. O ranking conserva sua ACL e owner via `CREATE OR REPLACE` com assinatura identica.

## Foto do ranking

`get_ranking_for_simulado(uuid)` conserva as 12 colunas originais, o nome e segmento publicos, os gates de autenticacao/liberacao, exclusao de treino, escolha da melhor tentativa por usuario e desempates F0. Foi acrescentado gate explicito de publicacao, ausente na definicao local original.

Em edicoes `closed`/`archived`, especialidade e instituicoes vem de `specialty_id_at_finish` e `target_institution_ids_at_finish` **da tentativa vencedora**. Rotulos sao consultados somente pelos IDs canonicos congelados. A ordem do array de instituicoes segue a ordinalidade dos IDs, inclusive mantendo uma posicao NULL quando o ID ja nao tem rotulo no dicionario; uma foto nula retorna `NULL`, e um array vazio permanece vazio. Nao ha fallback ao onboarding atual, inclusive em fotos nulas/retropreenchidas. Em edicao aberta, permanecem os IDs/textos operacionais atuais.

`snapshot_backfilled=true` identifica uma aproximacao feita pela F1, nao uma reconstrucao fiel das preferencias na data historica. Esta migration somente le esses valores; nao os corrige nem reprocessa tentativas antigas.

## Reapply e rollback

A migration e uma unica instrucao `DO`, atomica inclusive em `psql -f`. O schema privado `analytics_scope_private` contem apenas definicoes/owners/ACL originais e estado de aplicacao, **nao dados pessoais**. A tabela tem RLS habilitada, sem policies publicas. Schema, tabela e helper de rollback tem acesso revogado de PUBLIC/anon/authenticated; o helper tambem e revogado de service_role, usa SECURITY INVOKER e search_path explicito.

Uma reaplicacao nao substitui o checkpoint original nem sobrescreve funcoes ja aplicadas. O teste edita intencionalmente uma definicao pos-aplicacao e prova que a reaplicacao conserva definicoes, owners, ACLs e hashes dos registros sinteticos. Depois de rollback, a migration pode expandir novamente as assinaturas.

Rollback manual, em janela privilegiada, apos revisao das dependencias e da compatibilidade dos chamadores:

```sql
BEGIN;
SELECT analytics_scope_private.rollback_analytics_scope();
COMMIT;
```

O helper restaura as cinco definicoes, owners e ACLs originais, sem apagar dados e sem remover o checkpoint. O teste compara definicoes e conjuntos exatos de grants apos a restauracao. **Isso tambem restaura os defeitos originais**, inclusive o grant anon/PUBLIC de behavior e os gaps antigos de liberacao; nao e um rollback de seguranca recomendado para producao sem revisao humana. Dependencias novas impedem o drop restrito em vez de serem apagadas.

## Verificacao local

Clones proprios: `enamed_test_analytics_20261104_092049` (iteracoes TDD) e `enamed_test_analytics_20261104_final` (validacao final do arquivo completo em clone limpo), criados com `CREATE DATABASE ... TEMPLATE enamed_test_f1_target_review_20261104` somente depois de confirmar host, porta, database e session_user. A fonte foi apenas lida; as alteracoes ocorreram exclusivamente nos clones. Auth/Storage/Vault sao doubles locais, nao servicos gerenciados reais.

PowerShell, a partir deste worktree:

```powershell
$psql = 'C:\Users\felipe.souza\Documents\Projetos (Sanar)\enamed-arena\.claude\worktrees\fase0-2027\.superpowers\editions\pg17-1260616\pgsql\bin\psql.exe'
& $psql -X -w -h 127.0.0.1 -p 54737 -U postgres -d enamed_test_analytics_20261104_final -v ON_ERROR_STOP=1 -c "SELECT 1 / ((inet_server_addr()='127.0.0.1'::inet AND inet_server_port()=54737 AND current_database()='enamed_test_analytics_20261104_final' AND session_user='postgres')::int);" -f 'supabase/migrations/20261104092049_fase2_analytics_scope.sql' -f 'supabase/tests/fase2_analytics_scope.sql'
```

- RED: fixture antes da implementacao interrompida na primeira ASSERT: `RED: edition-aware analytics signature is missing` (exit 3).
- GREEN: fixture completa, `ON_ERROR_STOP=1`, exit 0. **69 instrucoes ASSERT** no arquivo, com repeticoes em loops, alem de 11 chamadas negativas que exigem excecoes de ownership/autenticacao/ACL. Nenhuma ASSERT falhando no resultado final.
- Cobertura: duas edicoes com Simulado 1; online/offline/presencial; maior score/finish/ID; treino liberado; prova nao liberada; publicacao independente da data; todas as familias de chaves JSON/linhas; ROI antes/depois; mais de 30 amostras mais novas de outra edicao; caderno manual; edicao inexistente; owner diferente; anon real; foto nula/backfilled; onboarding trocado depois do finish; fechado/arquivado versus aberto; ordem dos IDs; ACL negativa; preservacao de dados/definicoes; rollback/reapply.
- Fixture usa apenas IDs e conteudos sinteticos em transacoes com ROLLBACK. Desabilita apenas localmente o trigger externo HubSpot e, para carregar historico sintetico, os guards de resposta/snapshot; esses guards sao reabilitados antes das chamadas autenticadas. Nenhum servico externo e chamado.
- Iteracoes da fixture corrigiram o nome real `question_options.label`, a unicidade de tentativa por modalidade (conservada, sem remover constraint) e a contagem cumulativa de confusao recorrente. A serie cumulativa por area foi ajustada para preservar exatamente `submitted`, sem estender o legado a `expired`.
- `git diff --check`: exit 0. Consulta final: uma unica assinatura por nome de RPC e zero usuarios sinteticos remanescentes. Nenhum teste global/frontend, instalacao, credencial, acesso externo, commit ou deploy.

Limites: estes testes validam PostgreSQL/RLS/SQL no clone com doubles, nao Auth real, PostgREST gerenciado ou performance em escala de producao. A revisao do orquestrador e a autorizacao de rollout continuam necessarias; Fase 1 em producao e pre-requisito de produto, nao algo executado por este job.
