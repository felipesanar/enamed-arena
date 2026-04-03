

# Simulado de teste visível apenas para admins

## Problema
Não existe uma forma de criar simulados "de teste" que só apareçam para administradores na tela de simulados do usuário. Hoje, um simulado ou está `draft` (invisível para todos) ou `published` (visível para todos).

## Solução

Adicionar um novo status `test` ao enum `simulado_status` no banco. Simulados com status `test` serão visíveis e acessíveis **apenas para admins** na listagem de simulados do usuário.

### 1. Migration: adicionar status `test` ao enum e ajustar RLS

```sql
ALTER TYPE simulado_status ADD VALUE 'test';

-- Nova policy: admins podem ver simulados de teste
CREATE POLICY "Admins can read test simulados"
ON public.simulados FOR SELECT TO authenticated
USING (status = 'test' AND has_role(auth.uid(), 'admin'));
```

A policy existente "Anyone can read published simulados" já cobre `published`. A nova policy cobre `test` apenas para admins.

### 2. Frontend: `simuladosApi.listSimulados()`

Atualmente filtra `.eq('status', 'published')`. Mudar para:

```typescript
.in('status', ['published', 'test'])
```

O RLS garante que apenas admins verão os de status `test`. Não-admins recebem apenas `published`.

### 3. Frontend: Badge visual na listagem

No componente de card do simulado, quando o status do banco for `test`, exibir um badge "TESTE" para que o admin identifique visualmente. Preciso verificar qual componente renderiza os cards.

### 4. Admin Form: opção `test` no dropdown de status

Em `AdminSimuladoForm.tsx`, adicionar a opção `test` (Teste) no `<select>` de status, ao lado de `draft` e `published`.

### 5. Tipo `SimuladoConfig`

Adicionar campo `dbStatus` (ou similar) ao tipo para carregar o status original do banco (`published`/`test`), já que o `status` derivado é calculado client-side. Isso permite exibir o badge de teste.

## Arquivos modificados
- **Migration SQL** — enum + RLS policy
- `src/services/simuladosApi.ts` — query `.in()` + mapear `dbStatus`
- `src/types/index.ts` — campo `dbStatus` em `SimuladoConfig`
- `src/admin/pages/AdminSimuladoForm.tsx` — opção "Teste" no select
- Componente de card de simulado (a identificar) — badge "TESTE"

