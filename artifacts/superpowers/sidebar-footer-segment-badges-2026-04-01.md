# SidebarFooterAccount: PRO + marca SanarFlix

## Comportamento

- `segment === 'pro'`: badge textual **PRO** (âmbar, ao lado do nome).
- `segment === 'standard' | 'pro'`: ícone `/sanarflix-icon.png` antes do e-mail (decoração; `alt=""`).
- `guest`: sem badge nem ícone.

## Arquivos

- `src/components/premium/sidebar/SidebarFooterAccount.tsx`
- `src/components/brand/BrandMark.tsx` — constante `SANARFLIX_MARK_SRC`

## Verificação

- `npm run test -- --run` — 45 passed (2026-04-01).
