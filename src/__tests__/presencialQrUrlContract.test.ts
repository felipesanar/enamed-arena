/**
 * Contrato da URL do QR do presencial — CONGELADO.
 *
 * O QR da sala é impresso e distribuído ANTES da prova. A partir do momento
 * em que ele sai da gráfica, a URL que ele codifica é imutável na prática:
 * mudar a rota, o domínio ou o formato do link transforma cada folha impressa
 * em papel morto, e ninguém descobre isso num code review — descobre com 100
 * alunos numa sala apontando a câmera para um 404.
 *
 * O risco concreto que motivou este teste: ao acrescentar a escolha de caderno
 * (Vermelho / Azul), a tentação natural é botar o caderno na URL
 * (`/presencial/:codigo/:caderno`). Isso invalidaria o QR já impresso. A
 * escolha do caderno é de propósito um passo DENTRO da página, não um segmento
 * de rota.
 *
 * Este teste lê os arquivos-fonte (nenhum mock) e trava as duas pontas: a rota
 * que a aplicação registra e a URL que o admin codifica no QR.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROTA_CONGELADA = '/presencial/:codigo';
const BASE_URL_CONGELADA = 'https://simulados.sanar.com.br/presencial';

const appSource = readFileSync(resolve(__dirname, '../App.tsx'), 'utf-8');
const adminSource = readFileSync(
  resolve(__dirname, '../admin/pages/AdminPresencial.tsx'),
  'utf-8',
);

describe('contrato da URL do QR do presencial', () => {
  it('a rota pública é exatamente /presencial/:codigo', () => {
    expect(appSource).toContain(`path="${ROTA_CONGELADA}"`);
  });

  it('não existe rota de presencial com segmento extra (ex.: /:caderno)', () => {
    const rotasPresencial = [...appSource.matchAll(/path="(\/presencial[^"]*)"/g)].map(
      (m) => m[1],
    );

    // Sanity check do extrator: se ele parar de achar a rota, o teste fica cego.
    expect(rotasPresencial.length).toBeGreaterThan(0);
    expect(rotasPresencial).toEqual([ROTA_CONGELADA]);
  });

  it('o admin monta o QR sobre a base congelada', () => {
    expect(adminSource).toContain(`'${BASE_URL_CONGELADA}'`);
  });

  it('o valor do QR é a base + o código da sala, sem segmento adicional', () => {
    // Aceita `${PRESENCIAL_BASE_URL}/${session.code}` com espaçamento variável,
    // e recusa qualquer coisa depois do código.
    const montagem = /\$\{PRESENCIAL_BASE_URL\}\/\$\{\s*session\.code\s*\}`/;
    expect(adminSource).toMatch(montagem);
  });
});
