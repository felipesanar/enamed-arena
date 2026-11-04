# Contrato de desempenho por edição — F1-7 SQL

Preservar nomes, tipos e significado das colunas atuais; novos parâmetros opcionais e chamadas antigas continuam válidos. Sem overloads ambíguos no PostgREST.

```sql
get_user_performance_summary(
 p_user_id uuid default auth.uid(), p_edition_id uuid default null,
 p_include_training boolean default true
);
get_user_performance_history(
 p_user_id uuid default auth.uid(), p_limit integer default null,
 p_edition_id uuid default null, p_include_training boolean default true,
 p_offset integer default 0
);
```

`p_edition_id=null` e treino incluído preservam a consulta legada. Limite explícito antigo continua respeitado; sem limite explícito, histórico não tem teto arbitrário de 20. A UI nova só chama o escopo novo com edição resolvida e include_training=false; edição não resolvida produz estado neutro, sem misturar 2026 no KPI de 2027.

No escopo novo, considerar resultados liberados e tentativas finalizadas elegíveis, sem treino. Deduplicação por usuário/simulado segue o critério da função de ranking F0, para não contar duas modalidades como duas provas. Resultados de outra edição não entram. Histórico completo permanece opt-in; comparabilidade entre edições usa percentis em fase posterior, sem comparar percentuais brutos como proficiência.

RPCs só retornam dados do usuário autenticado solicitado; não abrir agregados de outros alunos, previews administrativos ou SELECT de colunas de gabarito. As tabelas cacheadas e o finalizador permanecem intactos nesta expansão. Nada é reprocessado, apagado ou aplicado em produção.
