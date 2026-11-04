# Higiene ENAMED 2027 (F3-9)

Verificação local em 04/11/2026, job `f3-hygiene-04f7`. Referências: `HANDOFF-2027.md` (F3-9), `HANDOFF-FASE0.md` e `docs/auditoria-enamed-2027.md` (U-22/U-27/U-28/R-16/I-06/I-08/F-07/F-08). As linhas da auditoria original eram de outro snapshot; as evidências abaixo são do código deste worktree antes da remoção.

## Inventário De Alcance

O relatório AST read-only fornecido pelo orquestrador, `.superpowers/hygiene-codex/reference-audit.json`, examinou 817 TS/TSX em `src`, com 511 alcançados desde `src/main.tsx`. Considerou imports estáticos, reexports e `import()` literal; não encontrou `import.meta.glob`. O relatório é apoio local ignorado pelo Git, não um artefato necessário ao aplicativo.

Conferência complementar via busca textual nos arquivos TS/TSX/JS/MJS/HTML/JSON do repositório: nomes dos candidatos, `pages/Index`, `import(`, `require(`, `import.meta.glob` e `require.context`. Nenhum consumer adicional, rota, reexport, glob ou carregamento por caminho calculado foi identificado para os candidatos. As ocorrências não literais de `import(` eram métodos `adminCutoffApi.import(...)` e uma string de fixture em `scripts/check-edge-function-pins.test.mjs`, não carregadores da home. Nomes homônimos foram conferidos pelo caminho, não só pelo símbolo. Buscas respeitaram os ignores do repositório, sem ler `.env` ou secrets.

| Candidato | Incoming references reais (sem teste próprio) | Decisão e cadeia |
|---|---|---|
| `src/pages/Index.tsx` | Nenhuma | Removido; `App.tsx:62-65` importa `HomePagePremium`, não Index |
| `src/components/SimuladoCard.tsx` | Nenhuma | Removido; o único import era `src/components/SimuladoCard.test.tsx:3`, removido junto |
| `src/components/premium/home/ActionCard.tsx` | Nenhuma | Removido; sem consumidor ou rota |
| `src/components/premium/home/HighlightsStrip.tsx` | Nenhuma | Removido; sem consumidor ou rota |
| `src/components/premium/home/EvolutionBlock.tsx` | Nenhuma | Removido; sem consumidor ou rota |
| `src/components/premium/home/InsightsSection.tsx` | Nenhuma | Removido; raiz morta da cadeia InsightCard |
| `src/components/premium/home/InsightCard.tsx` | `src/components/premium/home/InsightsSection.tsx:2` | Removido; único pai é morto e também removido |
| `src/components/premium/home/KpiGrid.tsx` | Nenhuma | Removido; raiz morta da cadeia KpiCard |
| `src/components/premium/home/KpiCard.tsx` | `src/components/premium/home/KpiGrid.tsx:3` | Removido; único pai é morto e também removido |
| `src/components/premium/home/QuickActionsSection.tsx` | Nenhuma | Removido; raiz morta da cadeia QuickActionCard |
| `src/components/premium/home/QuickActionCard.tsx` | `src/components/premium/home/QuickActionsSection.tsx:4` | Removido; único pai é morto e também removido |
| `src/components/premium/home/RankingExpressCard.tsx` | Nenhuma | Removido; sem consumidor ou rota |
| `src/components/premium/home/ResumeSection.tsx` | Nenhuma | Removido; raiz morta da cadeia ResumeCard |
| `src/components/premium/home/ResumeCard.tsx` | `src/components/premium/home/ResumeSection.tsx:3` | Removido; único pai é morto e também removido |
| `src/components/premium/home/UpcomingSimulationCard.tsx` | Nenhuma | Removido; sem consumidor ou rota |

São 15 módulos e o teste exclusivo do SimuladoCard, não uma meta artificial de 12. Não foram criados replacements nem alterados os demais módulos de home.

Preservados por evidência de uso:

- `src/components/CommandPalette.tsx`: importado em `src/components/AppLayout.tsx:4` e renderizado em `:65`.
- `src/components/caderno/insights/InsightCard.tsx`: usado em `src/pages/CadernoInsightsPage.tsx:43` e `src/components/caderno/showcase/InsightsSection.tsx:18`.
- `src/components/caderno/showcase/InsightsSection.tsx`: importado em `src/pages/CadernoV3ShowcasePage.tsx:13`.
- `src/components/premium/home/HomePagePremium.tsx`: home real, importada por `src/App.tsx:63`. Seu `KpiGridSection` é uma função local viva, não o arquivo KpiGrid removido. `App.tsx`, AppLayout e toda a home viva ficaram intactos.

