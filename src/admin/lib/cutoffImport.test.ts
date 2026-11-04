import { describe, expect, it } from 'vitest';
import { validateCutoffRows, cutoffKey, parseCutoffFile } from './cutoffImport';
import JSZip from 'jszip';

const catalog = { institutions: [{ id: 'i', name: 'Hospital São José' }], specialties: [{ id: 's', name: 'Clínica Médica' }] };
const row = { instituicao: ' hospital sao jose ', especialidade: 'CLINICA MEDICA', cenario: ' Campus ', ampla: '720,5', cotas: '', vagas: '' };
describe('cutoff batch preflight', () => {
  it('rejects normalized CSV header collisions rather than choosing a value', async () => {
    const text = 'Instituição;instituicao;Ampla;ampla\nHospital;Outro;700;800';
    const file = { name: 'cortes.csv', arrayBuffer: async () => new TextEncoder().encode(text).buffer } as File;
    await expect(parseCutoffFile(file)).rejects.toThrow(/Cabeçalhos.*ambíguos/);
    expect(validateCutoffRows([{ ...row, Instituição: 'Outro' }], catalog).errors[0].field).toBe('headers');
  });
  it('rejects normalized and identical XLSX header collisions before parsing row objects', async () => {
    for (const duplicate of ['ampla', 'Ampla']) {
      const zip = new JSZip();
      zip.file('xl/worksheets/sheet1.xml', `<worksheet><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>Ampla</t></is></c><c r="B1" t="inlineStr"><is><t>${duplicate}</t></is></c></row><row r="2"><c r="A2"><v>700</v></c><c r="B2"><v>800</v></c></row></sheetData></worksheet>`);
      const file = { name: 'cortes.xlsx', arrayBuffer: () => zip.generateAsync({ type: 'arraybuffer' }) } as File;
      await expect(parseCutoffFile(file)).rejects.toThrow(/Cabeçalhos.*ambíguos/);
    }
  });
  it('retains physical CSV lines across blank and multiline records', async () => {
    const text = 'instituicao;especialidade;ampla\n\n"Hospital\nCentral";Clinica;700\nHospital;Clinica;710';
    const file = { name: 'cortes.csv', arrayBuffer: async () => new TextEncoder().encode(text).buffer } as File;
    const rows = await parseCutoffFile(file);
    expect(rows.map(r => r.__source_line)).toEqual(['3', '5']);
  });
  it('retains original worksheet name and sparse row numbers from XLSX', async () => {
    const zip = new JSZip();
    zip.file('xl/workbook.xml', '<workbook xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Cortes teste" r:id="r1"/></sheets></workbook>');
    zip.file('xl/_rels/workbook.xml.rels', '<Relationships><Relationship Id="r1" Target="worksheets/sheet2.xml"/></Relationships>');
    zip.file('xl/worksheets/sheet2.xml', '<worksheet><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>instituicao</t></is></c></row><row r="8"><c r="A8" t="inlineStr"><is><t>Hospital</t></is></c></row></sheetData></worksheet>');
    const file = { name: 'cortes.xlsx', arrayBuffer: () => zip.generateAsync({ type: 'arraybuffer' }) } as File;
    expect((await parseCutoffFile(file))[0]).toMatchObject({ __source_line: '8', __source_sheet: 'Cortes teste' });
  });
  it('resolves exact normalized names and permits scores above 100, optional quota/seats', () => {
    const result = validateCutoffRows([row], catalog);
    expect(result.errors).toEqual([]);
    expect(result.rows[0]).toMatchObject({ institution_id: 'i', specialty_id: 's', practice_scenario: 'Campus', cutoff_score_general: 720.5, cutoff_score_quota: null, vagas: 0 });
  });
  it('never chooses an ambiguous or approximate match', () => {
    expect(validateCutoffRows([row], { ...catalog, institutions: [...catalog.institutions, { id: 'other', name: 'Hospital Sao Jose' }] }).errors[0].message).toMatch(/ambígua/);
    expect(validateCutoffRows([{ ...row, instituicao: 'Hospital São' }], catalog).errors[0].message).toMatch(/encontrada/);
  });
  it.each(['NaN', 'Infinity', '', 'abc'])('rejects non-finite/missing general %s', ampla => {
    expect(validateCutoffRows([{ ...row, ampla }], catalog).errors).not.toHaveLength(0);
  });
  it.each(['-1', '1.5', 'Infinity'])('rejects invalid seats %s', vagas => {
    expect(validateCutoffRows([{ ...row, vagas }], catalog).errors).not.toHaveLength(0);
  });
  it('blocks duplicate keys, existing keys and empty batches', () => {
    expect(validateCutoffRows([row, { ...row, cenario: 'campus' }], catalog).errors).toHaveLength(1);
    expect(validateCutoffRows([row], catalog, new Set([cutoffKey('i', 's', 'campus')])).errors[0].message).toMatch(/existe/);
    expect(validateCutoffRows([], catalog).errors[0].row).toBe(0);
  });
});
