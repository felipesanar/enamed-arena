/**
 * Contrato de `action` entre `presencialApi` e a Edge Function `presencial`.
 *
 * A function roteia por uma string literal (`checkin | claim | start-unlinked
 * | submit`) validada contra `VALID_ACTIONS` em
 * `supabase/functions/presencial/index.ts`. Os testes de `presencialApi`
 * mockam `supabase.functions.invoke`, então passam com qualquer string —
 * inclusive uma grafia errada (ex.: `start_unlinked` com underscore) que
 * quebraria o fluxo inteiro em silêncio (a function responderia 400 e o
 * teste mockado nunca perceberia).
 *
 * Este teste lê os dois arquivos-fonte do repo (nenhum mock) e garante que
 * toda `action` que o serviço envia está de fato em `VALID_ACTIONS` do lado
 * do servidor — pegando divergência de string em tempo de teste, não em
 * produção.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const presencialApiSource = readFileSync(
  resolve(__dirname, './presencialApi.ts'),
  'utf-8',
);
const edgeFunctionSource = readFileSync(
  resolve(__dirname, '../../supabase/functions/presencial/index.ts'),
  'utf-8',
);

/** Extrai as actions que `invokePresencial(action, ...)` envia no serviço. */
function extractServiceActions(source: string): string[] {
  const matches = [...source.matchAll(/invokePresencial(?:<[^>]*>)?\(\s*['"]([\w-]+)['"]/g)];
  return matches.map((m) => m[1]);
}

/** Extrai o conjunto `VALID_ACTIONS` declarado na Edge Function. */
function extractValidActions(source: string): Set<string> {
  const setMatch = source.match(/VALID_ACTIONS\s*=\s*new Set\(\[([^\]]+)\]\)/);
  if (!setMatch) {
    throw new Error('Não encontrei a declaração de VALID_ACTIONS em index.ts — o teste ficou cego.');
  }
  const items = [...setMatch[1].matchAll(/['"]([\w-]+)['"]/g)].map((m) => m[1]);
  return new Set(items);
}

describe('contrato de action entre presencialApi e a Edge Function presencial', () => {
  const serviceActions = extractServiceActions(presencialApiSource);
  const validActions = extractValidActions(edgeFunctionSource);

  it('encontrou pelo menos uma action no serviço (sanity check do extrator)', () => {
    expect(serviceActions.length).toBeGreaterThan(0);
  });

  it('encontrou pelo menos uma action válida na function (sanity check do extrator)', () => {
    expect(validActions.size).toBeGreaterThan(0);
  });

  it.each(Array.from(new Set(serviceActions)))(
    'action "%s" enviada pelo serviço está em VALID_ACTIONS da function',
    (action) => {
      expect(validActions.has(action)).toBe(true);
    },
  );
});
