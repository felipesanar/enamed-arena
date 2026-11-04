-- Aplicada em PROD via MCP em 2026-08-04.
--
-- Fecha o WARN `function_search_path_mutable` (era a única função de public sem
-- search_path fixo). Corpo idêntico ao anterior, só com unaccent qualificado:
-- unaccent vive no schema `extensions`, então com search_path = '' a chamada
-- precisa ser explícita. regexp_replace/lower/coalesce vêm de pg_catalog, que é
-- sempre pesquisado independente do search_path.
create or replace function public._norm_match(t text)
 returns text
 language sql
 immutable
 set search_path = ''
as $function$
  SELECT regexp_replace(
    regexp_replace(extensions.unaccent(lower(coalesce(t,''))), '[\-–—/]', ' ', 'g'),
    '\s+', ' ', 'g'
  )
$function$;
