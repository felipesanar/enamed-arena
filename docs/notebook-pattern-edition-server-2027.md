# Caderno Pattern Insights: Server por Edicao

## Escopo

Endpoint `supabase/functions/caderno-pattern-insights`. Runtime Deno fino em
`index.ts`; factory injetavel em `handler.ts`; validacao, fingerprint e isolamento
em `scope.ts`. Nao altera frontend, SQL, migrations, tipos gerados ou helpers
compartilhados. Referencias: HANDOFF-2027, F2-1, F2-2, F2-7.

## Contrato HTTP

- `OPTIONS` preserva preflight CORS; somente `POST` processa dados; demais metodos: 405.
- Bearer case-insensitive e token unico. Cliente Supabase usa somente anon key e
  Authorization encaminhada; `getUser(token)` verifica identidade real. Falha de
  autenticacao: 401. Role verificada `service_role`/`anon` nao representa aluno.
- `profiles.segment` do `user.id` real deve ser `pro`; nao-PRO: 403. Erro retornado
  na consulta de perfil: 503. Nenhum claim/body concede PRO.
- Body omitido ou vazio aceita `{}`. JSON presente malformado, nao-objeto, array,
  ou null: 400. Leitura streaming limita bytes UTF-8 a 128 KiB: 413.
- `editionId` ausente/null: cumulativo. UUID explicito: validado contra
  `get_exam_editions()` usando o mesmo cliente autenticado. Tipo/UUID/desconhecida:
  400. Erro de catalogo: 503; formato de resposta de catalogo invalido: 502.
- `userId`, nomes, segmento, perfil, labels, datas, formato, corte e quaisquer
  outros hints do body nao sao fontes de identidade/contexto.
- Dados exclusivamente de `get_caderno_pattern_data({p_user_id: user.id,
  p_edition_id: UUID|null})`. A chave de edicao sempre e enviada, inclusive null.
  Erro de RPC/assinatura ausente: 503, sem chamada legada ou fallback global.
- Agregado invalido: 502; nao e convertido em dados vazios. Arrays SQL null sao
  normalizados para arrays vazios; contagens e linhas sao validadas.
- Mantem `insights`, `generated_at`, `has_sufficient_data`, `from_cache`, `message`
  quando aplicavel; acrescenta `editionId` e `editionLabel`. Label vem do catalogo
  ou `Todas as edicoes` (a resposta usa acentuacao em portugues).
- Menos de 5 entradas retorna resposta insuficiente sem Gemini/cache e sem exigir
  chave de IA. Nenhum scoring RPC, criacao de usuario ou alteracao de notas.

## Cache Sem Migracao

Mantem a tabela existente e chave unica `user_id`. Upsert sempre usa o usuario
autenticado, `onConflict: user_id`. Uma edicao pode substituir o cache anterior;
isso e um cache miss aceitavel, nao um resultado de outro escopo.

O payload armazena `versionContext: notebook-pattern-edition-v2`, `editionId`,
`dataHash` SHA-256, alem dos marcadores `cache_version: 2`, `editionScope` e
`patternHash`. Todos devem coincidir. O hash canonicaliza chaves de objeto e
inclui agregados normalizados reais, label e formato oficial. Nao usa somente
`entry_count`; mudanca de dados com mesma contagem invalida o cache. Mudanca de
ordem em arrays pode provocar miss conservador.

TTL estrito de 24 horas, sem aceitar timestamp futuro ou invalido. Payload sem
tags, outro escopo/hash, metadados divergentes ou insights malformados e miss.
Nao devolve tags internas ao cliente. Falhas retornadas/lancadas de leitura ou
gravacao nao impedem resposta nova e nao autorizam contexto incorreto.

## IA e Privacidade

Usa `resolveGeminiModel` e `geminiUrl` compartilhados, somente leitura.
`GEMINI_MODEL` ausente usa `gemini-2.5-flash`; valor vazio/URL insegura e rejeitado.
`GEMINI_API_KEY` ausente so impede geracao nova, nao resposta insuficiente/cache
valido. Nao usa gateway Lovable nem modelo hardcoded na chamada.

Requisicao Gemini REST injetavel, JSON validado estruturalmente, timeout de 25s
incluindo retries/leitura de resposta e uma repeticao em 429/5xx, espera de
1200ms. 429 persistente permanece 429; timeout: 504; upstream/resposta invalida:
502. Sem logs ou reflexao de tokens, env, erros brutos e evidencias pessoais.

