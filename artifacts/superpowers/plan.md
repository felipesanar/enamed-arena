### Goal
Validar ponta a ponta o fluxo completo de realizacao de prova em producao (inicio, progresso, finalizacao e pos-finalizacao), incluindo cenarios criticos, com evidencias objetivas de funcionamento.

### Assumptions
- A sessao ja autenticada no browser pode ser usada para os testes.
- O alvo e ambiente de producao.
- Existe pelo menos um simulado elegivel para realizar prova.

### Plan
1. Preparacao de ambiente e pre-check
   - Files: sem edicao de codigo
   - Change: confirmar scripts/ferramentas para executar a bateria de validacao.
   - Verify: node -v, npm -v, npm install (se necessario).

2. Validacao tecnica automatica base
   - Files: sem edicao de codigo
   - Change: rodar validacoes automatizadas para detectar quebras gerais antes do E2E.
   - Verify: npm run lint, npm run test, npm run build.

2.1. Correcao do baseline de lint (aprovado pelo usuario)
   - Files: eslint.config.js (e outros somente se necessario)
   - Change: ajustar configuracao e/ou pontos de codigo para remover bloqueios globais do lint sem alterar comportamento de produto.
   - Verify: npm run lint.

3. Subir app local e confirmar acesso ao fluxo
   - Files: sem edicao de codigo
   - Change: iniciar app e confirmar carregamento das rotas necessarias para a jornada de prova.
   - Verify: npm run dev -- --host 0.0.0.0 --port 8080; abrir app e validar carregamento.

4. Testar fluxo principal completo da prova (E2E manual guiado no browser)
   - Files: sem edicao de codigo
   - Change: executar jornada completa: abrir simulado -> iniciar prova -> responder questoes -> navegar/flags -> finalizar.
   - Verify: confirmar UI e transicoes esperadas em cada marco, sem erros bloqueantes.

5. Testar cenarios criticos
   - Files: sem edicao de codigo
   - Change: validar offline/online, saida de fullscreen, troca de aba e retomada de tentativa.
   - Verify: validar banners, penalidades, retomada e continuidade do cronometro/conteudo.

6. Validar consistencia de finalizacao e pos-finalizacao
   - Files: leitura de src/hooks/useExamFlow.ts e src/services/simuladosApi.ts (sem edicao)
   - Change: confirmar aderencia entre comportamento observado e regras de finalizacao/resultado.
   - Verify: tela final e acesso a resultado coerentes com status e janela de execucao.

7. Consolidar relatorio final com matriz Pass/Fail
   - Files: artifacts/superpowers/execution.md, artifacts/superpowers/finish.md
   - Change: registrar execucao passo a passo e resumo final com evidencias e riscos remanescentes.
   - Verify: listar artifacts/superpowers/ e confirmar arquivos atualizados.

### Risks & mitigations
- Risco: dados/conta sem elegibilidade de prova.
  - Mitigacao: registrar bloqueio com evidencia e indicar pre-condicao minima para reteste.
- Risco: comportamento intermitente por rede/latencia.
  - Mitigacao: repetir cenarios criticos e registrar resultado da repeticao.
- Risco: falso positivo por validacao parcial.
  - Mitigacao: exigir evidencias dos marcos obrigatorios em cada etapa.

### Rollback plan
- Como este plano e de validacao (sem mudancas estruturais previstas), rollback de codigo e N/A.
- Se surgir necessidade de correcao, abrir novo ciclo com plano de implementacao e validacao dedicada.
