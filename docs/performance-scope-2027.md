# Desempenho Por Edicao (F1-7 SQL)

## Contrato

Implementa `docs/contracts/performance-scope-2027.md` e a parte SQL de F1-7 em
`HANDOFF-2027.md`. Colunas, tipos e significado dos resultados permanecem iguais.
Existe apenas uma assinatura de cada RPC, sem overloads com defaults concorrentes:

```sql
get_user_performance_summary(
  p_user_id uuid default auth.uid(),
  p_edition_id uuid default null,
  p_include_training boolean default true
);
get_user_performance_history(
  p_user_id uuid default auth.uid(),
  p_limit integer default null,
  p_edition_id uuid default null,
  p_include_training boolean default true,
  p_offset integer default 0
);
```

- Sem edicao e com treino incluido: mesmas linhas liberadas da consulta legada,
  inclusive duplicatas de modalidade e treino. A unica mudanca intencional no
  default do historico e a remocao do teto de 20.
- Com edicao explicita OU treino excluido: tentativas `submitted`/`expired`, nota
  nao nula, simulado liberado e filtro de edicao por `simulados.edition_id`.
  `p_include_training=false` exige `is_within_window=true`, como o ranking F0.
- No caminho novo, uma tentativa por usuario/simulado: maior nota, termino mais
  antigo (NULL por ultimo), menor UUID. Online, offline e presencial concorrem
  pela mesma vaga, sem somar modalidades como provas diferentes.
- Edicao explicita com treino incluido tambem deduplica, mas permite tentativas
  fora da janela participarem da escolha. O legado sem edicao nao deduplica.
- A escolha ocorre em `attempts` antes do join com historico. Se a vencedora nao
  tem historico, nao substituimos por uma tentativa pior nem reprocessamos dados.
- Os valores retornados continuam vindo de `user_performance_history`, nao de
  uma nova formula de nota. Nenhum calculo de TRI, corte ou proficiencia.
- `p_limit=NULL` retorna tudo; limite explicito continua respeitado, incluindo
  clamp legado de limites <=0 para 1. Offset NULL/negativo vira 0. Paginacao vem
  depois da deduplicacao e usa termino DESC, simulado DESC, tentativa DESC.
- Boolean NULL e tratado como default true. Summary usa todo o historico do
  mesmo escopo, sem paginacao. Sem resultados, ambos retornam zero linhas.
- UI deve resolver a edicao antes de chamar o novo KPI com treino excluido.
  Edicao NULL nao significa automaticamente a edicao-alvo do aluno.

## Seguranca E Fonte

Inspecionados programaticamente somente os objetos necessarios do snapshot
sanitizado `production-schema.json` (capturado em 2026-11-04), as migrations F0
e as definicoes/ACL reais do clone target com F0 + auditfix + model + target.
O ranking efetivo vem de `20261104052758_fase0_exam_integrity.sql`, nao da
definicao anterior do snapshot.

Preservados explicitamente `STABLE SECURITY INVOKER`, `search_path=public`,
owner `postgres` e EXECUTE para PUBLIC, anon, authenticated e service_role.
Esses eram os ACL reais das duas RPCs; EXECUTE nao concede acesso a dados.
Identidade e sempre `auth.uid()`, com igualdade explicita ao usuario solicitado,
ownership das linhas e RLS do invocador. Nao ha preview administrativo, acesso a
gabaritos ou agregacao de outro aluno. O gate `results_release_at<=now()` existe
nos dois caminhos. Nenhum gate de ownership/release foi retirado.

Os dois signatures antigos precisam de DROP para adicionar parametros sem
ambiguidade PostgREST. A consulta de dependencias entrantes em `pg_depend` no
target retornou zero linhas. DROP usa RESTRICT, sem CASCADE: dependencia nova
interrompe a migration atomicamente. Em reaplicacao, os signatures antigos nao
existem e as funcoes novas sao substituidas, mantendo uma unica assinatura.

## Validacao Local

Banco exclusivo: `enamed_test_performance_20261104_f17`, em
`127.0.0.1:54737`, clonado de `enamed_test_f1_target_review_20261104` via conexao
`postgres`. Nenhum outro banco foi alterado e nenhuma conexao de producao foi usada.
Executavel: diretorio PG portatil informado na tarefa, `pg17-1260616/pgsql/bin`.

Comandos executados com `psql -X -h 127.0.0.1 -p 54737 -U postgres`:

```sql
-- -d postgres -v ON_ERROR_STOP=1 -c "..." (exit 0)
CREATE DATABASE enamed_test_performance_20261104_f17
  TEMPLATE enamed_test_f1_target_review_20261104;
```

```powershell
# Acrescentar o prefixo completo do psql acima a cada chamada:
# RED: -d enamed_test_performance_20261104_f17 -v ON_ERROR_STOP=1
#      -f supabase/tests/fase1_performance_scope.sql
# GREEN/reaplicacao: mesmo banco e flags, com os dois -f em sequencia
-f supabase/migrations/20261104084903_fase1_performance_scope.sql
-f supabase/tests/fase1_performance_scope.sql
```

RED: psql exit 3 no ASSERT do teto legado. Durante o ajuste inicial da fixture,
um INSERT com release NULL foi rejeitado por NOT NULL; corrigido para release
futuro, sem relaxar constraints. A contagem esperada da fixture legada foi
corrigida de 31 para 32 (26 principais + 6 duplicatas liberadas do titular).

GREEN: teste isolado apos a primeira aplicacao, exit 0. Validacao final com
reaplicacao da migration seguida do mesmo teste: exit 0, 42 ASSERTs sem falhas
(anon pode retornar vazio ou receber negacao de ACL, ambos aceitos explicitamente).
Depois do ROLLBACK: attempts=0, history=0, summary=0; trigger de HubSpot novamente
habilitado (`tgenabled=O`). Inspecao final confirma apenas os dois signatures
novos, ACL identico ao snapshot e invoker/search_path preservados.
`git diff --check` tambem passou. Nenhuma suite global foi executada.

O teste usa transacao e ROLLBACK, claims JWT e SET LOCAL ROLE reais. Mock/isolamento
gerenciado explicito: somente o trigger `on_profile_created_hubspot` e desativado
transacionalmente para nao disparar integracao externa. Auth/profile, RLS,
constraints, snapshots de edicao e RPCs nao sao mockados. `net.http_post` ja e um
stub SQL no clone target. Nao foram lidos segredos nem configurados servicos.

Cobre duas edicoes, treino, tres modalidades, empates por termino/UUID, status
nao finalizado, nota nula, liberacoes futuras, usuario vazio, outro usuario e
anonimo; chamadas antigas nomeadas/posicionais, >20 linhas, limite NULL/explicito,
offset e paridade com ranking F0. Compara contagem e conteudo JSON completo de
historico, attempts e resumo cacheado antes/depois das leituras.

## Operacao E Limites

A migration nao escreve em tabelas de negocio, finalizador ou caches; nao
recalcula backlog, nao apaga dados e nao requer fixtures adicionais. Testes
globais, frontend, tipos gerados, aplicacao em producao e deploy nao fazem parte
deste job. Em producao, revisar dependencias do ambiente antes de aplicar.
Historico sem limite pode ser grande: clientes podem paginar explicitamente;
offset e deterministico em um snapshot, mas insercoes entre requests podem
deslocar paginas. Consultas usam indices existentes, sem benchmark de carga.

Rollback manual comentado na migration: coordenar consumidores, remover apenas
os signatures novos com RESTRICT e restaurar as duas definicoes legadas com
owner/grants originais. Sem CASCADE, rollback de dados ou recomputacao.
