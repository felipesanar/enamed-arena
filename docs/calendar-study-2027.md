# Calendário e plano por edição: fases A e B

Fase A: implementação pura e protótipo offline. Fase B: integração React do calendário e da Reta Final por edição, após aprovação da direção visual. Não houve alteração de schema, RLS ou produção. Não há data oficial confirmada para 2027 neste trabalho; datas nas fixtures de QA são sintéticas.

## Calendário

`buildEditionCalendar(edition, authorizedSimulados)` recebe apenas metadados públicos já autorizados. Não faz fetch e não substitui RLS. O chamador deve projetar os campos de `CalendarSimulado`, sem juntar dados de usuário, notas internas, respostas ou caderno. Títulos também devem ser títulos editoriais públicos, nunca texto privado. Não existe detecção heurística de PII em texto livre.

- A associação exige `sim.editionId === edition.id`, além de ID do simulado não vazio. Código, ano, alvo do aluno e posição da lista não são fallback para essa associação.
- Apenas `published` e `archived` entram. `draft`, `test` e status ausente ficam fora por segurança. Arquivados autorizados permanecem, sem exigir uma tentativa do usuário ou expor seus dados. Confirmar essa política com Produto se futuramente alunos precisarem de eventos de simulados de teste.
- Cada janela válida vira um intervalo; resultados viram um marco, sem duração fabricada. Datas sem offset/fuso ou apenas dia não viram janelas. Fim deve ser posterior ao início.
- Resultados antes do fim geram `results-before-window-end`. Liberação ausente/inválida gera `invalid-results`. A janela válida permanece exportável; não se inventa liberação no fim da janela. Janela inválida gera `invalid-window` e impede os eventos desse simulado.
- A UI da fase B precisa mostrar esses erros como erro de configuração, não omiti-los silenciosamente ou apresentar como data pendente oficial.
- A prova oficial só entra com `exam_date_confirmed` e data `YYYY-MM-DD` realmente válida. É evento de dia inteiro, sem horário. `official_results_at` não é inferido a partir dos simulados nem exportado como resultado de simulado.
- Ordenação usa o instante real (incluindo offsets), com desempates determinísticos. A UI deve formatar instantes em `America/Sao_Paulo`; datas de dia inteiro não devem passar por conversão para o fuso do navegador.

## Exportação

`exportCalendarIcs(events, dtstamp)` gera VCALENDAR/VEVENT com CRLF, UID estável a partir de edição/simulado/tipo, DTSTAMP injetado pelo chamador e horários UTC. O marco de resultados tem apenas DTSTART. A prova oficial usa `VALUE=DATE` e DTEND exclusivo no dia seguinte, calculado em UTC como operação de calendário, sem depender do fuso local.

Texto de SUMMARY escapa barra invertida, vírgula, ponto e vírgula e CR/LF. Controles não imprimíveis são removidos. Identificadores são codificados para não injetar linhas. Folding limita cada linha física a 75 octetos UTF-8, incluindo o espaço de continuação, sem quebrar codepoints. Apenas título público, identificadores editoriais e texto fixo de contexto são serializados; propriedades extras não são percorridas. Chamadas diretas ao serializador também validam datas.

`calendarFilename(code)` restringe o nome a ASCII seguro e 80 caracteres no código. `googleCalendarUrl(event)` retorna somente uma URL `https://calendar.google.com/calendar/render?action=TEMPLATE`, com URLSearchParams. Cada evento tem sua própria URL: instantes em UTC, datas sem hora como DATE. Resultados usam início/fim iguais no Google para não fabricar duração. Não há OAuth, chamada de rede ou abertura automática. A fase B deve usar clique explícito e `rel="noopener noreferrer"` ao abrir nova aba.

UID estável não garante que todos os clientes de agenda dedupliquem importações manuais; isso depende do cliente. Reimportar um arquivo pode duplicar eventos em alguns calendários. Não existe sincronização ou atualização remota nesta fase.

## Plano Reta Final

`BuildRetaFinalPlanInput.areaWeights` é um parâmetro opcional serializável com `code`, `label`, `aliases` e `weight`. Omitir o parâmetro (inclusive `undefined`) mantém exatamente o caminho legado. Passar `[]` ou uma matriz inválida produz contribuição de peso igual a zero para todas as áreas, preservando vencimentos, lapsos e demais componentes existentes. Pesos precisam ser finitos, positivos, até 1 e somar 1; correspondência é exata com normalização de acentos, espaços e caixa, nunca substring. Alias ambíguo não corresponde a uma área.

