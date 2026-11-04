# Identidade existente — ENAMED Arena

Este trabalho estende a interface atual. Fontes de verdade: src/index.css, tailwind.config.ts, componentes premium e src/admin/components/ui. Não substituir stack, tipografia, navegação ou temas para adicionar edições. Dendê não está conectado; sanar-ui-kit serve como referência de identidade e voz, sem instalar HeroUI/Tailwind4. Impeccable está sem launcher, conforme o fallback documentado em design-combo.

## Tokens e composição

- Plus Jakarta Sans já utilizada pelo projeto; manter escala semântica text-heading, body, caption. Admin segue os componentes AdminPageHeader e seus padrões. Números tabulares em datas e contagens.
- Paleta existente: primary/wine (`hsl(345 65% 30%)`), background (`hsl(0 0% 98.5%)`), foreground (`hsl(220 20% 10%)`), card branco, border neutra. Admin usa admin-accent (`#AB2350`), admin-bg (`#FAFAF9`), admin-surface (`#FFFFFF`), admin-text (`#1A1715`), admin-line (`#E7E5E3`). São referências extraídas do CSS; usar tokens, nunca literais novos no produto.
- Superfícies planas e contraste claro, sem novas sombras decorativas, gradientes, métricas fictícias ou ícones por seção. Uma ação principal por contexto; demais ações secundárias/textuais. Ícones Lucide existentes, com nome acessível ou aria-hidden quando redundantes.
- Desktop: listagem de edições como tabela compacta com código/rótulo, status textual, data e ação Editar; formulário de edição no mesmo fluxo, com grupos Identificação, Calendário, Formato. Mobile: linhas empilhadas preservando rótulos, sem rolagem horizontal de página.
- Aluno: seletor de edição próximo do título; edição-alvo primeiro, histórico em seção recolhível. Não criar um dashboard novo. Ausência de calendário é um estado informativo com acesso aos treinos.

## Interação e conteúdo

Pt-BR, sentence case. Ações "Nova edição", "Salvar edição", "Clonar como rascunho". Não chamar data estimada de oficial. Campo de data vazio com "Aguardando divulgação do Inep"; opção "Data confirmada" só com data válida. Resultados oficiais separados do calendário dos simulados.

Loading com dimensões estáveis; erro explica falha e oferece Tentar novamente; vazio oferece a próxima ação cabível; confirmação de salvamento via padrão de toast. Formulários mantêm conteúdo em falha de rede, erros associados ao campo, botões desabilitados somente durante envio/condição inválida. Foco no primeiro erro; fechamento retorna foco ao disparador. Controles com labels visíveis, foco aparente, status nunca só por cor e texto >=4.5:1.

Motion: somente transições existentes de abrir/fechar e feedback de ação, 120–180ms, sem entradas sequenciais ou pulsos novos. Reduced-motion remove movimento não essencial. Não é necessário novo sistema de animação.

## Direção revisada e handoff

O elemento característico é a continuidade entre edições: código e calendário legíveis na mesma linha e histórico claramente nomeado. Uma proposta de cards iguais por edição foi descartada porque dificulta comparar calendários e repete o conteúdo da tabela. A identidade e os componentes do painel foram preservados.

O pedido de execução integral sem perguntas autoriza seguir a direção existente para esta extensão reversível; os checkpoints de design não serão convertidos em novas perguntas. Prototipar com dados marcados como demonstração; validar 1440/768/375, foco, textos longos, datas nulas e todos os estados antes do handoff de UI. Nenhum dado/code privado enviado a Stitch ou serviço de design externo.
