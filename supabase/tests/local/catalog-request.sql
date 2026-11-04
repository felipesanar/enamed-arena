-- FOR THE ORCHESTRATOR ONLY: read-only SELECTs, no network instructions.
-- Request a sanitized SQL result file if legacy replay is not equivalent.
-- No auth.users rows, Vault values, net payloads, cron commands or function bodies.
SELECT n.nspname, c.relname, c.relkind, c.relrowsecurity,
  pg_get_userbyid(c.relowner) AS owner,
  a.attname, format_type(a.atttypid,a.atttypmod) AS type,
  a.attnotnull, pg_get_expr(d.adbin,d.adrelid) AS default_expression
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
JOIN pg_attribute a ON a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped
LEFT JOIN pg_attrdef d ON d.adrelid=c.oid AND d.adnum=a.attnum
WHERE n.nspname='public' AND c.relkind IN ('r','p')
ORDER BY c.relname,a.attnum;

SELECT conrelid::regclass AS relation, conname, contype, convalidated,
  pg_get_constraintdef(oid) AS definition
FROM pg_constraint WHERE connamespace='public'::regnamespace ORDER BY 1,2;

SELECT schemaname,tablename,policyname,roles,cmd,qual,with_check
FROM pg_policies WHERE schemaname='public' ORDER BY tablename,policyname;

SELECT p.oid::regprocedure AS signature, pg_get_userbyid(p.proowner) AS owner,
  p.prosecdef, p.provolatile, p.proconfig, p.proacl
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' ORDER BY p.oid::regprocedure::text;

SELECT table_name,grantee,privilege_type FROM information_schema.table_privileges
WHERE table_schema='public' ORDER BY table_name,grantee,privilege_type;
SELECT table_name,column_name,grantee,privilege_type FROM information_schema.column_privileges
WHERE table_schema='public' ORDER BY table_name,column_name,grantee,privilege_type;

-- Supplemental fields not captured by the supplied JSON. No row values/secrets.
SELECT n.nspname,c.relname,c.relkind,c.reloptions,c.relacl,
  pg_get_userbyid(c.relowner) AS owner
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' ORDER BY c.relname;
SELECT pg_get_userbyid(d.defaclrole) AS owner,n.nspname,d.defaclobjtype,d.defaclacl
FROM pg_default_acl d LEFT JOIN pg_namespace n ON n.oid=d.defaclnamespace
WHERE d.defaclnamespace=0 OR n.nspname='public' ORDER BY 1,2,3;
SELECT n.nspname,c.relname,a.attname,coll.collname,cn.nspname AS collation_schema
FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid
JOIN pg_namespace n ON n.oid=c.relnamespace
JOIN pg_collation coll ON coll.oid=a.attcollation JOIN pg_namespace cn ON cn.oid=coll.collnamespace
WHERE n.nspname='public' AND a.attnum>0 AND NOT a.attisdropped ORDER BY c.relname,a.attnum;