## Copy E Gates

- U-27: PlanBillboard descreve simulados cronometrados **para preparação ao ENAMED**, não simulados oficiais. Segmentos, benefícios, CTA e destino comercial não foram alterados.
- O tutorial explica o ranking dos participantes da plataforma Sanar, treino fora do ranking, gestão do tempo e preparação para a edição-alvo. Não promete formato oficial idêntico, datas ou edital. Resultado, gabarito, correção/análise no treino e ranking respeitam a data de liberação configurada, que pode ser posterior à janela.
- Strings dos componentes atuais foram corrigidas preservando layout, motion, navegação e contratos. A revisão visual também corrigiu três classes de texto do tutorial para `text-white/80`: a classe anterior `text-white/72` não existia no CSS gerado, fazendo o corpo herdar uma cor inadequada no card escuro. Não houve auditoria completa de acessibilidade. A skill `interfaces-com-dende` foi lida; a consulta MCP não foi executada devido à proibição explícita de rede. O DS local foi mantido, sem redesenho ou nova tela.
- U-22 foi corrigido separadamente na Home pelo orquestrador (`21a3845`): erro do catálogo usa o retry real de `useSimulados`, substitui as mensagens de calendário vazio por erro explícito e conserva métricas válidas de desempenho/ranking e o prompt de edição. As regressões cobrem `editions_ui=false/true` e recuperação após sucesso. O job de higiene não alterou arquivos da Home.
- R-16: leitura confirmou `get_ranking_for_simulado` com `auth.uid() IS NOT NULL`, `s.results_release_at <= now()`, tentativa finalizada, nota não nula e `is_within_window=true` em `supabase/migrations/20261104052758_fase0_exam_integrity.sql:228-233`. A redefinição em `20261104092049_fase2_analytics_scope.sql:140-143` preserva o gate e exige `s.status='published'`. SQL foi somente lido; nada foi editado, executado ou verificado em produção.

## Identidade E Origens

- I-08: substituído `sanaflix.com` por `sanarflix.com.br`, já usado nas CTAs de `src/lib/sanarflix.ts`. O typo não permanece como alternativa permitida. O comentário de exemplo em request-password-reset foi corrigido sem alteração de código.
- Imagens: única alteração em `simuladosApi.ts` foi a constante `ALLOWED_IMAGE_HOST_PATTERNS`. O gate HTTPS e o parsing de hostname existentes foram preservados. Testes exercitam `getQuestions` e os três campos de imagem, não uma regex de inspeção de código. Supabase `.co`/`.in`, Sanar e previews Lovable mantêm a política anterior.
- E-mails: `appIdentity.ts` centraliza logo/default redirect em `https://simulados.sanar.com.br` e a allowlist de hosts de ação consumida por novu-email. A lista conserva exatamente os demais hosts anteriores deste contexto: Sanar, o app Lovable específico, previews `id-preview--*` e Supabase `.co`. Não herda a allowlist mais ampla das imagens ou do SSO.
- O parser HTTPS, escape HTML, remetente, autenticação, assinatura e envio dos handlers de e-mail não foram alterados. Os testes de e-mail cobrem as constantes e os padrões reais compartilhados de hostname, não alegam execução de templates ou do transporte Novu. Os handlers Deno não foram importados nos testes.
- SSO: handler reutiliza `isAllowedOrigin` e `corsHeaders` puros. Uma origem deve ser HTTPS e exatamente `URL.origin`, rejeitando credenciais, path (inclusive `/`), query, fragmento e URLs de Referer com caminho. Domínio e subdomínios SanarFlix/Sanar e os previews Lovable já permitidos continuam aceitos. Origens inválidas nunca são refletidas; o fallback é a origem fixa corrigida `https://sanarflix.com.br`. Sem Origin válido, o POST continua negado pelo gate existente.
- CORS não é autenticação. Não foram alterados token, HMAC, rate-limit, política de segmento, membership ou redirecionamento do magic link. A validação estrita não transforma um Referer arbitrário em origem confiável.

## Runtime E Hosting

`.nvmrc` e `package.json` definem Node `24.16.0`; `NODE_VERSION` do Netlify foi alinhado. CLAUDE/README agora refletem Vite `7.3.7`, Vitest `5.1.0` e CLAUDE registra `noImplicitAny=true`, `strictNullChecks=true` (com `strict=false`), conforme `tsconfig.app.json:16-17,26`.

O projeto tem origem Lovable e contém configurações Netlify e Vercel. Esses fatos não comprovam o hosting ativo nem auto-publicação. `vercel.json` e as demais configurações válidas foram preservados. Nenhum provider foi escolhido ou excluído por hipótese.

