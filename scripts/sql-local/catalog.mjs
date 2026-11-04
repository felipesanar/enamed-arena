const quote = value => `"${String(value).replaceAll('"', '""')}"`;
const literal = value => `'${String(value).replaceAll("'", "''")}'`;
const table = name => `"public".${quote(name)}`;
const roles = new Set(['PUBLIC', 'postgres', 'anon', 'authenticated', 'service_role']);
const privileges = { a: 'INSERT', r: 'SELECT', w: 'UPDATE', d: 'DELETE', D: 'TRUNCATE', x: 'REFERENCES', t: 'TRIGGER', m: 'MAINTAIN', X: 'EXECUTE', U: 'USAGE' };

export function parseAcl(value) {
  if (typeof value !== 'string' || !value.startsWith('{') || !value.endsWith('}')) throw new Error('Unsupported ACL encoding');
  if (value === '{}') return [];
  const result = [];
  for (const entry of value.slice(1,-1).split(',')) {
    const match = /^([a-zA-Z0-9_]*|"[a-zA-Z0-9_]+")=([a-zA-Z*]*)\/([a-zA-Z0-9_]+)$/.exec(entry);
    if (!match) throw new Error('Unsupported ACL entry');
    const role = match[1].replaceAll('"','') || 'PUBLIC';
    if (!roles.has(role)) throw new Error(`Unsupported ACL role: ${role}`);
    for (let i = 0; i < match[2].length; i++) {
      const privilege = privileges[match[2][i]];
      if (!privilege) throw new Error('Unknown ACL privilege');
      const grantOption = match[2][i+1] === '*';
      if (grantOption) i++;
      result.push({ role, privilege, grantOption });
    }
  }
  return result;
}

