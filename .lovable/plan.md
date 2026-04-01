

## Plan: CTA "Continuar" no modal HubSpot + revisão do fluxo completo

### Problema atual

O modal HubSpot é obrigatório mas não tem saída clara. Após o envio do formulário HubSpot, o usuário fica preso -- não há CTA para prosseguir à tela de "Verifique seu e-mail". O `onOpenChange` nunca é chamado porque o modal bloqueia fechamento.

### Fluxo corrigido

```text
[Preenche nome, email, senha] → [Clica "Criar minha conta"]
     ↓
Supabase signup (email disparado) + Modal HubSpot abre
     ↓
[Preenche telefone + etapa] → [Envia formulário HubSpot]
     ↓
HubSpot mostra "Obrigada!" → Aparece botão "Continuar →"
     ↓
[Clica "Continuar"] → Modal fecha → Tela "Verifique seu e-mail"
```

### Alterações

#### 1. HubSpotFormModal — adicionar callback `onFormSubmitted` + botão "Continuar"

**Arquivo:** `src/components/auth/HubSpotFormModal.tsx`

- Adicionar prop `onComplete: () => void`
- No `hbspt.forms.create`, usar callback `onFormSubmitted` do HubSpot SDK para detectar envio
- Quando o formulário é enviado, mostrar um estado de sucesso interno com:
  - Icone de check verde
  - Mensagem "Cadastro completo! Agora verifique seu e-mail para ativar sua conta."
  - Botão CTA primário: **"Continuar →"** que chama `onComplete()`
- Estado interno: `submitted: boolean` (useState)
- O botão "Continuar" aparece **dentro** do modal, substituindo o formulário

#### 2. LoginPage — conectar `onComplete` ao fluxo

**Arquivo:** `src/pages/LoginPage.tsx`

- Trocar o `onOpenChange` atual do `HubSpotFormModal` por um `onComplete` que:
  - Fecha o modal (`setHubspotModalOpen(false)`)
  - Transiciona para `flowState = "sent"` (tela de verificação de email)
- A tela "sent" já existe e está funcional -- apenas precisa ser ativada corretamente

### Detalhes técnicos

- O HubSpot embed SDK v2 suporta `onFormSubmitted: (form, data) => {}` -- é chamado após submit com sucesso
- O estado `submitted` controla a renderização condicional dentro do DialogContent
- O modal continua não-fechável até o usuário clicar "Continuar" (mantém `onPointerDownOutside` e `onEscapeKeyDown` preventDefault)