## Validação Local

TDD: testes de copy e imagens foram escritos antes da implementação. A primeira execução encontrou cinco falhas de imagem (domínio correto recusado e typo aceito), copy antiga no tutorial e helper ainda inexistente. O fixture de PlanBillboard precisou de IntersectionObserver local para jsdom; depois disso a promessa de simulado oficial também falhou antes da correção. Não foi alterado o setup global.

Comando focado (sem instalar dependências, sem carregar arquivo de ambiente):

```sh
node node_modules/vitest/vitest.mjs run src/components/settings/PlanBillboard.test.tsx src/components/simulados/ComoFuncionaTutorial.test.tsx src/services/simuladosApi.test.ts supabase/functions/_shared/appOrigins.test.ts supabase/functions/_shared/appIdentity.test.ts
```

Resultado: **5 arquivos, 106 testes passando, 0 falhando** (62 testes novos e 44 preexistentes do serviço). Cobertura inclui os três segmentos, abertura/navegação do tutorial real, data de liberação e treino; imagens HTTPS, domínio raiz/subdomínios, typo, lookalikes e credenciais apontando para host maligno; política SSO e CORS puros com HTTP, hosts não permitidos, credenciais e URLs com caminho/query/fragmento; identidade e hosts das ações de e-mail. Não é cobertura end-to-end dos handlers Deno.

Lint focado:

```sh
node node_modules/eslint/bin/eslint.js src/components/settings/PlanBillboard.tsx src/components/settings/PlanBillboard.test.tsx src/components/simulados/ComoFuncionaTutorial.tsx src/components/simulados/ComoFuncionaTutorial.test.tsx src/services/simuladosApi.ts src/services/simuladosApi.test.ts
node node_modules/eslint/bin/eslint.js --no-ignore supabase/functions/_shared/appIdentity.ts supabase/functions/_shared/appIdentity.test.ts supabase/functions/_shared/appOrigins.test.ts supabase/functions/novu-email/index.ts supabase/functions/auth-email-hook/index.ts supabase/functions/sso-magic-link/index.ts supabase/functions/request-password-reset/index.ts
```

Sem erros; 31 avisos preexistentes no serviço (any/unused eslint-disable) e 14 avisos preexistentes nos handlers (console). A configuração ignora Edge Functions; por isso a segunda passada usa `--no-ignore`, sem modificar configuração. Não foram corrigidos avisos fora das linhas autorizadas. `git diff --check` sem erros de whitespace.

## Pendências De Rollout

- Orquestrador: executar a suíte global e conferir o resultado integrado. A validação isolada após as remoções está registrada abaixo; nenhum teste tautológico de arquivo ausente substitui compilação e revisão de imports.
- QA autorizada: confirmar hosting ativo, disponibilidade HTTPS de `https://simulados.sanar.com.br/logo.svg`, renderização do logo nos clientes de e-mail e destinos de callbacks.
- QA autorizada: conferir Site URL, redirect allowlist e configuração Auth, origens reais dos consumidores SSO (incluindo callers que só mandem Referer com path) antes de publicar. A política intencionalmente exige Origin canônico em vez de refletir uma URL completa.
- Verificar os gates de release no ambiente autorizado e a UI desktop/mobile; a leitura das migrations não prova aplicação em produção.
- O job OpenCode não executou rede, envio de mensagens, alteração de DNS/secrets, dados históricos, SQL mutante ou git mutante. O commit e a integração são feitos pelo orquestrador após revisão. Este documento não afirma publicação realizada.

## Validação Independente Do Orquestrador

Os 106 testes focados passaram novamente. `tsc --noEmit -p tsconfig.app.json`, build Vite com `envFile:false` e saída isolada em `.superpowers/hygiene-codex/dist`, lint dos seis arquivos frontend tocados e lint explícito dos sete arquivos Edge (`--no-ignore`) terminaram com exit0. O build não executou geração de MCP nem leu arquivos `.env`; a suíte global é verificada na integração. Os avisos preexistentes de serviço/handlers foram preservados.

Um harness temporário importou PlanBillboard e o tutorial reais, com CSS do projeto e todo tráfego externo bloqueado. Foram 12 capturas em 375/768/1440 px, claro/escuro; não houve erro de página, overflow horizontal ou conteúdo cortado no diálogo. O plano e o tutorial móvel foram inspecionados visualmente. A correção das três classes de contraste recebeu nova captura claro/escuro, confirmação de `rgba(255,255,255,0.8)` nos três textos e repetição somente do teste do tutorial. Logs e capturas estão na pasta ignorada `.superpowers/hygiene-codex/`; isso não comprova integração com Auth, SSO, Novu ou hosting reais.
