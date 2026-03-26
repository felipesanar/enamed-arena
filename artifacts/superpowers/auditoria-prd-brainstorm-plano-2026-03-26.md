# Brainstorm + Plano de Auditoria do PRD (Simulados SanarFlix)

## Objetivo
Mapear, com profundidade, tudo que o PRD da Plataforma de Simulados prev? e que est? incompleto, parcial ou n?o implementado no c?digo atual, gerando backlog acion?vel por feature.

## Escopo do PRD auditado
- Onboarding segmentado (nao aluno / padrao / PRO), com especialidade + instituicoes
- Modo prova com janela temporal, autosave, retomada por queda, marcacoes de questao, antipausa e anti-troca de aba
- Pos-janela: correcao, desempenho, ranking, gates por plano, CTAs de upsell
- Comparativo entre simulados
- Caderno de Erros (somente PRO)
- Regras de liberacao por data/hora
- KPIs e requisitos de fluxo/checklist

## Restricoes e riscos
- PRD tem secoes incompletas (login, jornada de emails, premiacoes, correcao ao vivo) que podem nao ter criterios fechados.
- Pode haver implementacoes parciais sem cobertura de edge cases (ex.: janela temporal sem enforcement server-side).
- Possivel divergencia entre UI e backend (feature aparece no front, mas sem regra robusta no backend).

## Criterios de aceite da auditoria
- Cada requisito do PRD classificado como: Implementado / Parcial / Nao implementado / Nao especificado no produto.
- Para cada gap: evidencia de codigo, impacto, prioridade (Blocker/Major/Minor/Nit) e recomendacao concreta.
- Consolidacao final em matriz PRD x Codigo + backlog de execucao.

## Plano de execucao (profundo)
1) Inventariar requisitos do PRD em checklist estruturado por feature.
2) Mapear no codigo os modulos/rotas/componentes relacionados a simulados.
3) Auditar feature a feature (fluxo feliz + regras + gates + estados + edge cases).
4) Validar onde ha persistencia real (dados de onboarding, respostas, status, ranking, caderno).
5) Classificar gaps por severidade e risco de negocio/experiencia.
6) Consolidar backlog de implementacao por ondas (rapidas, estruturais, premium).
7) Registrar perguntas objetivas (max 3) apenas para bloqueios de interpretacao.

## Verificacao prevista
- Leitura orientada por busca semantica e textual no repositorio.
- Cruzamento de rotas/telas com servicos e regras de negocio.
- Revisao final com checklist completo do PRD.
