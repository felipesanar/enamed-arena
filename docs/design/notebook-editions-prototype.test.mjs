import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const html = readFileSync(new URL('./notebook-editions-prototype.html', import.meta.url), 'utf8');
function open(query = '') {
  const dom = new JSDOM(html, { url: `http://127.0.0.1:54744/?${query}`, runScripts: 'dangerously' });
  return { dom, doc: dom.window.document, change(id, value) {
    const field = dom.window.document.getElementById(id);
    field.value = value; field.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
  } };
}
test('cumulative default includes manual/unknown, real DEMO totals and 50-item page', () => {
  const { doc } = open();
  assert.equal(doc.querySelector('#edition').value, '');
  assert.equal(doc.querySelectorAll('#entries article').length, 50);
  assert.equal(doc.querySelector('#total').textContent, '1500');
  assert.match(doc.querySelector('#scope-note').textContent, /manuais/);
  assert.match(doc.querySelector('#entries').textContent, /Adicionado manualmente/);
  assert.match(doc.querySelector('#entries').textContent, /Edição desconhecida/);
  assert.match(doc.querySelector('#range').textContent, /1–50 de 1500/);
  assert.equal(doc.querySelector('#previous').disabled, true);
  doc.querySelector('#next').click();
  assert.match(doc.querySelector('#range').textContent, /51–100 de 1500/);
});
test('edition, reason, area, literal search and state filter before counts/page; reset offset', () => {
  const { doc, change } = open();
  doc.querySelector('#next').click();
  change('edition', 'demo-b');
  assert.equal(doc.querySelector('#total').textContent, '700');
  assert.match(doc.querySelector('#range').textContent, /1–50 de 700/);
  assert.doesNotMatch(doc.querySelector('#entries').textContent, /Adicionado manualmente|Edição desconhecida/);
  assert.match(doc.querySelector('#export').getAttribute('aria-label'), /DEMO B/);
  change('reason', 'did_not_know');
  assert.equal(doc.querySelector('#reason').value, 'did_not_know');
  assert.equal(doc.querySelector('#total').textContent, '350');
  change('area', 'Clínica médica');
  assert.equal(doc.querySelector('#total').textContent, '350');
  change('search', 'sem resultado');
  assert.equal(doc.querySelector('#total').textContent, '0');
  assert.match(doc.querySelector('#message').textContent, /Nenhuma entrada com esses filtros/);
  doc.querySelector('#clear').click();
  change('state', 'mastered');
  assert.equal(doc.querySelector('#total').textContent, doc.querySelector('#mastered').textContent);
  change('state', 'all'); change('search', '50%_');
  assert.equal(doc.querySelector('#total').textContent, '1');
});
test('all states have textual feedback and error retries without resetting filters', () => {
  for (const [state, text] of Object.entries({ loading: 'Carregando', empty: 'Seu caderno começa', error: 'Não foi possível', filterempty: 'Nenhuma entrada', exportloading: 'Preparando', success: 'entradas' })) {
    const { doc } = open(`state=${state}`);
    assert.match(doc.body.textContent, new RegExp(text));
    assert.equal(doc.querySelector('#export').disabled, ['loading', 'empty', 'error', 'filterempty', 'exportloading'].includes(state));
    if (state === 'error') {
      doc.querySelector('#retry').click();
      assert.equal(doc.querySelectorAll('#entries article').length, 50);
    }
  }
});
test('controls have visible labels, no remote resources, reduced motion and explicit unknown dates', () => {
  const { doc } = open('theme=dark');
  for (const field of doc.querySelectorAll('select,input')) assert.ok(doc.querySelector(`label[for="${field.id}"]`));
  assert.equal(doc.documentElement.dataset.theme, 'dark');
  assert.match(html, /prefers-reduced-motion/);
  assert.match(html, /:focus-visible/);
  assert.match(html, /Plus Jakarta Sans/);
  assert.match(doc.body.textContent, /Aguardando divulgação do Inep/);
  assert.match(doc.body.textContent, /DEMO.*fictícios/);
  assert.equal(doc.querySelectorAll('[src^="http"],[href^="http"]').length, 0);
});
