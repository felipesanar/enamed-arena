

# Fallback do HubSpot — permitir continuar se bloqueado

## Problema

Bloqueadores de rastreamento (Brave, Edge Tracking Prevention, uBlock) impedem o carregamento do formulário HubSpot embed. Como o modal é obrigatório e não tem botão de fechar, o usuário fica preso após o cadastro.

## Solução

Adicionar detecção de falha no `HubSpotFormModal` com timeout + fallback visual.

## Alterações

### `src/components/auth/HubSpotFormModal.tsx`

1. Novo estado `loadFailed` (boolean, default false)
2. Após o script carregar, iniciar um timer de ~5s. Se `onFormReady` não disparar nesse intervalo, setar `loadFailed = true`
3. Quando `loadFailed === true`, renderizar um estado alternativo no modal:
   - Ícone de aviso sutil
   - Texto: "Não foi possível carregar o formulário complementar. Você pode continuar normalmente."
   - Botão "Continuar" que chama `onComplete()`
4. O timer é limpo se `onFormReady` disparar antes do timeout

Nenhum outro arquivo é alterado. O fluxo normal (sem bloqueador) permanece idêntico.

