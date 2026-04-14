
-- Enable unaccent extension for diacritic-insensitive matching
CREATE EXTENSION IF NOT EXISTS unaccent SCHEMA extensions;

-- Normalize text for fuzzy matching: lowercase, remove accents, standardize dashes, collapse whitespace
CREATE OR REPLACE FUNCTION public.normalize_text_for_match(input text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public, extensions
AS $$
  SELECT lower(
    regexp_replace(
      translate(
        translate(
          extensions.unaccent(trim(COALESCE(input, ''))),
          E'\u2013\u2014\u2015', '---'
        ),
        E'"''', ''
      ),
      '\s+', ' ', 'g'
    )
  )
$$;

-- RPC to match cutoff scores with normalized comparison
CREATE OR REPLACE FUNCTION public.match_cutoff_score(
  p_specialty text,
  p_institution text
)
RETURNS TABLE(
  institution_name text,
  practice_scenario text,
  specialty_name text,
  cutoff_score_general numeric,
  cutoff_score_quota numeric
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    ecs.institution_name,
    ecs.practice_scenario,
    ecs.specialty_name,
    ecs.cutoff_score_general,
    ecs.cutoff_score_quota
  FROM enamed_cutoff_scores ecs
  WHERE normalize_text_for_match(ecs.specialty_name)
      = normalize_text_for_match(p_specialty)
    AND normalize_text_for_match(ecs.institution_name)
      LIKE '%' || normalize_text_for_match(p_institution) || '%'
  LIMIT 1;
$$;
