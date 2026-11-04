import { readFile } from 'node:fs/promises';
import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM, ResourceLoader, VirtualConsole } from 'jsdom';

const htmlURL = new URL('./admin-operations-prototype.html', import.meta.url);
async function open(t) {
  const requests = [], errors = [];
  class Offline extends ResourceLoader {
    fetch(url) { requests.push(url); return null; }
  }
  const console = new VirtualConsole();
  console.on('jsdomError', error => errors.push(error.message));
  const dom = new JSDOM(await readFile(htmlURL, 'utf8'), {
    url: 'file:///admin-operations-prototype.html', runScripts: 'dangerously',
    resources: new Offline(), virtualConsole: console,
    beforeParse(w) {
      for (const method of ['fetch', 'XMLHttpRequest', 'WebSocket', 'EventSource']) {
        w[method] = function () { requests.push(method); throw Error('Network forbidden'); };
      }
      w.HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
      w.HTMLDialogElement.prototype.close = function () {
        this.removeAttribute('open'); this.dispatchEvent(new w.Event('close'));
      };
    },
  });
  t.after(() => dom.window.close());
  const d = dom.window.document;
  const get = id => { const el = d.getElementById(id); assert.ok(el, id); return el; };
  const change = (id, value) => {
    get(id).value = value;
    get(id).dispatchEvent(new dom.window.Event('change', { bubbles: true }));
    get(id).dispatchEvent(new dom.window.Event('input', { bubbles: true }));
  };
  return { dom, d, get, change, requests, errors, click: id => get(id).click(),
    submit: id => get(id).dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true })) };
}
const settle = () => new Promise(resolve => setTimeout(resolve, 500));
function prepare(ui, batch = 'valid') {
  ui.change('edition', 'demo-edition'); ui.change('reference', 'demo-reference');
  ui.change('source', 'DEMO — arquivo editorial fictício');
  ui.change('batch', batch); ui.click('load-batch'); ui.submit('import-form');
}

test('explicit context is mandatory and focuses first invalid field', async t => {
  const ui = await open(t); ui.submit('import-form');
  assert.equal(ui.d.activeElement.id, 'edition');
  assert.equal(ui.get('edition').getAttribute('aria-invalid'), 'true');
  assert.equal(ui.get('confirm-import').disabled, true);
});

test('invalid row refuses the whole batch with zero imports; correction revalidates', async t => {
  const ui = await open(t); prepare(ui, 'invalid');
  assert.match(ui.get('preview').textContent, /Linha 2.*instituição.*ambígua/is);
  assert.match(ui.get('import-status').textContent, /0 linhas importadas/);
  assert.equal(ui.get('confirm-import').disabled, true);
  ui.change('rows', ui.get('rows').value.replace('\nHospital;', '\nHospital Escola DEMO;'));
  ui.submit('import-form'); assert.equal(ui.get('confirm-import').disabled, false);
});

test('human preview shows source, destination and all row values, never UUIDs', async t => {
  const ui = await open(t); prepare(ui);
  assert.match(ui.get('context-preview').textContent, /2027.1.*Processo DEMO.*arquivo editorial/s);
  assert.match(ui.get('preview').textContent, /Clínica médica/);
  assert.match(ui.get('preview').textContent, /720/);
  assert.doesNotMatch(ui.get('preview').textContent, /[a-f0-9]{8}-[a-f0-9]{4}-/i);
  ui.change('source', 'Outra fonte DEMO'); assert.equal(ui.get('confirm-import').disabled, true);
});

test('empty batch exposes the collapsed editor before focusing the error', async t => {
  const ui = await open(t); prepare(ui, 'empty');
  assert.equal(ui.d.activeElement.id, 'rows');
  assert.equal(ui.get('rows').closest('details').open, true);
  assert.match(ui.get('import-error').textContent, /Nenhuma linha/);
});

test('XLSX preload is explicitly simulated and uses the same human preflight', async t => {
  const ui = await open(t); ui.change('format', 'xlsx'); prepare(ui);
  assert.match(ui.get('file-name').textContent, /xlsx.*aba Cortes simulada/);
  assert.equal(ui.get('confirm-import').disabled, false);
  assert.equal(ui.d.querySelector('input[type=file]'), null);
});

test('changing format requires a fresh preload, never relabels a stale batch', async t => {
  const ui = await open(t); prepare(ui); ui.change('format', 'xlsx');
  ui.submit('import-form');
  assert.equal(ui.get('confirm-import').disabled, true);
  assert.match(ui.get('file-name').textContent, /Recarregue/);
});

