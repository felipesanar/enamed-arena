

# Bug: Simulado mostrando "Em andamento" antes da janela abrir

## Causa raiz

Na função `deriveSimuladoStatus` (linha 35), o check de `in_progress` verifica apenas se estamos **antes do fim da janela** (`isBefore(now, windowEnd)`), mas **não verifica se já passamos do início** (`isAfter(now, windowStart)`).

Resultado: se existe um attempt não finalizado no banco (mesmo que as respostas tenham sido apagadas), qualquer momento antes do `windowEnd` — incluindo **antes do `windowStart`** — retorna `in_progress`.

## Correção

### 1. `src/lib/simulado-helpers.ts` — linha 35

Adicionar `isAfter(now, windowStart)` à condição de `in_progress`:

```typescript
if (userState?.started && !userState.finished && isAfter(now, windowStart) && isBefore(now, windowEnd)) {
  return 'in_progress';
}
```

Isso garante que, se estivermos antes da janela, o simulado aparece como `upcoming` mesmo com attempt existente.

### 2. `src/lib/simulado-helpers.test.ts` — novo teste

Adicionar caso de teste: attempt existente + now antes do windowStart → deve retornar `upcoming`.

