
Objetivo: corrigir o crash global `Cannot read properties of undefined (reading 'createContext')` que agora ocorre em todas as páginas.

1. Confirmar a causa principal
- O app monta `src/components/ui/sonner.tsx` globalmente em `src/App.tsx`.
- Esse wrapper importa `useTheme` de `next-themes`.
- Não existe `ThemeProvider` em nenhum lugar do projeto.
- Como `next-themes` é o único uso desse pacote, ele é o principal suspeito do crash global.

2. Corrigir a origem do erro
- Remover a dependência de `next-themes` de `src/components/ui/sonner.tsx`.
- Trocar a lógica de tema do Sonner por uma abordagem sem provider:
  - opção mais segura: fixar `theme="dark"` ou `theme="system"`
  - manter apenas o componente `Sonner` e os `toastOptions`

3. Manter compatibilidade visual
- Garantir que os estilos atuais dos toasts continuem funcionando com as classes já definidas.
- Como o app já usa tokens CSS e classes `.dark`, o toast não precisa depender de `next-themes` para funcionar.

4. Revisar pontos impactados
- Verificar `src/App.tsx` para manter a montagem de ambos os toasters sem dependências implícitas.
- Confirmar que não há outro import de `next-themes` no código da aplicação.
- Se quiser limpeza posterior, remover `next-themes` do `package.json` em uma etapa separada.

5. Validar após implementação
- Testar `/landing`, `/login` e uma rota protegida para confirmar que o crash sumiu em toda a plataforma.
- Testar exibição de toast em pelo menos um fluxo real.
- Verificar no mobile também, já que o toaster é global.

Detalhes técnicos
```text
Hoje:
App.tsx
 └─ <Sonner />
    └─ src/components/ui/sonner.tsx
       └─ useTheme() from next-themes
          └─ projeto não possui <ThemeProvider />

Plano de correção:
App.tsx
 └─ <Sonner />
    └─ src/components/ui/sonner.tsx
       └─ sem next-themes
       └─ tema definido localmente (dark/system)
```

Arquivos envolvidos
- `src/components/ui/sonner.tsx` — correção principal
- `src/App.tsx` — conferência de montagem global
- `package.json` — limpeza opcional posterior da dependência `next-themes`

Resultado esperado
- O app volta a carregar em todas as páginas.
- Os toasts continuam funcionando.
- O erro de `createContext` deixa de ocorrer por remover a importação problemática de `next-themes`.
