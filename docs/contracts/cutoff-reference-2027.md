# Cortes por referência — expansão sem atribuir fonte histórica

D6 continua sem fonte confirmada. Não atribuir os cortes legados a um processo por suposição. Preparar cadastro/importação e consultas escopadas; linhas antigas mantêm reference_edition_id/source nulos até decisão explícita. Nenhuma ação em produção.

`enamed_cutoff_scores` e `enamed_programs`: reference_edition_id uuid nullable FK exam_editions, source text nullable. Unique de novos cortes com referência conhecida: institution_id, specialty_id, practice_scenario, reference_edition_id; duplicatas/IDs nulos legados são reportados e preservados. Não deduplicar/apagar dados automaticamente. Programas normalizam cenario_pratica somente na chave, preservando texto.

`get_cutoff_scores(p_specialty_id uuid,p_institution_ids uuid[],p_reference_edition_id uuid default null)` mantém as seis colunas atuais e acrescenta reference_edition_id, reference_label, source. Referência explícita retorna todos os cenários daquela chave/processo, nunca o maior corte de vários processos. Null com editions_ui=false preserva a consulta antiga apenas sobre linhas legadas de referência nula. Null com editions_ui=true resolve edição corrente pelo catálogo/estado, sem inventar datas e sem fallback para referências diferentes. Sem referência/dados conhecidos: zero linhas.

`get_user_cutoff_context(p_user_id uuid default auth.uid(),p_reference_edition_id uuid default null)` mantém ownership e JSON legado; acrescenta metadata de referência, nunca agrega processos distintos. Novas consultas usam IDs canônicos de onboarding quando presentes; transparência para sem match. ACL não é ampliada.

`admin_import_cutoffs(p_reference_edition_id uuid,p_source text,p_rows jsonb) returns jsonb`: content.manage, identidade e diff auditados, lote inteiro atômico; linhas com institution_id uuid, specialty_id uuid, practice_scenario text, cutoff_score_general numeric, cutoff_score_quota numeric|null, vagas integer opcional. Resposta {ok:boolean, imported:number, errors:[{row:number,field:string,message:string}]}; valida fonte não vazia, edição e IDs, valores finitos, duplicatas do lote/DB, sem troca silenciosa de referências ou gabaritos. Importação rejeita conflitos, sem upsert substitutivo. Fonte é informada pelo administrador, sem consulta externa automática. Update programático de dados existentes tem fluxo futuro próprio.

UI posterior: contexto mostra referência/fonte ou desconhecida e ressalva fixa de estimativa, provas/escalas diferentes e TRI. Não usar corte bruto como proficiência estimada.
