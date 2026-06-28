import { describe, it, expect } from 'vitest';
import {
  parseFindings,
  buildContents,
  filterFindings,
  hasViewDirective,
  hasImageReference,
  type Finding,
  type QInput,
} from '../../../supabase/functions/admin-verify-questions/verifyHelpers';

const img = (slot: 'enunciado' | 'enunciado2' | 'comentario') => ({ slot, mime: 'image/png', base64: 'AAAA' });
const q = (over: Partial<QInput>): QInput => ({
  question_number: 1, enunciado_text: '', comentario_text: '', images: [], ...over,
});
const finding = (over: Partial<Finding>): Finding => ({
  question_number: 1, source: 'ai', check_type: 'missing_image', severity: 'warning', evidence: '', ...over,
});

describe('parseFindings', () => {
  it('força source=ai e mantém checks válidos', () => {
    const raw = JSON.stringify({ findings: [
      { question_number: 3, check_type: 'image_mismatch', slot: 'enunciado', severity: 'error', evidence: 'RX x ECG' },
    ]});
    const out = parseFindings(raw);
    expect(out).toHaveLength(1);
    expect(out[0].source).toBe('ai');
    expect(out[0].check_type).toBe('image_mismatch');
  });
  it('descarta check_type desconhecido', () => {
    const raw = JSON.stringify({ findings: [
      { question_number: 1, check_type: 'banana', severity: 'error', evidence: 'x' },
    ]});
    expect(parseFindings(raw)).toEqual([]);
  });
  it('json inválido → array vazio', () => {
    expect(parseFindings('not json')).toEqual([]);
  });
});

describe('buildContents', () => {
  it('inclui inline_data para cada imagem', () => {
    const parts = buildContents([
      { question_number: 1, enunciado_text: 'Veja a figura', comentario_text: '', images: [
        { slot: 'enunciado', mime: 'image/jpeg', base64: 'AAAA' },
      ]},
    ]);
    const flat = JSON.stringify(parts);
    expect(flat).toContain('inline_data');
    expect(flat).toContain('AAAA');
    expect(flat).toContain('Q1');
  });
  it('buildContents sem imagens não emite inline_data', () => {
    const parts = buildContents([
      { question_number: 9, enunciado_text: 'Texto sem figura', comentario_text: '', images: [] },
    ]);
    const flat = JSON.stringify(parts);
    expect(flat).toContain('nenhuma');
    expect(flat).not.toContain('inline_data');
  });
  it('inclui ALTERNATIVAS e GABARITO no contexto enviado', () => {
    const parts = buildContents([
      { question_number: 7, enunciado_text: 'Caso clínico', comentario_text: '',
        alternativas: [{ label: 'A', text: 'Cardiotocografia' }, { label: 'B', text: 'Cesárea' }],
        gabarito: 'B', images: [] },
    ]);
    const flat = JSON.stringify(parts);
    expect(flat).toContain('ALTERNATIVAS');
    expect(flat).toContain('A) Cardiotocografia');
    expect(flat).toContain('GABARITO: B');
  });
});

describe('parseFindings source override', () => {
  it('parseFindings força source=ai mesmo se o modelo mandar outro source', () => {
    const raw = JSON.stringify({ findings: [
      { question_number: 1, source: 'human', check_type: 'orphan_image', severity: 'warning', evidence: 'x' },
    ]});
    expect(parseFindings(raw)[0].source).toBe('ai');
  });
});

describe('hasViewDirective / hasImageReference', () => {
  it('direcionador explícito conta como "olhe a imagem"', () => {
    expect(hasViewDirective('Foi realizado o eletrocardiograma abaixo.')).toBe(true);
    expect(hasViewDirective('conforme imagem abaixo')).toBe(true);
    expect(hasViewDirective('realizada ressonância magnética abaixo:')).toBe(true);
    expect(hasViewDirective('ultrassom abdominal, mostrado a seguir:')).toBe(true);
    expect(hasViewDirective('encontra-se lesões abaixo:')).toBe(true);
    expect(hasViewDirective('observe a fundoscopia')).toBe(true);
  });
  it('laudo descrito por extenso NÃO é direcionador', () => {
    expect(hasViewDirective('A radiografia de tórax evidenciou infiltrado heterogêneo')).toBe(false);
    expect(hasViewDirective('A tomografia de abdome mostra dilatação de alças')).toBe(false);
    expect(hasViewDirective('Radiografia simples demonstra alça em grão de café')).toBe(false);
    expect(hasViewDirective('solicitar radiografia de ossos longos')).toBe(false);
  });
  it('rótulo de exame conta como referência (não-órfã), mesmo sem direcionador', () => {
    expect(hasImageReference('Exames laboratoriais:')).toBe(true);
    expect(hasImageReference('De acordo com a tabela normativa de pressão arterial')).toBe(true);
    expect(hasImageReference('Ao exame pupilar bilateral:')).toBe(true);
    expect(hasViewDirective('Exames laboratoriais:')).toBe(false);
  });
});

