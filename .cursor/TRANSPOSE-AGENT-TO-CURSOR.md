# Transposição .agent → padrão Cursor

Este guia mapeia a estrutura típica de um repositório **agent-boilerplate** (pasta `.agent`) para o padrão do **Cursor** (`.cursor/`).

> **Repositório inacessível:** o repositório `https://github.com/mcunha12/agent-boilerplate` não está disponível (404). Quando você tiver a pasta `.agent` (clone manual, repo privado com acesso ou cópia dos arquivos), use o script abaixo para transpô-la ao Cursor.

## Padrão Cursor (vs Antigravity / .agent)

**Rules (.mdc):** Apenas `description`, `alwaysApply` (boolean) e, opcionalmente, `globs`. Não use `trigger` nem outros campos do Antigravity.

**Skills (SKILL.md):** Apenas `name` e `description`. Sem `trigger` ou metadados extras.

## Mapeamento rápido

| .agent | Cursor | Observação |
|--------|--------|------------|
| `.agent/rules/*.md` | `.cursor/rules/*.mdc` | Regras: frontmatter com `description` e `alwaysApply`; remover `trigger` |
| `.agent/skills/<nome>/` | `.cursor/skills/<nome>/` | Skills: apenas `name` e `description` no frontmatter |
| `.agent/workflows/*.md` | `.cursor/commands/*.md` | Workflows viram comandos (description no frontmatter + corpo como instrução) |
| `.agent/AGENTS.md` ou bootstrap | Regras globais ou `.cursor/rules/` | Conteúdo de bootstrap pode virar rule `alwaysApply: true` ou ser distribuído |

---

## 1. Rules (`.agent/rules/` → `.cursor/rules/`)

**Formato Cursor:** arquivos `.mdc` com frontmatter.

```yaml
---
description: "Breve descrição do que a rule faz"
globs: "**/*.ts"   # opcional: só para certos arquivos
alwaysApply: false # true = aplica em toda conversa
---

# Título

Conteúdo da rule em Markdown...
```

**Conversão:**
- Copie cada `.agent/rules/XX-nome.md` para `.cursor/rules/nome.mdc`.
- Adicione o bloco `---` no topo com pelo menos `description` e `alwaysApply`.
- Use o primeiro `# Título` ou o nome do arquivo como base para `description`.
- Se a rule for “global” (protocolo/bootstrap), use `alwaysApply: true`.

---

## 2. Skills (`.agent/skills/` → `.cursor/skills/`)

**Formato Cursor:** uma pasta por skill com `SKILL.md` obrigatório.

```
.cursor/skills/
  nome-da-skill/
    SKILL.md         # obrigatório; frontmatter: name, description
    reference.md     # opcional
    examples.md      # opcional
    scripts/         # opcional
```

**SKILL.md no Cursor:**

```yaml
---
name: nome-da-skill
description: "O que a skill faz e quando usar (terceira pessoa, termos de acionamento)"
---

# Nome da Skill

## Instruções
...
```

**Conversão:**
- Copie cada `.agent/skills/<nome>/` para `.cursor/skills/<nome>/`.
- Se existir apenas um `.md` solto na skill, renomeie para `SKILL.md` e adicione frontmatter com `name` e `description`.
- Mantenha `reference.md`, `examples.md`, `scripts/` se existirem.
- Descrição: terceira pessoa, específica, com “Use quando…” para o agente descobrir a skill.

---

## 3. Workflows (`.agent/workflows/` → `.cursor/commands/`)

**Formato Cursor:** um arquivo `.md` por comando em `.cursor/commands/`.

```yaml
---
description: "O que o comando faz (aparece no seletor de comandos)"
---

Instruções passo a passo para o agente executar o workflow.
```

**Conversão:**
- Cada workflow em `.agent/workflows/nome-do-workflow.md` (ou equivalente) vira `.cursor/commands/nome-do-workflow.md`.
- Adicione frontmatter com `description`.
- O corpo do arquivo = instruções que o agente segue ao executar o comando.

---

## 4. Outros arquivos .agent

- **AGENTS.md / SOUL.md / TOOLS.md:** podem virar uma rule global (`.cursor/rules/bootstrap.mdc` com `alwaysApply: true`) ou ser incorporados em rules específicas.
- **knowledge/, memory/:** não têm equivalente direto no Cursor; use como referência em rules ou no conteúdo de skills/commands quando fizer sentido.

---

## Como usar o script de transposição

No diretório do projeto:

```powershell
# Se você clonar o agent-boilerplate para uma pasta local:
.\.cursor\scripts\transpose-agent-to-cursor.ps1 -AgentPath "C:\caminho\para\agent-boilerplate\.agent"

# Ou apontando para uma pasta que contenha rules, skills e workflows:
.\.cursor\scripts\transpose-agent-to-cursor.ps1 -AgentPath "C:\caminho\para\minha-pasta-agent"
```

O script:
- Converte `rules/*.md` → `.cursor/rules/*.mdc`
- Copia `skills/*` → `.cursor/skills/*` e ajusta frontmatter em `SKILL.md`
- Converte `workflows/*.md` → `.cursor/commands/*.md`

Depois de rodar, revise as `description` e `globs` em cada arquivo gerado.