`resolveEditionStudyContext(editions, selectedId, now, matrix?)` resolve os dados para o novo fluxo:

- Um ID explicitamente selecionado ganha mesmo se não tiver data ou já tiver passado. Se o ID não existe no catálogo autorizado, retorna `edition: null`, sem escolher outro ano.
- Somente `selectedId: null` permite usar `getNextEdition`. O chamador pode passar a edição já resolvida por `useUserEdition`, mas não deve confundir ausência de ID no carregamento com seleção nula concluída.
- Data só é resolvida se confirmada e válida. `daysUntil` usa dias de calendário de São Paulo: null sem data, zero hoje, negativo no passado. Não há fallback de data para 2026.
- Formato passa por `validateExamFormat`; inválido retorna null, sem valores fixos de 100 questões/300 minutos.
- A matriz precisa ter o ID de blueprint da edição, todas as áreas precisam pertencer àquele ID e os pesos precisam ser válidos. O status é `available`, `provisional` ou `unavailable`. Estado indisponível retorna `areaWeights: []`; a UI precisa dizer **Há matriz indisponível** e explicar a priorização neutra.
- `weights_provisional` nunca vira uma afirmação de matriz oficial. São pesos de priorização pedagógica, não parâmetros para calcular score ou proficiência.

Com flag desligada, a integração futura deve continuar chamando o construtor sem `areaWeights`, mantendo o comportamento legado. Com flag ligada, deve passar sempre `context.areaWeights`, mesmo quando vazio, e `context.date`. Sem data/hoje/passado, o construtor mantém sua regra atual de plano vazio. Uma ação de revisão sem data deve apontar ao fluxo existente de revisão disponível, não inventar dias ou preencher `todayEntries` artificialmente.

Não foi criada consulta de total do caderno nem alterada sua paginação. Caderno, Insights, Home, AI e Admin permanecem fora do escopo. `useEditionBlueprint` atual é por **simulado**, não por alvo: a fase B usa o contrato autorizado `blueprintsApi.getForEdition`, sem escolher um simulado arbitrário.

## Integração React (fase B)

- `/calendario` usa os wrappers existentes `ProtectedRoute` e `DashboardLayout`. A página verifica `useAppConfig('editions_ui')` antes de montar os hooks de conteúdo; flag desligada redireciona para `/simulados`. O link da sidebar usa a mesma flag. Não existe dependência de gate administrativo ou requisito PRO para o calendário.
- A edição consultada é independente do alvo. `useSimulados` fornece metadados autorizados; helpers existentes filtram e exportam somente eventos públicos. Estados reais de carregamento, erro/retry, vazio, data pendente e configuração inválida estão presentes. Datas confirmadas inválidas geram aviso, sem evento oficial fabricado.
- Exportações ICS usam Blob e revogação da URL temporária; Google exige clique explícito. Horários são apresentados em Brasília e eventos DATE preservam o dia, independentemente do fuso do navegador.
- `useEditionStudyContext` resolve o alvo da conta atual por `useUserEdition`, valida data/formato/matriz e isola a consulta de blueprint por conta, alvo e blueprint. Alvo ausente não vira próxima edição global. Trocas de conta/alvo suspendem o contexto anterior.
- A Reta Final mantém `ProGate` e o ramo legado quando a flag está desligada. Com a flag ligada, usa pesos da edição-alvo; matriz desconhecida passa `[]`, sem pesos legados. Pesos provisórios e formato validado são explícitos.
- O caderno é acumulado intencionalmente com `getAllRows({ editionId: null }, { editionsEnabled: true })`, somente após resolver alvo com data confirmada futura. Não há consulta do caderno quando alvo/data estão ausentes. A UI informa “Revisões acumuladas do caderno · prioridades de {alvo}”.
- A revisão existente aceita `?entry=<id>`, não uma fila de IDs. “Revisar hoje” abre a primeira entrada priorizada e cada questão tem seu link; não foi inventado contrato de fila. Resolved, deleted, mastered e itens bloqueados seguem as exclusões existentes. Todas dominadas produz estado em dia, não caderno vazio.

