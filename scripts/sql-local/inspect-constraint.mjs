import { readFileSync } from 'node:fs';
import { PG_BIN, target, connectionArgs, runChecked } from './harness.mjs';

const [database, catalogPath, name] = process.argv.slice(2);
if (!/^[a-z0-9_]+$/.test(name ?? '')) throw new Error('Simple constraint name required');
const data = JSON.parse(readFileSync(catalogPath, 'utf8'));
console.log(JSON.stringify(data.constraints.filter(c => c.name === name)));
console.log(runChecked(`${PG_BIN}/psql.exe`, connectionArgs(target({ database })), undefined, {
  input: `SELECT conname, pg_get_constraintdef(oid), convalidated FROM pg_constraint WHERE conname='${name}';`,
}));
