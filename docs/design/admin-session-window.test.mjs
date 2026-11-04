import { readFile } from 'node:fs/promises';
import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const url = new URL('./admin-session-window.html', import.meta.url);
const settle = () => new Promise(resolve => setTimeout(resolve, 100));
async function open(t) {
  const html = await readFile(url, 'utf8');
  const dom = new JSDOM(html, { runScripts: 'dangerously', beforeParse(w) {
    w.HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
    w.HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); this.dispatchEvent(new w.Event('close')); };
  } });
  t.after(() => dom.window.close());
  const d = dom.window.document;
  const get = id => { const element = d.getElementById(id); assert.ok(element, id); return element; };
  const change = (id, value) => {
    get(id).value = value;
    get(id).dispatchEvent(new dom.window.Event('input', { bubbles: true }));
    get(id).dispatchEvent(new dom.window.Event('change', { bubbles: true }));
  };
  return { dom, d, get, change, click: id => get(id).click() };
}
async function ready(ui) {
  ui.click('open-window'); ui.change('window-end', '2027-03-14T19:00');
  ui.click('preview-window'); await settle();
  ui.change('window-reason', 'Ajuste operacional fictício');
}

test('labels, IDs, Brasília and offline policy are explicit', async t => {
  const ui = await open(t);
  for (const id of ['window-start', 'window-end', 'window-release', 'window-reason', 'ranking-rule', 'session-opens', 'session-closes', 'session-caderno']) {
    assert.ok(ui.d.querySelector(`label[for="${id}"]`), id);
  }
  assert.match(ui.get('window-description').textContent, /Brasília/);
  const html = await readFile(url, 'utf8');
  assert.match(html, /connect-src 'none'/);
  assert.doesNotMatch(html, /https?:\/\/|fetch\(|XMLHttpRequest|toISOString\(|getUTC|\.innerHTML\s*=/);
});

test('preview precedes confirmation; any date edit invalidates it', async t => {
  const ui = await open(t); ui.click('open-window');
  assert.equal(ui.get('confirm-window').disabled, true);
  ui.change('window-end', '2027-03-14T19:00'); ui.click('preview-window');
  assert.equal(ui.get('window-dialog').dataset.state, 'checking');
  assert.equal(ui.get('preview-window').disabled, true);
  await settle();
  assert.equal(ui.get('window-dialog').dataset.state, 'ready');
  assert.match(ui.get('window-summary').textContent, /Antes.*Depois/s);
  assert.match(ui.get('window-counts').textContent, /12.*examinadas.*3.*alterada/s);
  assert.equal(ui.get('confirm-window').disabled, true);
  ui.change('window-reason', 'Motivo DEMO'); assert.equal(ui.get('confirm-window').disabled, false);
  for (const id of ['window-start', 'window-end', 'window-release']) {
    ui.change(id, ui.get(id).value);
    assert.equal(ui.get('confirm-window').disabled, true);
    assert.equal(ui.get('window-summary').hidden, true);
    ui.click('preview-window'); await settle();
  }
});

test('invalid dates and blank reason never submit', async t => {
  const ui = await open(t); ui.click('open-window');
  ui.change('window-end', '2027-03-13T08:00'); ui.click('preview-window');
  assert.match(ui.get('window-status').textContent, /Abertura.*Encerramento.*Resultado/);
  assert.equal(ui.get('window-dialog').dataset.state, 'draft');
  ui.change('window-end', '2027-03-14T19:00'); ui.click('preview-window'); await settle();
  ui.change('window-reason', '   '); assert.equal(ui.get('confirm-window').disabled, true);
});

test('stale review requires a new preview and never displays technical identifiers', async t => {
  const ui = await open(t); ui.change('demo-outcome', 'stale'); await ready(ui);
  ui.click('confirm-window'); await settle();
  assert.equal(ui.get('window-dialog').dataset.state, 'stale');
  assert.equal(ui.get('confirm-window').disabled, true);
  assert.match(ui.get('window-status').textContent, /conferir novamente/);
  assert.doesNotMatch(ui.get('window-dialog').textContent, /hash|RPC|UUID|55P03/i);
  ui.click('preview-window'); await settle(); assert.equal(ui.get('window-dialog').dataset.state, 'ready');
});

test('busy write requires explicit retry; uncertain response requires refresh and preview', async t => {
  const ui = await open(t); ui.change('demo-outcome', 'busy'); await ready(ui);
  ui.click('confirm-window'); await settle();
  assert.equal(ui.get('window-dialog').dataset.state, 'busy');
  assert.equal(ui.get('confirm-window').disabled, true);
  ui.click('retry-window'); assert.equal(ui.get('window-dialog').dataset.state, 'checking'); await settle();
  ui.change('demo-outcome', 'uncertain'); ui.click('confirm-window'); await settle();
  assert.equal(ui.get('window-dialog').dataset.state, 'uncertain');
  assert.equal(ui.get('preview-window').disabled, true);
  ui.click('cancel-window'); ui.click('open-window');
  assert.equal(ui.get('window-dialog').dataset.state, 'uncertain');
  ui.click('refresh-window'); await settle();
  assert.equal(ui.get('window-dialog').dataset.state, 'draft');
  assert.equal(ui.get('confirm-window').disabled, true);
  ui.click('preview-window'); await settle(); assert.equal(ui.get('window-dialog').dataset.state, 'ready');
});

test('unknown participation count is not zero, disables generic window change', async t => {
  const ui = await open(t); ui.change('demo-count', 'unknown');
  assert.equal(ui.get('open-window').disabled, true);
  assert.match(ui.get('window-access').textContent, /indisponível/);
  assert.doesNotMatch(ui.get('window-access').textContent, /0 participações/);
  assert.equal(ui.get('generic-start').disabled, true);
  ui.change('demo-count', 'known'); ui.change('demo-permission', 'no');
  assert.equal(ui.get('open-window').disabled, true);
  assert.match(ui.get('window-access').textContent, /administrador/);
  assert.equal(ui.get('metadata-title').disabled, false);
});

test('unknown preview counts cannot be confirmed', async t => {
  const ui = await open(t); ui.change('demo-outcome', 'counts'); await ready(ui);
  assert.equal(ui.get('window-dialog').dataset.state, 'unavailable');
  assert.equal(ui.get('confirm-window').disabled, true);
  assert.match(ui.get('window-counts').textContent, /indisponíveis/);
});

test('unchanged window fixture never reports changed eligibility', async t => {
  const ui = await open(t); ui.click('open-window'); ui.click('preview-window'); await settle();
  assert.match(ui.get('window-counts').textContent, /0 com elegibilidade alterada/);
});

test('successful window update preserves dirty metadata and prevents duplicate sends', async t => {
  const ui = await open(t); ui.change('metadata-title', 'Título ainda não salvo');
  ui.change('metadata-description', '<img src=x onerror=alert(1)>'); await ready(ui);
  ui.click('confirm-window'); ui.click('confirm-window');
  assert.equal(ui.get('window-dialog').dataset.state, 'saving');
  await settle();
  assert.equal(ui.get('window-dialog').dataset.state, 'success');
  assert.equal(ui.get('metadata-title').value, 'Título ainda não salvo');
  assert.equal(ui.get('metadata-description').value, '<img src=x onerror=alert(1)>');
  assert.match(ui.get('window-result').textContent, /DEMO.*concluída/s);
  assert.equal(ui.get('window-dialog').open, false);
});

test('new session chooses session window; existing session keeps real rule', async t => {
  const ui = await open(t);
  ui.change('demo-session', 'new'); assert.equal(ui.get('ranking-rule').value, 'session_window_v1');
  ui.change('demo-session', 'legacy'); assert.equal(ui.get('ranking-rule').value, 'legacy_online_window');
  ui.change('demo-session', 'session'); assert.equal(ui.get('ranking-rule').value, 'session_window_v1');
  assert.equal(ui.get('session-caderno').value, 'blue');
});

test('missing/unknown rule is unavailable, omitted from payload; legacy fields remain editable', async t => {
  const ui = await open(t);
  for (const value of ['missing', 'unknown']) {
    ui.change('demo-session', value);
    assert.equal(ui.get('ranking-rule').disabled, true);
    assert.equal(ui.get('ranking-rule').value, '');
    ui.change('session-label', 'Sala editada'); ui.click('save-session');
    assert.equal(Object.hasOwn(ui.dom.window.sessionPayload, 'ranking_rule'), false);
    assert.equal(ui.dom.window.sessionPayload.label, 'Sala editada');
  }
  ui.change('demo-session', 'session'); ui.change('demo-flag', 'off');
  assert.equal(ui.get('ranking-section').hidden, true);
  ui.click('save-session'); assert.equal(Object.hasOwn(ui.dom.window.sessionPayload, 'ranking_rule'), false);
});

test('variable text is escaped by rendering as text, with no injected elements', async t => {
  const ui = await open(t);
  const text = '<img src=x onerror=alert(1)> & "DEMO"';
  ui.change('session-label', text); ui.click('save-session');
  assert.ok(ui.get('session-status').textContent.includes(text));
  assert.equal(ui.get('session-status').querySelector('img'), null);
  const html = await readFile(url, 'utf8');
  assert.doesNotMatch(html, /insertAdjacentHTML|document\.write|eval\(/);
});
