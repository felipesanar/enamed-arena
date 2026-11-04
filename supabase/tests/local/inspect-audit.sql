-- Read-only diagnostic for the restored local function and trigger bindings.
SELECT pg_get_functiondef('public.tg_admin_audit()'::regprocedure);
SELECT c.relname, t.tgname, pg_get_triggerdef(t.oid)
FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
WHERE t.tgfoid='public.tg_admin_audit()'::regprocedure;
