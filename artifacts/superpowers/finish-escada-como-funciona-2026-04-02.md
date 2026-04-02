# Finish ? Escada no Como Funciona (2026-04-02)

## Entrega
- Se??o de passos em `Como funciona` convertida para layout em escada no desktop.
- Mobile permanece linear, sem deslocamentos.
- Ajustes de largura e padding para evitar overflow e clipping.

## Arquivo alterado
- `src/components/landing/LandingHowItWorks.tsx`

## Verifica??o
- `ReadLints` no arquivo alterado: sem erros.

## Resumo t?cnico
- Escada aplicada com offsets progressivos por ?ndice (`lg:ml-*`).
- Largura dos cards limitada em desktop com `lg:w-[calc(100%-7.5rem)]`.
- Cont?iner com `lg:pr-20` para preservar respiro visual do avan?o ? direita.
