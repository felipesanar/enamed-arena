import { parseImportCsv } from '@/admin/lib/validateQuestions';
import { parseXlsxFirstWorksheetRows } from '@/admin/utils/xlsxTextParser';
import JSZip from 'jszip';
import type { CanonicalCutoffName, CutoffCatalog, CutoffIssue, CutoffPreview } from '@/types/admin-operations';

const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().replace(/\s+/g, ' ').toLocaleLowerCase('pt-BR');
export const cutoffKey = (institution: string, specialty: string, scenario: string) => JSON.stringify([institution, specialty, scenario.trim().toLowerCase()]);

function assertHeaders(headers: string[]) {
  const normalized = headers.map(normalize);
  if (new Set(normalized).size !== normalized.length) throw new Error('Cabeçalhos ambíguos após normalização. Corrija as colunas repetidas.');
  if (normalized.some(header => header.startsWith('__source_'))) throw new Error('Cabeçalhos reservados para identificação da origem. Renomeie as colunas __source_.');
}

export async function parseCutoffFile(file: File): Promise<Record<string, string>[]> {
  const buffer = await file.arrayBuffer();
  if (/\.csv$/i.test(file.name)) {
    const text = new TextDecoder().decode(buffer).replace(/^\uFEFF/, '');
    const rows = parseImportCsv(text);
    const delimiter = text.split(/\r?\n/, 1)[0].includes(';') ? ';' : ',';
    const starts: number[] = [];
    let line = 1, start = 1, quoted = false, cell = '', values: string[] = [], header = true;
    // Track source locations separately; values are still parsed by the shared CSV parser.
    for (let i = 0; i <= text.length; i++) {
      const char = text[i];
      if (char === '"') {
        if (quoted && text[i + 1] === '"') { cell += '"'; i++; } else quoted = !quoted;
      } else if (i === text.length || (!quoted && (char === delimiter || char === '\r' || char === '\n'))) {
        values.push(cell); cell = '';
        if (char !== delimiter) {
          if (header) { assertHeaders(values); header = false; }
          else if (values.some(value => value.trim())) starts.push(start);
          values = [];
          if (char === '\r' && text[i + 1] === '\n') i++;
          if (i < text.length) line++;
          start = line;
        }
      } else {
        cell += char;
        if (char === '\n' || (char === '\r' && text[i + 1] !== '\n')) line++;
      }
    }
    return rows.map((row, index) => ({ ...row, __source_line: String(starts[index]), __source_sheet: 'CSV' }));
  }
  if (/\.xlsx$/i.test(file.name)) {
    const rows = await parseXlsxFirstWorksheetRows(buffer);
    const zip = await JSZip.loadAsync(buffer);
    const elements = (xml: string, name: string) => Array.from(new DOMParser().parseFromString(xml, 'application/xml').querySelectorAll('*')).filter(node => node.localName === name);
    const workbook = await zip.file('xl/workbook.xml')?.async('text');
    const relations = await zip.file('xl/_rels/workbook.xml.rels')?.async('text');
    const first = workbook ? elements(workbook, 'sheet')[0] : null;
    const id = first?.getAttribute('r:id') ?? first?.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id');
    const target = relations && id ? elements(relations, 'Relationship').find(node => node.getAttribute('Id') === id)?.getAttribute('Target') : null;
    const path = target ? `xl/${target.replace(/^\/+/, '').replace(/^xl\//, '').replace(/^\.\.\//, '')}` : 'xl/worksheets/sheet1.xml';
    const worksheet = await zip.file(path)?.async('text');
    const worksheetRows = worksheet ? elements(worksheet, 'row') : [];
    const sharedXml = await zip.file('xl/sharedStrings.xml')?.async('text');
    const shared = sharedXml ? elements(sharedXml, 'si').map(node => Array.from(node.querySelectorAll('*')).filter(child => child.localName === 't').map(child => child.textContent ?? '').join('')) : [];
    const headers = Array.from(worksheetRows[0]?.children ?? []).filter(node => node.localName === 'c').map(cell => {
      const children = Array.from(cell.querySelectorAll('*'));
      const value = children.find(node => node.localName === 'v')?.textContent ?? '';
      return cell.getAttribute('t') === 's' ? shared[Number(value)] ?? '' : children.filter(node => node.localName === 't').map(node => node.textContent ?? '').join('') || value;
    });
    assertHeaders(headers);
    const locations = worksheetRows.slice(1).map(row => {
      const line = row.getAttribute('r');
      if (!line) throw new Error('Não foi possível identificar as linhas da aba. Revise e envie novamente.');
      return line;
    });
    if (locations.length !== rows.length) throw new Error('Não foi possível identificar as linhas da aba. Revise e envie novamente.');
    return rows.map((row, index) => ({ ...row, __source_line: locations[index], __source_sheet: first?.getAttribute('name') || 'Primeira aba' }));
  }
  throw new Error('Envie um arquivo CSV ou XLSX.');
}

