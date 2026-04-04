
Objetivo: eliminar o white screen e o erro `Cannot read properties of undefined (reading 'createContext')` que acontece logo no carregamento inicial.

O que a leitura mostrou
- O projeto atual não usa mais `next-themes`; essa hipótese antiga não explica o erro atual.
- Há apenas uma versão principal de `react`/`react-dom` no `package-lock.json`.
- O crash acontece antes da UI renderizar, então o problema mais provável está em um módulo global carregado no bootstrap.
- Os candidatos globais são: `react-router-dom`, providers/toasts Radix/Sonner e o `manualChunks` customizado do `vite.config.ts`.
- O `vite.config.ts` está fazendo um split agressivo em vários vendors (`vendor-react`, `vendor-router`, `vendor-radix`, `vendor-misc`), e esse é o ponto mais suspeito para um chunk receber React de forma incorreta.
- Existe ainda drift de dependências: `bun.lock` continua referenciando `next-themes`, mesmo com `package.json` já limpo.

Plano de correção
1. Estabilizar o bundling
- Simplificar/remover o `manualChunks` de `vite.config.ts`.
- Deixar o Vite/Rollup cuidar do chunking padrão, ou manter apenas splits realmente seguros para libs pesadas lazy (`xlsx`, `jszip`, `recharts`).
- Objetivo: evitar que um chunk global carregue uma referência quebrada de React no bootstrap.

2. Normalizar o estado das dependências
- Alinhar `package.json` e lockfiles.
- Remover referências antigas como `next-themes` dos lockfiles remanescentes.
- Padronizar o projeto para um único lockfile efetivo, evitando inconsistência entre ambiente local/preview/build.

3. Reduzir a superfície global do bootstrap
- Revisar `src/App.tsx` para confirmar que somente o necessário sobe no carregamento inicial.
- Se o erro persistir após o ajuste do bundling, isolar temporariamente os montes globais nesta ordem:
  - `Sonner`
  - `Toaster`
  - `TooltipProvider`
  - `FloatingOfflineTimer`
- Reintroduzir o que for seguro depois que a tela voltar a renderizar.

4. Fechar a causa real, não só mascarar
- Se o erro continuar, o próximo alvo será o pacote global que chama `createContext` no import-time.
- Pela leitura atual, os suspeitos principais são:
  - `react-router-dom` no bootstrap
  - providers Radix montados globalmente
  - `sonner` se ainda cair em chunk compartilhado problemático

Arquivos envolvidos
- `vite.config.ts` — correção principal mais provável
- `src/App.tsx` — isolamento do bootstrap global
- `package.json`
- `package-lock.json` e/ou `bun.lock`

Validação esperada
- App renderiza novamente sem tela branca.
- `/landing`, `/login` e `/` carregam sem erro no console.
- Um fluxo com toast continua funcionando.
- Uma rota autenticada continua abrindo normalmente.

Detalhe técnico
```text
Hoje:
App bootstrap
 ├─ providers globais
 ├─ BrowserRouter
 ├─ toasts/providers
 └─ chunks manuais agressivos
        ↓
algum vendor compartilhado sobe com React incorreto/indefinido
        ↓
createContext quebra no import-time
        ↓
tela branca

Plano:
1) reduzir/simplificar manualChunks
2) alinhar lockfiles
3) isolar mounts globais em App
4) reintroduzir providers com segurança
```
