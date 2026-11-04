# Handoff: calendário e Reta Final

## Limite da entrega

Fase A pronta para revisão do protótipo, não para publicação. Nenhum arquivo React, rota, sidebar, hook, serviço ou schema foi alterado. A fase B só deve começar depois da revisão do Codex/orquestrador e de um novo escopo de integração.

Protótipo: `docs/design/calendar-study-prototype.html`. Abre como arquivo local, sem servidor ou rede. Controles de revisão estão ao final e podem ser recolhidos. As duas experiências estão na mesma página apenas para facilitar a revisão; a integração futura deve encaixá-las nos contextos atuais, sem novo dashboard global.

## Direção preservada

Contexto consultado: PRODUCT.md, DESIGN.md, tipos/contratos de edição, hooks existentes, helpers do plano e Calendar shadcn. A apresentação é uma lista cronológica por edição, não um grid mensal vazio. Consulta de edição e edição-alvo são controles independentes, com contexto textual explícito. Uma ação primária no calendário, **Exportar calendário**; **Revisar hoje** continua sendo a primária da Reta Final. Exportação individual ICS e Google são secundárias por evento.

Tokens locais de foreground/background/card/border/primary preservados, vinho, superfícies planas, responsividade sem novos componentes globais. O muted light do protótipo foi escurecido localmente de 46% para 40% para garantir contraste dos textos pequenos. Não mudar o token global na fase B; escolher um token local já acessível ou revisar a aplicação desse texto com Design.

Plus Jakarta Sans é a família solicitada e usa `local()` no HTML. Não há arquivo de fonte distribuído no repositório consultado e o protótipo não baixa fontes: máquinas sem a fonte instalada usam system-ui. A fidelidade tipográfica final exige comparar usando a fonte real já carregada pelo produto. Não instalar ou baixar fonte neste job.

Fases realizadas: contexto local, direção já aprovada em DESIGN.md, protótipo HTML, adaptação aos tokens existentes, revisão local de estados, responsividade, teclado, contraste e nomes longos, handoff. Motion novo foi omitido porque a direção só admite feedback/transições existentes; o HTML não tem movimento não essencial e declara reduced motion. Skills de direção adicional, Impeccable, serviços externos e MCP Dendê não foram acionados: direção existente preservada e rede expressamente proibida. Não se afirma conformidade com APIs Dendê sem consulta. React e revisão comparativa protótipo/produto ficam para depois da aprovação desta fase.

## Estados para revisar

URLs locais aceitam os parâmetros abaixo. Valores desconhecidos não substituem os defaults.

| Controle | Valores | Comportamento |
| --- | --- | --- |
| `?calendar=` | `loading`, `error`, `empty`, `pending`, `schedule` | Skeleton estável, retry preservando seleção, vazio, ausência de data oficial e calendário de exemplo conhecido |
| `&plan=` | `no-date`, `unknown`, `no-notebook`, `current`, `switching` | Alvo sem data, matriz/formato indisponíveis, sem erros no caderno, plano atual e invalidação temporária ao trocar alvo |
| `&theme=` | `light`, `dark` | Tema local sem persistência ou rede |
| Botão Testar nomes longos | ligado/desligado | Estressa contexto e títulos de eventos sem truncar a informação |

Exemplo: `calendar-study-prototype.html?calendar=pending&plan=unknown&theme=dark`.

Todas as datas são DEMO. O estado `schedule` contém uma data oficial **fictícia**, explicitamente identificada, apenas para testar o layout de uma data confirmada futura. Não cadastrar esses dados no banco ou mostrá-los como divulgação do Inep. O protótipo de plano atual também é DEMO, e não uma promessa de formato/matriz para 2027.

Trocar o alvo suspende o plano anterior e exibe a edição nova. “Concluir troca de alvo · DEMO” representa a futura resolução autorizada e leva a alvo sem data, sem reutilizar datas/pesos antigos. O HTML não salva preferências reais. “Revisar hoje” apenas informa onde ocorrerá a integração; não altera respostas ou caderno.

O exportador inline serve só para experimentar downloads offline com os dados sintéticos visíveis. Na fase B importar os helpers TS testados, **não copiar o script DEMO**. Não incluir os controles de revisão no produto.

## Contratos para a fase B

- Compor a futura `EditionCalendarPage.tsx` com os metadados já autorizados de `useSimulados`. Filtrar pelo ID exato; nunca usar alvo do usuário para reatribuir um simulado.
- Usar `buildEditionCalendar`, `exportCalendarIcs`, `calendarFilename` e `googleCalendarUrl`. Não passar o objeto de usuário/attempt/caderno ao exportador. Mostrar erros de configuração de datas e não inferir liberação de resultados.
- Formatar instantes com `America/Sao_Paulo` e rótulo Brasília. Para eventos DATE, formatar os componentes do dia, sem `new Date(date).toLocaleDateString()` no fuso do navegador.
- Preservar arquivo histórico autorizado. Rascunhos, testes e status desconhecido ficam fora. Revisar política de testes com Produto antes de ampliar.
- Na Reta Final, resolver o alvo explicitamente, validar formato e obter o blueprint da edição-alvo certa. O hook atual `useEditionBlueprint(simuladoId)` não resolve uma edição-alvo por conta própria.
- Flag desligada deve omitir `areaWeights`. Flag ligada deve passar `context.areaWeights`, incluindo `[]` no desconhecido; mostrar “Há matriz indisponível” e “pesos provisórios” quando cabível. Pesos não calculam proficiência.
- Sem data, manter revisão existente disponível quando houver dados autorizados, sem inventar contagem/dias. Não fazer query de total do caderno nem alterar API/paginação do job concorrente.
- Mudança de alvo precisa invalidar qualquer visualização do plano anterior durante o carregamento e isolar dados por conta/edição, sem fallback oculto para 2026. Carregamento não deve ser tratado como escolha nula concluída.
- App/sidebar/rotas dependem de coordenação com o parent. Não antecipar integração global ou mexer nos arquivos de Caderno/Insights/API/paginação.

## Evidência e comandos

```powershell
node --test docs/design/calendar-study-prototype.test.mjs
node node_modules/vitest/vitest.mjs run src/lib/edition-calendar.test.ts src/lib/retaFinalPlan.test.ts
node .superpowers/calendarStudyQA/browser.mjs
node .superpowers/calendarStudyQA/typecheck.mjs
```

19 testes de HTML e 29 de lógica passando. Edge instalado em `C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe`, usado via canal `msedge` do Playwright instalado, sem download. `.superpowers/browsers` não estava disponível neste worktree. Capturas e helpers locais ficam ignorados em `.superpowers/calendarStudyQA/`, não são dependências versionadas.

Capturas principais: `375-light.png`, `375-dark.png`, `768-light.png`, `768-dark.png`, `1440-light.png`, `1440-dark.png`; variações `*-long.png`, `calendar-*.png`, `plan-*.png`. Foram inspecionadas capturas longas mobile/claro e desktop/escuro; revisão final humana deve comparar as principais e os estados. Testes de browser validaram 60 combinações de estado/viewport/tema, downloads reais ICS, teclado, foco, ausência de overflow e erros de página, além de contraste mínimo de 5,06:1 em texto e controles habilitados.

Pendências de revisão humana: direção/protótipo pelo Codex antes de React, tipografia com Plus Jakarta instalada, leitor de tela/zoom e contraste dos componentes reais após integração. Importação ICS/Google por clientes externos não foi testada, pois exige rede; não há sincronização de agenda, OAuth ou promessa de deduplicação em reimportação. Build/suíte/typecheck globais pertencem ao orquestrador.
