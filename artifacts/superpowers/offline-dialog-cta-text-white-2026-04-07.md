# Offline dialog CTA — texto branco (2026-04-07)

## Mudança
- Arquivo: `src/components/simulados/OfflineModeSimpleDialog.tsx`
- Botão "Continuar e baixar PDF": adicionado `!text-white` na `className` para garantir contraste no fundo `bg-primary` (vinho).

## Causa provável
- `text-body` (token de tamanho no Tailwind) + `tailwind-merge` pode eliminar `text-primary-foreground` do variant default do `Button`, herdando `text-foreground` do dialog.

## Verificação
- `npm run lint` (0 erros; warnings pré-existentes no repo)

## Review
- **Blocker:** nenhum
- **Major:** nenhum
- **Minor:** nenhum
- **Nit:** padrão alinhado a `ProGate.tsx` (`!text-white`)
