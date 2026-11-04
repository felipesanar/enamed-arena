import { describe, expect, it, vi } from 'vitest';
import { canonicalRows, executeImport } from './import';

const legacy = { numero: 1, texto: 'Texto', area: 'Pediatria', alternativa_a: 'a', alternativa_b: 'b', alternativa_c: 'c', alternativa_d: 'd', correta: 'B' };
describe('atomic edge orchestration', () => {
  it('does not coerce malformed canonical fields into valid-looking content', () => {
    const row = { question_number: '1', text: {}, area: 'PED', options: null };
    expect(canonicalRows([row])[0]).toMatchObject(row);
  });
  it('converts legacy rows, image slots and extra options without changing source', () => {
    const source = { ...legacy, alternativa_e: 'e' };
    const before = JSON.stringify(source);
    const rows = canonicalRows([source], { 1: { enunciado_url: 'first', enunciado2_url: 'second', comentario_url: 'comment' } });
    expect(rows[0].options).toHaveLength(5);
    expect(rows[0]).toMatchObject({ image_url: 'first', image_url_2: 'second', explanation_image_url: 'comment' });
    expect(JSON.stringify(source)).toBe(before);
  });
  it('validates before storage and does not commit an invalid batch', async () => {
    const upload = vi.fn(); const commit = vi.fn();
    const result = await executeImport(canonicalRows([legacy]), {}, {
      validate: async () => ({ ok: false, imported: 0, errors: [{ row: 1, field: 'area', message: 'Invalid' }] }),
      commit, upload, remove: vi.fn(),
    });
    expect(result.ok).toBe(false); expect(upload).not.toHaveBeenCalled(); expect(commit).not.toHaveBeenCalled();
  });
  it('commits once and removes only newly uploaded exact paths after a known rejection', async () => {
    const remove = vi.fn(); const commit = vi.fn().mockResolvedValue({ ok: false, imported: 0, errors: [] });
    await executeImport(canonicalRows([legacy]), { 1: { enunciado2: { data: 'AA==', mime: 'image/png' } } }, {
      validate: async () => ({ ok: true, imported: 0, errors: [] }), commit,
      upload: async () => ({ path: 'batch/new.png', url: 'new-url' }), remove,
    });
    expect(commit).toHaveBeenCalledTimes(1);
    expect(commit.mock.calls[0][0][0].image_url_2).toBe('new-url');
    expect(remove).toHaveBeenCalledWith(['batch/new.png']);
  });
  it('does not delete images on uncertain commit transport failure', async () => {
    const remove = vi.fn();
    await expect(executeImport(canonicalRows([legacy]), { 1: { enunciado: { data: 'AA==', mime: 'image/png' } } }, {
      validate: async () => ({ ok: true, imported: 0, errors: [] }), commit: async () => { throw new Error('timeout'); },
      upload: async () => ({ path: 'new', url: 'url' }), remove,
    })).rejects.toThrow('timeout');
    expect(remove).not.toHaveBeenCalled();
  });
});
