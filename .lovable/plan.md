

## Diagnóstico

O erro `Cannot access 'P' before initialization` em `vendor-misc-DinUoZt-.js` vem de um **build antigo em cache**. O arquivo `vendor-misc-*` não existe mais no `dist/assets` atual — o build limpo (sem `manualChunks`) já está correto.

A causa: o preview está servindo assets de um build anterior que ainda tinha o `manualChunks` agressivo. Isso é um problema de cache, não de código.

## Plano

### 1. Forçar rebuild limpo
- Deletar a pasta `dist/` por completo
- Executar `npx vite build` para gerar um build fresco sem chunks manuais
- Confirmar que nenhum arquivo `vendor-misc-*` é gerado

### 2. Limpar cache do Vite
- Deletar `node_modules/.vite` (cache de pre-bundling do Vite)
- Isso garante que o dev server também não sirva módulos pré-empacotados antigos

### 3. Validar
- Verificar que o app carrega sem erros no console
- Testar `/landing`, `/login` e `/` (rota protegida)

---

**Detalhe técnico:** O `vite.config.ts` já está correto (sem `manualChunks`). O único problema é que o preview continua servindo o build anterior. A solução é puramente operacional: limpar cache e rebuildar.

