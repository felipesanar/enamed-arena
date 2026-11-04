# Janela e Sessão: Fase A

## Entrega

Protótipo offline em `admin-session-window.html`. Apenas dois trechos dos formulários existentes, sem nova página de produto, React, backend ou produção. Tudo é fictício e vive em memória. Recarregar descarta a DEMO. O orquestrador revisa esta fase antes de autorizar React.

Referências lidas: `DESIGN.md`, `PRODUCT.md`, `src/index.css`, `AdminSimuladoForm.tsx`, `AdminPresencial.tsx`, `ReprocessSimuladoDialog.tsx`, `docs/design/admin-operations-prototype.html` e seu handoff. Contrato somente leitura: `../fase1-edicoes-f2-admin-session-rules/docs/contracts/admin-session-rules-2027.md`. Nenhuma migration foi alterada.

Fases do design-combo: contexto existente, materialização HTML, adaptação aos tokens locais e revisão funcional/acessível. Direção visual nova, motion, gráficos e implementação React não se aplicam. `interfaces-com-dende` foi carregada, mas o MCP não foi consultado: a execução proíbe rede e exige reutilizar a identidade aprovada. Não se declara conformidade remota com Dendê. `admin-panel` é um alias local do protótipo para o `admin-surface` existente. Bordas de controle de maior contraste seguem o protótipo de operações; bordas de superfícies usam `admin-line`. `admin-faint` fica reservado, não usado para instruções essenciais.

Plus Jakarta Sans é solicitada via `local()`, sem fonte remota. Se ausente no computador, usa Arial/sans-serif, como o protótipo administrativo anterior. Instalar/embutir fontes ou buscar CDN ficou fora do escopo. Sem animação nova; reduced-motion é respeitado. Na fase React, reutilizar o Dialog Radix já existente, não portar o `<dialog>` nativo do HTML como uma biblioteca nova.

## Alteração de Janela

1. Contexto com 12 participações fictícias. `Conferir alteração de janela` abre o diálogo. As datas do formulário genérico ficam bloqueadas: a operação específica não pode virar um bypass.
2. Abertura, Encerramento e Resultado sempre em Brasília. A fixture usa valores civis explícitos, sem UTC visual, conversão pelo fuso do navegador ou consulta externa. Validação: abertura < encerramento <= resultado.
3. `Conferir alteração` simula leitura por 60 ms. Durante a leitura/envio, não há duplicação nem fechamento. Depois, o resumo recebe foco e apresenta as três datas Antes / Depois, 12 participações examinadas e 3 com elegibilidade alterada no cenário de mudança (0 se as três datas não mudaram). São respostas sintéticas, não cálculo real de elegibilidade no cliente.
4. O motivo é obrigatório, até 2000 caracteres, sem dados pessoais. Apenas o resumo pronto e motivo não vazio habilitam `Confirmar alteração`. Há uma única ação primary por etapa. Qualquer edição de data invalida a conferência, esconde o resumo e exige conferir novamente; motivo não altera as datas conferidas.
5. Sucesso só aparece após resposta simulada confirmada. O relatório agregado recebe foco. Atualizam-se apenas a janela salva e sua representação, nunca título/descrição editados do formulário. Os metadados não foram salvos pelo HTML.

| Estado observável | Comportamento |
| --- | --- |
| Conferindo / confirmando | Controles bloqueados; `aria-busy`; fechamento e envio repetido impedidos. |
| Resumo pronto | Antes/Depois com datas e contagens; foco no resumo; motivo obrigatório. |
| Conferência desatualizada | Mensagem humana de alteração concorrente, sem hash/UUID/RPC. Confirmação bloqueada e nova conferência obrigatória. A fixture muda a janela salva para ilustrar o novo Antes. |
| Outra gravação | Não presume gravação. `Repetir conferência` é uma ação explícita; não há retry automático. |
| Resultado incerto | Não presume sucesso nem falha. Mantém bloqueio inclusive após fechar/reabrir. `Atualizar situação` simula leitura, nunca reenvia; depois exige conferência nova. |
| Contagens da prévia indisponíveis | Não mostra zero; nenhuma confirmação possível; pode conferir novamente. |
| Contagem de participações indisponível | Disparador e alteração genérica bloqueados. Instrução para atualizar a leitura, sem inventar ausência de tentativas. |
| Sem permissão | Disparador bloqueado com orientação para procurar administrador autorizado. Metadados continuam editáveis. |

O aviso preserva prazos pessoais e notas. Não há finalização/reabertura de tentativas, alteração de respostas, modalidade ou snapshots acadêmicos. Na integração, o preview/commit devem ser exclusivamente do servidor e conferir conjuntamente `content.manage` + `attempts.manage`. O controle DEMO de permissão representa a segunda capability sobre um editor de conteúdo já autorizado; não é autorização real.

## Regra da Sessão

