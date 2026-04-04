# Brainstorm ? Teste completo do fluxo de prova (2026-04-04)

### Goal
- Validar ponta a ponta o fluxo de realizar uma prova (entrada, execu??o, progresso, finaliza??o e p?s-finaliza??o) com evid?ncias objetivas e checklist de aprova??o/reprova??o.

### Constraints
- Stack: React/Vite + Supabase; sem su?te E2E pronta espec?fica para prova.
- Deve evitar altera??es arriscadas no c?digo sem necessidade; foco em verifica??o.
- Fluxo depende de usu?rio autenticado e simulado eleg?vel (janela/segmento/onboarding).
- Precisamos de evid?ncias reproduz?veis (comandos + checks manuais).

### Known context
- Fluxo central est? em src/hooks/useExamFlow.ts e src/pages/SimuladoExamPage.tsx.
- Existem testes unit?rios de outras ?reas, mas n?o h? *.spec.ts E2E cobrindo prova.
- Playwright est? configurado (playwright.config.ts), por?m sem cen?rios de prova j? implementados.

### Risks
- Bloqueio por credenciais/estado de dados (sem conta apta a iniciar prova).
- Falso positivo se validar s? frontend sem confirmar persist?ncia/finaliza??o no back-end.
- Regress?es silenciosas em estados cr?ticos (offline, perda de foco, janela fechada).

### Options (2?4)
- Op??o A: S? lint/test/build (r?pida, baixa cobertura funcional)
  - Pros: execu??o r?pida e automatizada
  - Cons: n?o garante fluxo real do usu?rio
  - Complexity / risk: baixa / alto risco de lacunas
- Op??o B: S? teste manual navegado
  - Pros: cobre experi?ncia real
  - Cons: menor repetibilidade e menor confian?a t?cnica sem comandos
  - Complexity / risk: m?dia / m?dia
- Op??o C (recomendada): H?brido completo (automa??o + browser + checagem de dados)
  - Pros: maior confian?a, cobre UX e integridade t?cnica
  - Cons: mais tempo e depende de acesso funcional ao ambiente
  - Complexity / risk: m?dia-alta / baixa-m?dia

### Recommendation
- Seguir Op??o C: rodar verifica??es autom?ticas, executar jornada completa no browser (inclusive estados cr?ticos) e confirmar efeitos esperados de persist?ncia/finaliza??o.

### Acceptance criteria
- 
pm run lint, 
pm run test, 
pm run build executados com resultado documentado.
- Fluxo completo validado: iniciar prova, responder quest?es, navegar, marcar revis?o/confian?a, finalizar.
- P?s-finaliza??o validado: tela final, disponibilidade/bloqueio de resultado conforme estado.
- Cen?rios cr?ticos validados: offline/online, perda de fullscreen/aba, retomar tentativa.
- Evid?ncias consolidadas com lista de Pass/Fail e pr?ximos passos para qualquer falha.
