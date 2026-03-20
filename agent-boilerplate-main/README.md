# Antigravity Project Boilerplate

Este boilerplate contém as configurações de **Superpowers** (rules, skills e workflows) configuradas para este projeto.

## Como usar

Sempre que você começar um projeto novo no Antigravity e quiser usar estas mesmas configurações, siga os passos abaixo:

1. Copie a pasta `.agent` deste boilerplate para a raiz do seu novo projeto.
2. Certifique-se de que o Antigravity recarregou as configurações (ou rode `/superpowers-reload` se disponível).

## O que está incluído?

- **Rules**: Regras específicas para arquitetos backend, reviewers, especialistas em Supabase, UX, etc.
- **Skills**: Habilidades como planejamento (superpowers-plan), review (superpowers-review) e TDD.
- **Workflows**: Comandos úteis como `/deploy`, `/superpowers-execute-plan`, etc.

## Script de Configuração

Você também pode usar o script `setup.ps1` (PowerShell) para automatizar a cópia:

```powershell
.\setup.ps1 -TargetDir "C:\Caminho\Para\Seu\Novo\Projeto"
```
