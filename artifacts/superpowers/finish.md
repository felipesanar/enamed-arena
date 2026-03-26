### Verification
- Commands run:
  - `npm run build`
  - `npm run test -- --run`
  - `ReadLints` scoped to `src`
- Results:
  - Build: **pass**
  - Tests: **17/17 pass**
  - Lints: **sem erros novos**

### Summary of changes
- Regras criticas de janela e onboarding foram levadas para o backend (RPCs guardadas + validacoes semanticas).
- Fluxo de prova passou a usar enforcement server-side para criar/progredir/finalizar tentativa.
- Onboarding agora respeita bloqueio de edicao em janela ativa com feedback claro no frontend.
- Regra minima de instituicoes para guest foi reforcada no backend.
- Opt-in de notificacao por email no fim da prova foi implementado e persistido por tentativa.
- Ranking foi ampliado para simulados com resultado liberado (nao depende mais de tentativa local do usuario).
- Filtro same_institution passou a considerar lista completa de instituicoes do onboarding.
- Drill-down de desempenho ate questao foi implementado (area > tema > questao, com link para correcao).
- CTAs de upsell atualizados para a LP oficial [SanarFlix PRO ENAMED](https://sanarflix.com.br/sanarflix-pro-enamed).
- Camada de analytics base criada e eventos principais instrumentados (lead, onboarding, prova, correcao, ranking, upsell).

### Review Pass (Blocker/Major/Minor/Nit)
- Blockers:
  - Nenhum blocker novo identificado apos implementacao e verificacoes.
- Majors:
  - O envio efetivo do email de resultado (job/cron consumindo `get_pending_result_notifications`) depende de orquestracao operacional da edge function/agendador.
- Minors:
  - Parte dos eventos KPI pode exigir ajuste fino de taxonomia conforme ferramenta analitica final (ex.: naming conventions de produto).
- Nits:
  - Build ainda emite warnings de classes Tailwind ambiguas pre-existentes e bundle grande (nao bloqueante para entrega).

### Follow-ups
- Conectar um job agendado para processar notificacoes pendentes de resultado e marcar envio via `mark_result_notification_sent`.
- Definir destino final de analytics (provider) e plugar handler em `registerAnalyticsHandler`.
- Opcional: reduzir warning de bundle/chunks para performance futura.

### How to validate manually (if applicable)
1. Fluxo guest: login -> onboarding (<3 instituicoes deve falhar no backend) -> prova -> finalizacao.
2. Durante janela ativa, tentar editar onboarding e confirmar bloqueio com mensagem.
3. Finalizar prova e alternar opt-in de email na tela concluida (persistencia deve refletir).
4. Abrir ranking com usuario sem tentativa no simulado selecionado e confirmar exibicao de ranking global.
5. Em ranking, aplicar filtro mesma instituicao e validar que usa todas instituicoes do onboarding.
6. Em desempenho, navegar area > tema > questao e abrir correcao da questao via link.
7. Clicar em upsell gates/banners e confirmar redirecionamento para [SanarFlix PRO ENAMED](https://sanarflix.com.br/sanarflix-pro-enamed).
