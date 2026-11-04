import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
const html = readFileSync(new URL('./edition-analysis-prototype.html', import.meta.url), 'utf8');
function open(scene = 'history') {
  const dom = new JSDOM(html, { runScripts: 'dangerously', url: `http://localhost/?scene=${scene}`,
    beforeParse(window) { window.HTMLDialogElement.prototype.showModal = function () { this.open = true; }; window.HTMLDialogElement.prototype.close = function () { this.open = false; this.dispatchEvent(new window.Event('close')); }; } });
  const d = dom.window.document;
  const choose = (id, value) => { const el = d.getElementById(id); el.value = value; el.dispatchEvent(new dom.window.Event('change')); };
  return { dom, d, choose };
}
test('percentile history uses separate editions, accessible underlying data and no raw-score bridge', () => {
  const { d } = open();
  assert.match(d.body.textContent, /Demonstração/);
  assert.equal(d.querySelectorAll('[data-edition-chart]').length, 2);
  assert.match(d.querySelector('table').textContent, /População/);
  assert.match(d.querySelector('table').textContent, /Top 38%/);
  assert.match(d.body.textContent, /Menor Top X% indica melhor posição/);
  assert.doesNotMatch(d.querySelector('#scene-root').textContent, /média de notas entre edições|nota TRI|meta de 50/);
});
test('ranking unconfigured has no invented policy or candidates', () => {
  const { d, choose } = open('ranking');
  choose('demo-state', 'unconfigured');
  assert.match(d.querySelector('#scene-root').textContent, /ainda não configurado/);
  assert.equal(d.querySelectorAll('[data-candidate]').length, 0);
  assert.doesNotMatch(d.querySelector('#scene-root').textContent, /3 melhores/);
});
test('ranking ready masks identities and explains actual counted participation', () => {
  const { d } = open('ranking');
  assert.match(d.body.textContent, /3 melhores/);
  assert.match(d.body.textContent, /mínimo de 2/);
  assert.match(d.querySelector('[data-candidate]').textContent, /Candidato #1/);
  assert.match(d.body.textContent, /Você/);
  assert.match(d.body.textContent, /apenas dentro desta edição/);
});
test('cutoff history keeps sources separate, rejects a trend and opens a bounded dialog', () => {
  const { d, dom } = open('cutoffs');
  d.getElementById('open-cutoff').click();
  assert.equal(d.querySelector('dialog').open, true);
  assert.match(d.querySelector('dialog').textContent, /não são comparáveis/);
  assert.equal(d.querySelectorAll('[data-cutoff-source]').length, 2);
  assert.match(d.body.textContent, /Origem não confirmada/);
  d.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape' }));
  assert.equal(d.querySelector('dialog').open, false);
});
test('question bank preserves version context and explicit draft reuse, with lock error', () => {
  const { d, choose } = open('bank');
  assert.match(d.body.textContent, /Foto do legado/);
  assert.match(d.body.textContent, /Não comprova a versão exibida durante a prova/);
  d.getElementById('reuse-version').click();
  assert.equal(d.querySelector('dialog').open, true);
  assert.match(d.querySelector('dialog').textContent, /Reusar versão 2 em rascunho/);
  choose('demo-state', 'locked');
  assert.match(d.querySelector('dialog').textContent, /Atualize os rascunhos e tente novamente/);
  assert.equal(d.querySelector('[data-write-retry]'), null);
});
test('loading, retry and empty states remain explicit across all four scenes', () => {
  for (const scene of ['history', 'ranking', 'cutoffs', 'bank']) {
    const { d, choose } = open(scene);
    choose('demo-state', 'loading'); assert.ok(d.querySelector('[role="status"]'));
    choose('demo-state', 'error'); assert.match(d.body.textContent, /Tentar novamente/);
    choose('demo-state', 'empty'); assert.ok(d.querySelector('[data-empty]'));
  }
});
