# Wizard offline (impressão em 3 passos) — referência

Este diretório guarda um **snapshot** do fluxo mais elaborado:

- Escolha online/offline → aviso/consentimento → janela de tempo para imprimir (com PDF e tentativa criados conforme a versão arquivada).

## Arquivos

| Arquivo | Uso ao reativar |
|---------|-----------------|
| `OfflineModeWizardDialog.tsx` | Copiar para `src/components/simulados/OfflineModeWizardDialog.tsx` |
| `offline-printing.ts` | Copiar para `src/lib/offline-printing.ts` |

## Passos para reativar no app

1. Copie os dois arquivos acima para `src/` nos caminhos indicados (mantendo os imports `@/`).
2. Em `SimuladosPage.tsx`, troque `OfflineModeSimpleDialog` por `OfflineModeWizardDialog` e passe as props que o componente esperar (ex.: `prefersReducedMotion` se a API da época exigir).
3. Rode `npm run lint` e `npm run test`.

## Branch Git (opcional)

Para só preservar histórico sem pasta no repo, pode-se manter uma branch com o wizard em `src/` antes do modo simples, e fazer merge seletivo no futuro.

## Produto atual (modo simples)

No código principal, o offline usa `OfflineModeSimpleDialog`: ao escolher offline, baixa o PDF, cria a tentativa e ativa o cronômetro; o ranking/treino segue as regras do **servidor** ao enviar o gabarito (janela de execução do simulado, tempo da prova etc.).

## Branch Git

Para guardar só este snapshot sem misturar com outras alterações locais:

```bash
git checkout -b archive/offline-printing-wizard
git add archive/offline-printing-wizard/ src/components/simulados/OfflineModeSimpleDialog.tsx src/pages/SimuladosPage.tsx eslint.config.js
git add -u src/components/simulados/OfflineModeWizardDialog.tsx src/lib/offline-printing.ts 2>nul || true
git commit -m "feat(offline): modo simples no app; wizard em archive/"
```

(Ajuste os paths se o Git não listar os removidos — use `git add -u src/components/simulados/` após remover o wizard.)
