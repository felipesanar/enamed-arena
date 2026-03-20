---
description: "Adiciona, commita e faz push para a branch main"
---


Este workflow automatiza o processo de deploy básico para a branch main.

// turbo
1. Adicionar todos os arquivos ao staging
`git add .`

2. Fazer o commit das alterações. O usuário pode alterar a mensagem se desejar.
`git commit -m "Atualizações automáticas via workflow"`

// turbo
3. Enviar as alterações para o repositório remoto (origin main)
`git push origin main`
