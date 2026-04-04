# Plano - Teste completo do fluxo de prova (2026-04-04)

### Goal
- Executar uma bateria completa para garantir que o fluxo de prova funciona ponta a ponta em condicoes normais e criticas, com evidencia tecnica reproduzivel.

### Assumptions
- Ha um usuario de teste com acesso e onboarding completo (ou voce fornecera credenciais).
- Existe ao menos um simulado acessivel para inicio imediato.
- O ambiente local consegue consumir o backend Supabase configurado no projeto.

### Plan
1. Preparacao de ambiente e pre-check
   - Files: package.json, playwright.config.ts
   - Change: sem alteracao de codigo; validar dependencias e scripts disponiveis.
   - Verify: npm -v, node -v, npm install (se necessario).
2. Validacao tecnica automatica base
   - Files: sem edicao
   - Change: executar checks automaticos para identificar quebras gerais.
   - Verify: npm run lint, npm run test, npm run build.
3. Subir aplicacao e validar rota de prova
   - Files: sem edicao
   - Change: iniciar app local e confirmar carregamento de paginas principais.
   - Verify: npm run dev -- --host 0.0.0.0 --port 8080; abrir app e checar carregamento.
4. Teste E2E guiado do fluxo principal (browser)
   - Files: sem edicao
   - Change: executar jornada real de usuario: login -> abrir simulado -> iniciar prova -> responder/navegar -> finalizar.
   - Verify: evidencias de UI em cada marco (estado, botoes, progresso, tela final).
5. Teste de estados criticos
   - Files: sem edicao
   - Change: validar offline/online, perda de fullscreen, troca de aba e retomada de tentativa.
   - Verify: banners/penalidades/retomada exibidos conforme esperado, sem travar fluxo.
6. Checagem de consistencia de finalizacao
   - Files: src/hooks/useExamFlow.ts, src/services/simuladosApi.ts (somente leitura)
   - Change: sem edicao; confirmar se tentativa finalizada reflete comportamento esperado em tela e acesso a resultados.
   - Verify: comportamento pos-finalizacao consistente com status e regras de janela.
7. Consolidar relatorio final com matriz Pass/Fail
   - Files: artifacts/superpowers/2026-04-04-finish-teste-fluxo-prova.md
   - Change: documentar tudo que passou/falhou, riscos remanescentes e proximos passos.
   - Verify: checklist completo + comandos executados + evidencias.

### Risks & mitigations
- Sem credenciais validas: mitigacao -> solicitar conta de teste e repetir etapa E2E imediatamente.
- Dados inconsistentes no ambiente: mitigacao -> registrar bloqueio com evidencia e recomendar seed minimo.
- Flakiness de UI/tempo de rede: mitigacao -> repetir passos criticos com registro de tentativa.

### Rollback plan
- Como nao havera alteracao estrutural nesta execucao inicial de testes, rollback e N/A.
- Se surgir necessidade de correcao de codigo depois da bateria, abriremos novo ciclo com plano de mudanca e validacao dedicada.