test('save failure preserves inputs and retry cannot double-submit or duplicate success', async t => {
  const ui = await open(t); prepare(ui);
  const rows = ui.get('rows').value;
  ui.change('fail-next', 'import'); ui.click('confirm-import'); ui.click('confirm-import');
  await settle();
  assert.match(ui.get('import-status').textContent, /Falha simulada/);
  assert.equal(ui.get('rows').value, rows);
  assert.match(ui.get('source').value, /arquivo editorial/);
  ui.click('retry-import'); ui.click('retry-import');
  await settle();
  assert.match(ui.get('import-status').textContent, /DEMO: 2 linhas/);
  assert.equal(ui.get('import-form').dataset.sends, '2');
  assert.equal(ui.get('confirm-import').disabled, true);
});

test('normalized duplicate scenario and nonfinite score refuse atomic batch', async t => {
  const ui = await open(t); prepare(ui);
  const line = ui.get('rows').value.split('\n')[0];
  ui.change('rows', `${line}\n${line.replace('Ambulatório', ' ambulatório ')}`);
  ui.submit('import-form'); assert.match(ui.get('preview').textContent, /duplicad/i);
  ui.change('rows', line.replace('720', 'Infinity')); ui.submit('import-form');
  assert.match(ui.get('preview').textContent, /finito/i);
  assert.equal(ui.get('confirm-import').disabled, true);
});

test('reason is mandatory and dialog keeps focus, Escape returns to trigger', async t => {
  const ui = await open(t); ui.click('open-reprocess'); ui.submit('reprocess-form');
  assert.equal(ui.d.activeElement.id, 'reason');
  assert.equal(ui.get('reason').getAttribute('aria-invalid'), 'true');
  ui.get('confirm-reprocess').focus();
  ui.get('dialog').dispatchEvent(new ui.dom.window.KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }));
  assert.equal(ui.d.activeElement.id, 'reason');
  ui.get('dialog').dispatchEvent(new ui.dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
  assert.equal(ui.get('dialog').open, false);
  assert.equal(ui.d.activeElement.id, 'open-reprocess');
});

for (const [control, value, message] of [
  ['exam-state', 'open', /janela.*aberta/i], ['exam-state', 'invalid', /estrutura.*inválida/i],
  ['role', 'editor', /attempts.manage/], ['role', 'support', /content.manage/],
  ['feature', 'off', /editions_ui/],
]) {
  test(`guard ${control}=${value} blocks mutations with explanation`, async t => {
    const ui = await open(t); ui.change(control, value); ui.click('open-reprocess');
    assert.match(ui.get('reprocess-block').textContent, message);
    assert.equal(ui.get('open-reprocess').disabled, true);
    assert.equal(ui.get('dialog').open, false);
    if (control === 'role' && value === 'support' || control === 'feature') {
      prepare(ui); assert.equal(ui.get('confirm-import').disabled, true);
    }
  });
}

test('reprocess failure keeps reason and retry returns only aggregate demo report', async t => {
  const ui = await open(t); ui.change('fail-next', 'reprocess'); ui.click('open-reprocess');
  ui.change('reason', 'Correção editorial DEMO da questão de clínica.');
  ui.submit('reprocess-form'); ui.submit('reprocess-form'); await settle();
  assert.equal(ui.get('dialog').open, true);
  assert.match(ui.get('reason').value, /Correção editorial/);
  assert.match(ui.get('reprocess-status').textContent, /Falha simulada/);
  ui.submit('reprocess-form'); await settle();
  assert.equal(ui.get('reprocess-form').dataset.sends, '2');
  assert.equal(ui.get('dialog').open, false);
  assert.match(ui.get('report').textContent, /DEMO.*tentativas processadas.*notas alteradas.*entradas reconciliadas/is);
  assert.equal(ui.d.activeElement.id, 'report');
});

for (const state of ['loading', 'empty', 'error']) {
  test(`catalog ${state} recovers without clearing source`, async t => {
    const ui = await open(t); ui.change('source', 'Fonte DEMO preservada'); ui.change('catalog-state', state);
    assert.equal(ui.get('edition').disabled, true);
    assert.match(ui.get('catalog-message').textContent, /Carregando|Nenhuma|Falha/);
    ui.click('catalog-retry'); await settle();
    assert.equal(ui.get('edition').disabled, false);
    assert.equal(ui.get('source').value, 'Fonte DEMO preservada');
  });
}

test('offline policy, no network/storage and untrusted text stays text', async t => {
  const ui = await open(t); prepare(ui);
  ui.change('source', '<img src="https://invalid.test/x" onerror="alert(1)">');
  ui.submit('import-form'); ui.click('confirm-import'); await settle();
  assert.equal(ui.d.querySelector('img'), null);
  assert.deepEqual(ui.requests, []); assert.deepEqual(ui.errors, []);
  const html = await readFile(htmlURL, 'utf8');
  assert.match(html, /connect-src 'none'/); assert.match(html, /form-action 'none'/);
  assert.doesNotMatch(html, /localStorage|sessionStorage|https?:\/\/|@import|fetch\(/);
});