## Evidências da fase B

Suíte explícita com os testes de calendário/plano, API de blueprint, hook de contexto, páginas, hero e sidebar: **8 arquivos, 59 testes passando**. Inclui 1500 linhas de caderno, troca de conta/alvo em voo, flag desligada, erros/retry, exportação e filtros de elegibilidade. Testes novos falharam antes da implementação; regressões de data oficial inválida e estado de todas dominadas também foram reproduzidas antes da correção.

`node .superpowers/calendarStudyQA/typecheck.mjs`: zero diagnósticos nos 18 arquivos próprios. Não é typecheck global. QA React privada com componentes reais e APIs sintéticas: `node .superpowers/calendarStudyQA/react-browser.mjs`, 18 combinações em 375/768/1440 e claro/escuro, 22 capturas, um download ICS, seleção por teclado, zero overflow e zero erros de página. Usa fuso America/Los_Angeles para exercitar datas e bloqueia rede fora do servidor local. Capturas mobile/claro e hero desktop/escuro foram inspecionadas; isso não constitui auditoria integral de acessibilidade.

As fixtures não validam backend/RLS em ambiente integrado. Build, suíte e typecheck globais ficam com o orquestrador. Leitor de tela/zoom, tipografia com a fonte efetivamente carregada e importação em clientes externos ICS/Google permanecem para revisão; não há OAuth, sincronização ou garantia de deduplicação.

Revisão visual final do Codex aprovou a direção restante e apontou quebra de palavra nos KPIs do hero. Corrigido somente em `RetaFinalHero`: padding/tipografia/tracking compactos no mobile e labels sem quebra, mantendo os três KPIs e as medidas desktop. Regressão reproduzida antes da correção em teste e navegador. `hero-browser.mjs` validou 320/375, claro/escuro: Vencidas, No plano e Dominadas em uma linha, dentro dos tiles, sem overflow. Quatro capturas `hero-final-*.png`, incluindo 375 claro/escuro inspecionadas. Não foram repetidos os 18 cenários completos após esse ajuste.

Verificação final pontual: `RetaFinalHero.test.tsx` com 3 testes passando (um novo); a execução anterior dos oito arquivos tinha 59 testes. ESLint de todos os fontes/testes da fase B, incluindo App, sidebar, wrappers de teste e serviço de blueprint: zero erros, um aviso `no-explicit-any` preexistente em `CadernoRetaFinalPage.tsx:235`.

## Verificação local

```powershell
node node_modules/vitest/vitest.mjs run src/lib/edition-calendar.test.ts src/lib/retaFinalPlan.test.ts
node --test docs/design/calendar-study-prototype.test.mjs
node node_modules/eslint/bin/eslint.js src/lib/edition-calendar.ts src/lib/edition-calendar.test.ts src/types/edition-calendar.ts src/lib/retaFinalPlan.ts src/lib/retaFinalPlan.test.ts
```

Resultado: 29 testes de lógica e 19 testes Node do HTML passando. TDD observado: antes da implementação, calendário falhou por módulo ausente e os três testes novos do plano falharam; os 19 testes do protótipo falharam por HTML ausente. Depois, as respectivas suítes passaram. Uma asserção do teste de injeção foi corrigida para verificar o início da linha da propriedade, não o fim de um SUMMARY seguro.

QA privado e ignorado em `.superpowers/calendarStudyQA/`: `browser.mjs` usa Playwright instalado com Edge headless, bloqueia requisições que não sejam `file:` e não abre os links Google. Executado com 375/768/1440, claro/escuro e reduced motion: 60 verificações de estados, 22 capturas, seis downloads ICS e zero erros de página. Teclado validado com Tab, skip link, Enter, retry e retorno de foco na troca de alvo. Nenhum overflow nos casos exercitados, incluindo nomes longos. Contraste mínimo medido entre textos/controles habilitados e seus fundos: 5,06:1; não é certificação WCAG integral nem teste com leitor de tela.

`typecheck.mjs` privado cria um programa TypeScript com os cinco arquivos TS do escopo e filtra diagnósticos para esses arquivos: zero diagnósticos. Isso não substitui typecheck/build globais do orquestrador. ESLint sem erros, com 12 avisos `no-explicit-any` preexistentes na lógica legada do plano.