Prompt recebe label/formato oficial disponivel e agregados de causas/confianca.
Nao recebe usuario, UUID de edicao, perfil, chaves arbitrarias de RPC/body nem
textos livres de questoes manuais. Decisao conservadora: omitir amostras clinicas
potencialmente pessoais e nao gerar `comparison_table` sem essas fontes.
Mantem orientacoes pedagogicas e limiares dos tipos de insight anteriores.
Nao inventa formato, datas oficiais, percentil, TRI, corte, chance ou meta fixa.

Cumulativo inclui manuais conforme SQL e remove `roi_data` antes do prompt;
tambem remove insights `roi` da resposta e explica indisponibilidade ate selecionar
edicao. Explicito usa ROI calculado pelo SQL somente naquela edicao. Diagnostico
gerado por IA continua sujeito a revisao humana de qualidade factual.

CTAs aceitam apenas root-path interno, rejeitam URL externa/protocol-relative,
barras invertidas, controles e escapes de separadores/controles. Rotas
`/caderno` e `/caderno/*` removem parametros edition/editionId do modelo e
recebem `edition` validado, ou nenhum parametro no cumulativo.

## Validacao Local

TDD preservou e expandiu `scope.test.ts`. Primeiro houve falha por setup global
dependente de window; configuracao Vitest local remove esse acoplamento. Em
seguida os testes falharam por modulos ausentes antes da implementacao. Teste
adicional de versionContext/dataHash tambem falhou antes da correcao do cache.

```powershell
node node_modules/vitest/vitest.mjs run supabase/functions/caderno-pattern-insights/scope.test.ts supabase/functions/caderno-pattern-insights/handler.test.ts --config supabase/functions/caderno-pattern-insights/vitest.config.ts --maxWorkers=2
```

23 testes offline com Requests/Responses reais, fake Supabase e fake Gemini.
Cobrem auth, PRO, IDOR, catalogo/RPC, parser, limite por bytes, escopo, cache
cross-edition com mesma contagem, versionamento/hash/TTL/falhas, privacidade,
modelos, links, ROI, insuficiencia, retry, timeout e resposta malformada.

Checagem TypeScript estrita limitada aos modulos/testes desta pasta, com imports
locais compartilhados resolvidos; nao e tsc global nem validacao do runtime Deno
remoto. Comando final (tambem inclui os modulos de producao importados):

```powershell
node node_modules/typescript/bin/tsc --noEmit --allowImportingTsExtensions --target ES2022 --module ESNext --moduleResolution bundler --lib ES2022,DOM --skipLibCheck --strict supabase/functions/caderno-pattern-insights/handler.test.ts supabase/functions/caderno-pattern-insights/scope.test.ts
```

`git diff --check` sem erros de whitespace (Git pode avisar conversao LF/CRLF).

## Revisao do Boundary Deno

Na revisao do orquestrador, os 23 testes independentes passaram, mas o Deno check
real revelou TS2589 (Type instantiation excessively deep) em `index.ts:4` ao
comparar estruturalmente o SupabaseClient generico com a dependencia do handler.
Essa falha reportada foi o vermelho deste ajuste.

Correcao limitada a `index.ts`: wrapper `createClient` com retorno explicito
`PatternClient`, usando assertion via `unknown` para nao expandir a comparacao
estrutural generica. Sem `any`, sem mudancas no handler, autenticacao, parametros
encaminhados ou contrato HTTP. Nenhum teste foi alterado nesta revisao.

Validacao real apos o ajuste, em 2026-11-04:

```powershell
$env:DENO_DIR = 'C:/Users/felipe.souza/Documents/Projetos (Sanar)/enamed-arena/.claude/worktrees/fase1-edicoes/.superpowers/runtimes/deno-cache'
& 'C:/Users/felipe.souza/Documents/Projetos (Sanar)/enamed-arena/.claude/worktrees/fase1-edicoes/.superpowers/runtimes/deno-2.9.8/deno.exe' check --cached-only --no-config supabase/functions/caderno-pattern-insights/index.ts
```

Resultado: exit code 0, `Check supabase/functions/caderno-pattern-insights/index.ts`,
sem erro TS2589. Usado exclusivamente o cache local indicado pelo orquestrador;
nenhum download de dependencia. Depois, o comando Vitest documentado acima foi
reexecutado: 2 arquivos passaram, 23 testes passaram, 0 falharam.

Nenhuma instalacao, rede real, leitura de `.env`, deploy, teste de Supabase/Gemini
real, observabilidade de producao, build global ou suite global foi realizado.
Integracao/deploy continuam com o orquestrador.
