import { readFileSync } from 'node:fs';
import { resolve, dirname, relative, isAbsolute, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PG_BIN, target, runChecked } from './harness.mjs';

const runs = resolve(dirname(fileURLToPath(import.meta.url)), 'runs');
const reportPath = resolve(process.argv[2] ?? '');
const within = relative(runs, reportPath);
if (!within || within.startsWith('..') || isAbsolute(within) || process.argv.length !== 3) {
  throw new Error('Pass one existing scripts/sql-local/runs/<runId>/report.json');
}
const report = JSON.parse(readFileSync(reportPath, 'utf8'));
const maintenance = target(report.endpoint);
if (!/^\d{17}_\d+$/.test(report.runId)) throw new Error('Invalid run identifier');
for (const db of report.databases) {
  target({ database: db });
  if (![ `enamed_test_sqlqa_${report.runId}_t6`, `enamed_test_sqlqa_${report.runId}_replay`, `enamed_test_sqlqa_${report.runId}_catalog` ].includes(db)) {
    throw new Error('Database does not belong to this harness run');
  }
}
for (const db of report.databases) {
  runChecked(join(PG_BIN, 'dropdb.exe'), ['-w', '-h', maintenance.host, '-p', String(maintenance.port),
    '-U', maintenance.user, `--maintenance-db=${maintenance.database}`, '--if-exists', db]);
  console.log(`Dropped ${db}`);
}
// Never remove directories, files, junctions or the maintenance database.