export function cutoffRowLabel(raw: Record<string, string>[], row: number): string {
  const record = raw[row - 1];
  return record?.__source_line ? `${record.__source_sheet} · linha ${record.__source_line}` : `Registro ${row}`;
}

export function validateCutoffRows(raw: Record<string, string>[], catalog: CutoffCatalog, existing = new Set<string>()): CutoffPreview {
  const errors: CutoffIssue[] = [];
  const seen = new Set<string>();
  try { raw.forEach(row => assertHeaders(Object.keys(row).filter(key => !key.startsWith('__source_')))); }
  catch (error) { return { rows: [], errors: [{ row: 0, field: 'headers', message: error instanceof Error ? error.message : 'Cabeçalhos ambíguos.' }] }; }
  if (!raw.length) errors.push({ row: 0, field: 'rows', message: 'O lote está vazio.' });
  const rows = raw.map((original, index) => {
    const record = Object.fromEntries(Object.entries(original).filter(([key]) => !key.startsWith('__source_')).map(([key, value]) => [normalize(key), value.trim()]));
    const add = (field: string, message: string) => errors.push({ row: index + 1, field, message });
    const resolve = (field: string, names: CanonicalCutoffName[]) => {
      const matches = names.filter(item => normalize(item.name) === normalize(record[field] ?? ''));
      if (matches.length !== 1) add(field, matches.length ? 'Correspondência ambígua. Corrija o nome na planilha.' : 'Correspondência não encontrada. Use o nome completo do catálogo.');
      return matches.length === 1 ? matches[0].id : '';
    };
    const number = (field: string, optional = false) => {
      const value = record[field] ?? '';
      if (!value && optional) return null;
      const parsed = Number(value.replace(',', '.'));
      if (!value || !Number.isFinite(parsed)) add(field, 'Informe um número finito.');
      return parsed;
    };
    const institution_id = resolve('instituicao', catalog.institutions);
    const specialty_id = resolve('especialidade', catalog.specialties);
    const practice_scenario = record.cenario ?? '';
    const cutoff_score_general = number('ampla') ?? Number.NaN;
    const cutoff_score_quota = number('cotas', true);
    const vagas = number('vagas', true) ?? 0;
    if (!Number.isInteger(vagas) || vagas < 0) add('vagas', 'Vagas devem ser um inteiro não negativo.');
    const key = cutoffKey(institution_id, specialty_id, practice_scenario);
    if (institution_id && specialty_id) {
      if (seen.has(key)) add('cenario', 'Chave repetida neste lote.');
      if (existing.has(key)) add('cenario', 'Esta referência já existe no banco. Nenhum dado será sobrescrito.');
      seen.add(key);
    }
    return { institution_id, specialty_id, practice_scenario, cutoff_score_general, cutoff_score_quota, vagas };
  });
  return { rows, errors };
}

export function cutoffIssueMessage(issue: CutoffIssue): string {
  const labels: Record<string, string> = { institution_id: 'Instituição', specialty_id: 'Especialidade', practice_scenario: 'Cenário', cutoff_score_general: 'Ampla', cutoff_score_quota: 'Cotas', reference_edition_id: 'Referência', source: 'Fonte', vagas: 'Vagas' };
  const message = issue.message === 'Reference key already exists' ? 'Referência já cadastrada; não foi sobrescrita.'
    : issue.message === 'Duplicate request key' ? 'Chave repetida no lote.'
    : 'O servidor recusou este campo. Corrija a planilha ou confira o catálogo e tente conferir novamente.';
  return `${issue.row ? `Registro ${issue.row}` : 'Lote'} · ${labels[issue.field] ?? 'Validação'}: ${message}`;
}
