-- ICU en-US approximates Unicode casing, not full libc en_US.UTF-8 equivalence.
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_database WHERE datname=current_database()
    AND datlocprovider='i' AND datlocale='en-US' AND pg_encoding_to_char(encoding)='UTF8')
    OR lower(chr(205)) IS DISTINCT FROM chr(237)
    OR upper(chr(237)) IS DISTINCT FROM chr(205)
    OR lower(U&'CL\00CDNICA M\00C9DICA') IS DISTINCT FROM U&'cl\00EDnica m\00E9dica' THEN
    RAISE EXCEPTION 'LOCAL ICU en-US UTF8 and Unicode casing regression';
  END IF;
END $$;
SELECT json_build_object('database', datname, 'provider', datlocprovider,
  'locale', datlocale, 'datcollate', datcollate, 'datctype', datctype,
  'encoding', pg_encoding_to_char(encoding),
  'unicode_lower', lower(chr(205))=chr(237),
  'unicode_upper', upper(chr(237))=chr(205),
  'unicode_area', lower(U&'CL\00CDNICA M\00C9DICA')=U&'cl\00EDnica m\00E9dica')
FROM pg_database WHERE datname=current_database();
