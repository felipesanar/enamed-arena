# Finish: comunicação “fora da janela” sem narrativa de treino

## Feito

- **Helpers:** `STATUS_CONFIG.available_late` → label “Disponível”, tom info; `getSimuladoCTA` → “Iniciar Simulado”; testes em `simulado-helpers.test.ts` atualizados.
- **StatusBadge:** ponto pulsante `available_late` → `bg-info`.
- **SimuladoCard:** copy de valor + tag “Não conta no ranking nacional”; testes do card alinhados ao componente atual.
- **SimuladosPage:** bloco “Como funciona” sem “treino”; explica janela oficial vs continuidade com mesma experiência.
- **SimuladoDetailPage:** hero “Pronto para começar?”; faixa primary/Sparkles com valor + regra de ranking; CTA “Iniciar Simulado”; checklist extra obrigatório para `available_late` (confirmação ranking); data de resultado sempre exibida.
- **Pós-prova:** `AttemptRow.is_within_window`; após `finalize`, `getAttempt` → `isWithinWindow` em `useExamFlow`; `ExamCompletedScreen` sempre “Simulado concluído!” + faixa informativa se `!isWithinWindow`.

## Verificação

- `npm run test` — 31 testes passando.
- `npm run lint` — falhas pré-existentes no repositório; arquivos alterados nesta tarefa sem novos avisos no IDE.

## Follow-up opcional

- Cenário `NextSimuladoBanner` / `deriveScenario` para simulados só `available_late` (home).