O seletor `Regra para o ranking` pertence ao formulário existente, não a um novo painel. Preserva simulado, caderno, código, nome, início/fim em Brasília e sessão ativa.

| Leitura | Regra no controle / envio |
| --- | --- |
| Nova sessão com recurso ligado | Escolhe explicitamente Janela da sessão (`session_window_v1`). |
| Existente reconhecida | Mantém o valor real: Janela da sessão ou Janela online (`legacy_online_window`). |
| Backend sem campo, null ou valor desconhecido | Indisponível / mantida pelo servidor. Não inferir legado. Permite salvar campos legados, omitindo `ranking_rule`. |
| `editions_ui` desligada | Seletor oculto e regra omitida do envio, inclusive para sessão nova. Sem mudança do contrato legado. |

Texto: “A regra vale para novas participações. As anteriores mantêm a regra registrada.” Versões técnicas aparecem somente no código/documentação, nunca nos rótulos visíveis. O submit expõe `window.sessionPayload` apenas como evidência interna da fixture: não é um cliente RPC nem payload pronto de produção. Na fase React, converter datas com os helpers Brasília existentes e mapear o campo para o contrato final do upsert.

## Contrato de Integração

`admin_preview_simulado_window` recebe simulado e as três datas, retorna referência da janela atual e contagens agregadas. `admin_update_simulado_window` recebe também referência esperada e motivo, valida capabilities, concorrência e atomicidade. Não assumir que o protótipo implemente hash, locks ou idempotência real. Após resultado incerto, a integração deve reconciliar leitura/relatório/auditoria antes de liberar outra gravação; simplesmente limpar a mensagem ou fechar o diálogo não resolve a incerteza.

`admin_presencial_sessions_list` deve devolver `ranking_rule` real; upsert acrescenta a regra ao final do contrato, e omissão/null mantém semântica antiga do servidor. Em versão desconhecida, omitir a regra é obrigatório. Não usar `valor ?? legacy` ao hidratar a edição. A conferência de janela deve tratar contagens inválidas/ausentes como indisponibilidade, não coagir null a 0. Atualizar apenas os campos de janela no cache e no formulário após sucesso, sem recarregar indiscriminadamente metadados sujos.

## Verificação

Teste funcional: `node --test docs/design/admin-session-window.test.mjs`. Usa `node:test`, `assert` e jsdom já presente, sem dependência nova. Cobertura: labels/IDs, etapas/estados, validação das datas, motivo, invalidação, contagens desconhecidas, permissões, concorrência, incerteza persistente, preservação de metadados, flag, regra real/ausente/desconhecida, omissão do campo e texto variável sem injeção. Nenhum teste global, build ou tsc foi executado.

Browser QA: `node --test .superpowers/admin-windowQA/browser.test.mjs`. Runner local ignorado, servidor efêmero em `127.0.0.1`, somente o HTML é servido, qualquer outra requisição é abortada. Usa Edge instalado via Playwright existente, sem downloads. O Chromium padrão não estava instalado. Contexto pt-BR, fuso Asia/Tokyo para provar a independência do fuso visual e reduced-motion ligado.

Artefatos ignorados em `.superpowers/admin-windowQA/`: `summary.json` e somente três capturas: `window-375-dark.png`, `window-768-dark.png`, `session-1440-light.png`. O resumo registra foco inicial/no resumo/no retorno/no relatório, contenção Tab/Shift+Tab, Escape, overflow de página/diálogo, erros JS e tentativas de rede. Há também medição a 375 do formulário de sessão sem captura extra.

Resultado observado: 12/12 testes funcionais e 1/1 teste de navegador passaram. O primeiro QA identificou fuga de Tab do diálogo nativo para o navegador; corrigida com loop explícito para reproduzir o Radix, com Tab/Shift+Tab revalidados. As capturas foram abertas para inspeção: superfícies e hierarquia preservadas; o rótulo Encerramento recebeu mais espaço na tabela mobile. Nenhum overflow horizontal em 375/768/1440, nenhuma requisição externa e nenhum pageerror. A fonte Plus Jakarta Sans não está instalada no ambiente de captura, portanto as imagens usam o fallback documentado; a fidelidade tipográfica final permanece pendente.

Limites: testes de protótipo não validam SQL, política real de elegibilidade, auditabilidade, leitores de tela ou integração Radix. Fonte local, contraste final e reprodução visual em React precisam de revisão do orquestrador. Nenhuma autorização de produção ou fase B é presumida.

## Aprovação do orquestrador para a fase B

O Codex revisou as capturas finais de 375 escuro e 1440 claro, o resumo do
navegador sem overflow/requisições externas/pageerrors e executou os 12 testes
funcionais, todos aprovados. A direção está aprovada para React, reutilizando
os componentes e a fonte reais do aplicativo. A fase B está autorizada no
prompt `.superpowers/admin-windowQA/phase-b.md`, com escopo explícito e sem
nova matriz de protótipo. Isso não autoriza produção ou alterações de SQL.