export function restoreCatalog(data) {
  for (const key of ['relations','columns','enums','constraints','functions','indexes','policies','triggers','views',
    'auth_public_triggers','column_acls','default_acls','role_capabilities','extensions']) {
    if (!Array.isArray(data[key])) throw new Error(`Missing catalog field: ${key}; request a read-only catalog SELECT, do not guess`);
  }
  const sql = ['-- LOCAL RESTORE FROM EXPLICIT CATALOG INPUT; not pg_dump equivalence.',
    'SET search_path = public, extensions, pg_catalog;', 'SET check_function_bodies = off;'];
  const deviations = [
    'Managed auth.users/uid/role, storage, Vault, pg_net and cron use explicit LOCAL doubles.',
    'Only public objects restored; auth.users is a minimal double, not the full auth schema.',
    'check_function_bodies=off during dependency restoration; restored function bodies and security clauses are unchanged.',
    'Schema owners/USAGE, database privileges and cluster memberships are not supplied by this catalog.',
    'Function/table ACL grantees and grant options preserved; historical grantor identity is not impersonated.',
    'View reloptions, column collations, extension internals and global default ACLs were not captured; no full schema-equivalence claim.',
  ];
  const verification = ['BEGIN;', 'SET LOCAL search_path = public, extensions, pg_catalog;',
    `CREATE FUNCTION pg_temp.acl_signature(value aclitem[]) RETURNS jsonb LANGUAGE sql AS $acl$
      SELECT coalesce(jsonb_agg(jsonb_build_array(CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE pg_get_userbyid(a.grantee)::text END,
        a.privilege_type,a.is_grantable) ORDER BY a.grantee,a.privilege_type,a.is_grantable),'[]'::jsonb)
      FROM aclexplode(value) a
    $acl$;`];
  const verify = (condition, label) => verification.push(`DO $verify$ BEGIN ASSERT (${condition}), ${literal(label)}; END $verify$;`);
  const functionId = fn => `"public".${quote(fn.name)}(${fn.signature})`;
  const roleSql = role => role === 'PUBLIC' ? 'PUBLIC' : quote(role);
  const ownerCheck = owner => { if (owner !== 'postgres') throw new Error(`Unsupported restore owner: ${owner}`); };
  const grant = (acl, on, column = '') => parseAcl(acl).map(a => `GRANT ${a.privilege}${column} ON ${on} TO ${roleSql(a.role)}${a.grantOption ? ' WITH GRANT OPTION' : ''};`);

  for (const ext of data.extensions) {
    if (['plpgsql','pg_net','supabase_vault','pg_stat_statements'].includes(ext.name)) {
      if (ext.name !== 'plpgsql') deviations.push(`Extension ${ext.name} not installed/restored as a real managed extension.`);
    } else if (['pgcrypto','unaccent','uuid-ossp'].includes(ext.name) && ext.schema === 'extensions') {
      sql.push(`CREATE EXTENSION IF NOT EXISTS ${quote(ext.name)} WITH SCHEMA extensions;`);
    } else throw new Error(`Unsupported extension: ${ext.name}`);
  }
  for (const item of data.enums) sql.push(`CREATE TYPE ${table(item.name)} AS ENUM (${item.labels.map(literal).join(', ')});`);
  const columns = data.columns.filter(c => c.schema === 'public');
  for (const relation of data.relations) {
    ownerCheck(relation.owner);
    if (typeof relation.rls !== 'boolean' || typeof relation.force_rls !== 'boolean') throw new Error(`Missing RLS fields: ${relation.name}`);
    if (!Object.hasOwn(relation,'acl')) throw new Error(`Missing relation acl: ${relation.name}`);
    if (!['r','v'].includes(relation.kind)) throw new Error(`Unsupported relation kind: ${relation.kind}`);
    if (relation.kind === 'v') {
      if (!data.views.some(v => v.name === relation.name)) throw new Error(`Missing view definition: ${relation.name}`);
      continue;
    }
    const fields = columns.filter(c => c.table === relation.name);
    if (!fields.length) throw new Error(`No columns for ${relation.name}`);
    for (const col of fields) {
      if (col.identity || col.generated) throw new Error(`Unsupported identity/generated column: ${relation.name}.${col.name}`);
      if (col.default?.includes('nextval(')) throw new Error('Sequence metadata required before restoring nextval');
    }
    sql.push(`CREATE TABLE ${table(relation.name)} (${fields.map(c => `${quote(c.name)} ${c.type}${c.not_null ? ' NOT NULL' : ''}`).join(', ')});`);
  }
  // Composite return types now exist; SQL/PLpgSQL references are resolved on use.
  for (const fn of data.functions) {
    ownerCheck(fn.owner);
    if (!Object.hasOwn(fn,'acl')) throw new Error(`Missing function acl: ${fn.name}`);
    if (!fn.definition.startsWith('CREATE OR REPLACE FUNCTION public.')) throw new Error('Function outside public restore scope');
    sql.push(fn.definition.trimEnd() + ';');
  }
  for (const col of columns) {
    if (data.relations.find(r => r.name === col.table)?.kind !== 'r') continue;
    if (col.default !== null) sql.push(`ALTER TABLE ${table(col.table)} ALTER COLUMN ${quote(col.name)} SET DEFAULT ${col.default};`);
  }
  // Keys before FKs, so FK targets are already unique.
  const ordered = [...data.constraints].sort((a,b) => Number(a.kind === 'f') - Number(b.kind === 'f'));
  for (const c of ordered) {
    sql.push(`ALTER TABLE ${table(c.table)} ADD CONSTRAINT ${quote(c.name)} ${c.definition}${!c.validated && !/NOT VALID\s*$/i.test(c.definition) ? ' NOT VALID' : ''};`);
  }
  const backing = new Set(data.constraints.filter(c => ['p','u','x'].includes(c.kind)).map(c => `${c.table}.${c.name}`));
  for (const idx of data.indexes) if (!backing.has(`${idx.table}.${idx.name}`)) sql.push(idx.definition + ';');
  for (const view of data.views) sql.push(`CREATE VIEW ${table(view.name)} AS ${view.definition.replace(/;\s*$/, '')};`);
  for (const trigger of [...data.triggers,...data.auth_public_triggers]) sql.push(trigger.definition + ';');
  for (const policy of data.policies) {
    if (policy.schemaname !== 'public' || !['ALL','SELECT','INSERT','UPDATE','DELETE'].includes(policy.cmd)
      || !['PERMISSIVE','RESTRICTIVE'].includes(policy.permissive)) throw new Error('Unsupported policy');
    const policyRoles = policy.roles.map(r => {
      const role = r.toLowerCase() === 'public' ? 'PUBLIC' : r;
      if (!roles.has(role)) throw new Error(`Unsupported policy role: ${r}`);
      return roleSql(role);
    });
    sql.push(`CREATE POLICY ${quote(policy.policyname)} ON ${table(policy.tablename)} AS ${policy.permissive} FOR ${policy.cmd} TO ${policyRoles.join(', ')}${policy.qual ? ` USING (${policy.qual})` : ''}${policy.with_check ? ` WITH CHECK (${policy.with_check})` : ''};`);
  }
  for (const relation of data.relations) {
    if (relation.kind === 'r') {
      sql.push(`ALTER TABLE ${table(relation.name)} ${relation.rls ? 'ENABLE' : 'DISABLE'} ROW LEVEL SECURITY;`);
      sql.push(`ALTER TABLE ${table(relation.name)} ${relation.force_rls ? 'FORCE' : 'NO FORCE'} ROW LEVEL SECURITY;`);
    }
    sql.push(`ALTER ${relation.kind === 'v' ? 'VIEW' : 'TABLE'} ${table(relation.name)} OWNER TO postgres;`);
    sql.push(`REVOKE ALL ON TABLE ${table(relation.name)} FROM PUBLIC, anon, authenticated, service_role;`);
    // Null relacl = PostgreSQL built-in owner-only defaults, not broad API grants.
    if (relation.acl !== null) sql.push(...grant(relation.acl, `TABLE ${table(relation.name)}`));
    const oid = `${literal(`public.${quote(relation.name)}`)}::regclass`;
    verify(`SELECT relrowsecurity=${relation.rls} AND relforcerowsecurity=${relation.force_rls}
      AND relowner=(SELECT oid FROM pg_roles WHERE rolname='postgres')
      AND pg_temp.acl_signature(coalesce(relacl,acldefault('r',relowner))) = pg_temp.acl_signature(${relation.acl === null ? "acldefault('r',relowner)" : `${literal(relation.acl)}::aclitem[]`})
      FROM pg_class WHERE oid=${oid}`, `Restored RLS/owner/table ACL: ${relation.name}`);
  }
  for (const col of data.column_acls) {
    if (col.acl !== null) sql.push(...grant(col.acl, `TABLE ${table(col.table)}`, ` (${quote(col.column)})`));
    verify(`SELECT pg_temp.acl_signature(coalesce(attacl,'{}'::aclitem[])) = pg_temp.acl_signature(${literal(col.acl ?? '{}')}::aclitem[])
      FROM pg_attribute WHERE attrelid=${literal(`public.${quote(col.table)}`)}::regclass AND attname=${literal(col.column)}`,
    `Restored column ACL: ${col.table}.${col.column}`);
  }
  for (const fn of data.functions) {
    sql.push(`ALTER FUNCTION ${functionId(fn)} OWNER TO postgres;`);
    sql.push(`REVOKE ALL ON FUNCTION ${functionId(fn)} FROM PUBLIC, anon, authenticated, service_role;`);
    if (fn.acl === null) sql.push(`GRANT EXECUTE ON FUNCTION ${functionId(fn)} TO PUBLIC;`);
    else sql.push(...grant(fn.acl, `FUNCTION ${functionId(fn)}`));
    verify(`SELECT p.prosecdef=${/\bSECURITY DEFINER\b/i.test(fn.definition)} AND pg_get_userbyid(p.proowner)='postgres'
      AND pg_temp.acl_signature(coalesce(p.proacl,acldefault('f',p.proowner))) = pg_temp.acl_signature(${fn.acl === null ? "acldefault('f',p.proowner)" : `${literal(fn.acl)}::aclitem[]`})
      FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public'
      AND p.proname=${literal(fn.name)} AND pg_get_function_identity_arguments(p.oid)=${literal(fn.signature)}`,
    `Restored function owner/security/ACL: ${fn.name}(${fn.signature})`);
  }
  for (const item of data.default_acls) {
    if (item.owner !== 'postgres') {
      deviations.push(`Default ACL for ${item.owner}/${item.kind} not installed: no object is created as that cluster role.`);
      continue;
    }
    if (item.schema !== 'public') throw new Error('Default ACL outside public');
    const kind = { r: 'TABLES', S: 'SEQUENCES', f: 'FUNCTIONS' }[item.kind];
    if (!kind) throw new Error('Unsupported default ACL kind');
    for (const a of parseAcl(item.acl)) sql.push(`ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ${a.privilege} ON ${kind} TO ${roleSql(a.role)}${a.grantOption ? ' WITH GRANT OPTION' : ''};`);
  }
  for (const item of data.role_capabilities) sql.push(`INSERT INTO public.role_capabilities(role,capability) VALUES (${literal(item.role)}, ${literal(item.capability)});`);
  sql.push('SET check_function_bodies = on;');
  verify(`SELECT count(*)=${data.column_acls.filter(c => c.acl !== null).length} FROM pg_attribute a
    JOIN pg_class c ON c.oid=a.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND a.attnum>0 AND NOT a.attisdropped AND a.attacl IS NOT NULL`, 'No extra column ACLs');
  verify(`SELECT count(*)=${data.constraints.length} FROM pg_constraint WHERE connamespace='public'::regnamespace`, 'Restored constraint count');
  for (const c of data.constraints) verify(`SELECT convalidated=${c.validated} AND pg_get_constraintdef(oid,true)=${literal(c.definition + (!c.validated && !/NOT VALID\s*$/i.test(c.definition) ? ' NOT VALID' : ''))}
    FROM pg_constraint WHERE conrelid=${literal(`public.${quote(c.table)}`)}::regclass AND conname=${literal(c.name)}`,
  `Restored constraint: ${c.table}.${c.name}`);
  verification.push('ROLLBACK;');
  return { sql: sql.join('\n') + '\n', verificationSql: verification.join('\n') + '\n', deviations, summary: {
    capturedAt: data.captured_at, relations: data.relations.length, functions: data.functions.length,
    constraints: data.constraints.length, policies: data.policies.length, columnAcls: data.column_acls.length,
    capabilitySeedRows: data.role_capabilities.length,
  } };
}
