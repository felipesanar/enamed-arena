import { resolve, dirname, relative, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PG_BIN, target, connectionArgs, runChecked } from './harness.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const [database, file] = process.argv.slice(2);
const allowed = resolve(root, 'supabase/tests/local');
const path = resolve(root, file ?? '');
const inside = relative(allowed, path);
if (!inside || inside.startsWith('..') || isAbsolute(inside) || !path.endsWith('.sql')) {
  throw new Error('Only scoped local SQL files are accepted');
}
console.log(runChecked(`${PG_BIN}/psql.exe`, [...connectionArgs(target({ database })),
  '-f', resolve(allowed, 'guard.sql'), '-f', path]));
