## Problema

Hoje o modal `OfflineModeSimpleDialog` (escolha entre fazer online ou baixar PDF) só aparece no `HeroCard` da página `/simulados`. Em todos os outros pontos de entrada o usuário vai direto pra `/simulados/:id/prova`, pulando a escolha:

- Cards da timeline (`SimuladosTimelineSection`) — link direto para `/start` (página de detalhe).
- Página de detalhe (`SimuladoDetailPage`) — os 2 botões "Iniciar Simulado" (veterano + checklist) e o "Continuar Simulado" navegam direto para `/prova`.

Resultado: a maioria dos alunos nem vê a opção offline.

## Solução

Tornar o modal de escolha o **único** ponto de partida para uma tentativa nova, em qualquer entrada.

### 1. `SimuladoDetailPage.tsx`
- Adicionar estado `showModeModal` + `<OfflineModeSimpleDialog>` na página.
- Trocar os 2 botões "Iniciar Simulado" (linhas ~405 e ~538) de `navigate(.../prova)` para `setShowModeModal(true)`.
- O botão "Continuar Simulado" (linha ~614, quando `userState.started === true`) continua indo direto para `/prova` — não faz sentido reabrir escolha numa tentativa já em andamento.
- Se já existir `offline_pending` ativo (via `useOfflineAttempt`), pular o modal e ir para o gabarito digital, mantendo o comportamento atual de resume.

### 2. `SimuladosTimelineSection.tsx`
- Trocar o `<Link to="/start">` da CTA dos cards `available` / `available_late` por um `<button>` que dispara um callback `onStartSimulado(sim)` recebido por prop.
- Manter o resume (`/prova`) como `<Link>` direto quando `userState.started === true`.
- Em `SimuladosPage.tsx`, passar `onStartSimulado={(sim) => { setSelectedSim(sim); setShowModeModal(true); }}` para a seção, reutilizando o modal único já existente na página.

### 3. Microcopy
- Confirmar que o título do modal ("Como deseja realizar o simulado?") e os 2 cards (online vs offline) estão claros — já estão, manter.
- Adicionar pequeno texto no card offline reforçando "Disponível sempre, mesmo fora da janela" para alinhar com a regra de treino.

### 4. Validação
- Verificar manualmente: timeline → modal aparece; página de detalhe → modal aparece; resume de prova em andamento → vai direto pra `/prova`.
- Rodar `npm run test` (não há teste específico desse fluxo; só garantir que nada quebre).

## Arquivos tocados

- `src/pages/SimuladoDetailPage.tsx` — adicionar modal + trocar handlers dos botões "Iniciar".
- `src/components/simulados/SimuladosTimelineSection.tsx` — aceitar prop `onStartSimulado` e usar button no lugar de Link.
- `src/pages/SimuladosPage.tsx` — passar handler para a seção (modal já existe lá).
- `src/components/simulados/OfflineModeSimpleDialog.tsx` — ajuste pequeno de copy no card offline.

Sem mudanças em backend, RPCs ou regras de negócio — apenas roteamento de UI para o modal de escolha.