describe('filterFindings — elimina falsos positivos estruturais', () => {
  it('missing_image: descarta laudo descrito por extenso sem imagem (Q64/Q71/Q22)', () => {
    const f = [finding({ check_type: 'missing_image', slot: 'enunciado' })];
    expect(filterFindings(f, q({ enunciado_text: 'A radiografia evidenciou infiltrado em lobo superior.' }))).toEqual([]);
  });

  it('missing_image: descarta especulação "poderia se beneficiar" (Q50/Q52-56)', () => {
    const f = [finding({ check_type: 'missing_image', slot: 'enunciado' })];
    expect(filterFindings(f, q({ enunciado_text: 'Caso clínico de dor abdominal súbita, sem qualquer figura.' }))).toEqual([]);
  });

  it('missing_image: descarta quando o slot JÁ tem imagem (Q68 — slot rotulado errado)', () => {
    const f = [finding({ check_type: 'missing_image', slot: 'enunciado' })];
    expect(filterFindings(f, q({ enunciado_text: 'veja a imagem abaixo', images: [img('enunciado')] }))).toEqual([]);
  });

  it('missing_image: MANTÉM quando o texto manda olhar e não há imagem', () => {
    const f = [finding({ check_type: 'missing_image', slot: 'enunciado' })];
    const out = filterFindings(f, q({ enunciado_text: 'Observe a radiografia abaixo.' }));
    expect(out).toHaveLength(1);
  });

  it('missing_image: "abaixo" sozinho (= alternativas) NÃO conta como direcionador (Q43/Q98)', () => {
    const f = [finding({ check_type: 'missing_image', slot: 'enunciado' })];
    expect(filterFindings(f, q({ enunciado_text: 'Qual das condutas abaixo está mais alinhada aos protocolos?' }))).toEqual([]);
    expect(filterFindings(f, q({ enunciado_text: 'Dentre as características abaixo, são princípios...' }))).toEqual([]);
    expect(filterFindings(f, q({ enunciado_text: 'Considere os três casos a seguir:' }))).toEqual([]);
  });

  it('missing_image: termo de figura + "abaixo" (ex.: CTG) MANTÉM (Q62)', () => {
    const f = [finding({ check_type: 'missing_image', slot: 'enunciado' })];
    expect(filterFindings(f, q({ enunciado_text: 'É submetida à cardiotocografia apresentada abaixo.' }))).toHaveLength(1);
  });

  it('missing_image (comentário): usa o texto do comentário, não o enunciado (Q1/Q15/Q20)', () => {
    const f = [finding({ check_type: 'missing_image', slot: 'comentario' })];
    expect(filterFindings(f, q({
      enunciado_text: 'observe a figura abaixo',
      comentario_text: 'solicitar radiografia de ossos longos conforme fluxograma',
    }))).toEqual([]);
  });

  it('orphan_image: descarta quando NÃO há imagem no slot (Q79-82)', () => {
    const f = [finding({ check_type: 'orphan_image', slot: 'enunciado' })];
    expect(filterFindings(f, q({ enunciado_text: 'Texto sem imagem alguma.' }))).toEqual([]);
  });

  it('orphan_image: descarta quando imagem é referenciada por rótulo de exame (Q6/Q17/Q24/Q40)', () => {
    const f = [finding({ check_type: 'orphan_image', slot: 'enunciado' })];
    expect(filterFindings(f, q({ enunciado_text: 'Exames laboratoriais:', images: [img('enunciado')] }))).toEqual([]);
  });

  it('orphan_image: MANTÉM quando há imagem e nenhuma referência no texto', () => {
    const f = [finding({ check_type: 'orphan_image', slot: 'enunciado' })];
    const out = filterFindings(f, q({ enunciado_text: 'Paciente comparece para conduta clínica.', images: [img('enunciado')] }));
    expect(out).toHaveLength(1);
  });

  it('image_mismatch: descarta sem imagem, mantém com imagem (Q94)', () => {
    const fNoImg = [finding({ check_type: 'image_mismatch', slot: 'enunciado' })];
    expect(filterFindings(fNoImg, q({ enunciado_text: 'qualquer' }))).toEqual([]);
    const fImg = [finding({ check_type: 'image_mismatch', slot: 'enunciado' })];
    expect(filterFindings(fImg, q({ enunciado_text: 'qualquer', images: [img('enunciado')] }))).toHaveLength(1);
  });

  it('illegible_image: só vale com imagem anexada', () => {
    const f = [finding({ check_type: 'illegible_image', slot: 'comentario' })];
    expect(filterFindings(f, q({ images: [] }))).toEqual([]);
    expect(filterFindings(f, q({ images: [img('comentario')] }))).toHaveLength(1);
  });

  it('finding sem slot assume enunciado', () => {
    const f = [finding({ check_type: 'orphan_image', slot: undefined })];
    expect(filterFindings(f, q({ enunciado_text: 'sem referência', images: [img('enunciado')] }))).toHaveLength(1);
  });
});
