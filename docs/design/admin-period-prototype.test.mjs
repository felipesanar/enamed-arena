import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const html = readFileSync(new URL('./admin-period-prototype.html', import.meta.url), 'utf8');
function boot(query = '', stored, denied = false) {
  const dom = new JSDOM(html, {
    url: `https://prototype.invalid/${query}`, runScripts: 'dangerously',
    beforeParse(w) {
      if (stored) w.sessionStorage.setItem('admin-period:demo-operator:v1', JSON.stringify(stored));
      if (denied) Object.defineProperty(w, 'sessionStorage', { get() { throw new Error('Denied'); } });
    },
  });
  const w = dom.window;
  const $ = id => w.document.getElementById(id);
  const change = (id, value) => { $(id).value = value; $(id).dispatchEvent(new w.Event('change', { bubbles: true })); };
  const state = () => JSON.parse(JSON.stringify(w.periodDemo.getState()));
  return { w, $, change, state, close: () => w.close() };
}
function custom(d, start, end) {
  d.change('period', 'custom');
  d.$('start').value = start;
  d.$('end').value = end;
  d.$('custom-form').dispatchEvent(new d.w.Event('submit', { bubbles: true, cancelable: true }));
}

test('default is all editions (null), legacy 7 days, clearly DEMO and no chart', () => {
  const d = boot();
  assert.equal(d.state().edition, null);
  assert.equal(d.state().days, 7);
  assert.match(d.$('demo-note').textContent, /DEMO/);
  assert.equal(d.w.document.querySelectorAll('canvas,svg.chart').length, 0);
  assert.equal(d.$('series').children.length, 2);
  d.close();
});
test('edition, period and local segment remain independent', () => {
  const d = boot();
  d.change('segment', 'pro'); d.change('edition', 'demo-a');
  d.change('period', '90');
  assert.equal(d.state().edition, 'demo-a');
  assert.equal(d.$('segment').value, 'pro');
  d.change('edition', 'demo-b');
  assert.equal(d.state().days, 90);
  assert.equal(d.$('series').children.length, 1);
  d.change('edition', ''); assert.equal(d.state().edition, null);
  d.close();
});
test('inclusive dates become [start,end) at BRT midnight, independent of browser timezone', () => {
  const d = boot(); custom(d, '2026-10-01', '2026-10-31');
  assert.deepEqual(d.state().range, { start: '2026-10-01T03:00:00.000Z', end: '2026-11-01T03:00:00.000Z' });
  assert.match(d.$('applied').textContent, /01\/10\/2026 até 31\/10\/2026/);
  assert.equal(d.state().days, 7); d.close();
});
test('same day is valid, leap day and year boundary convert correctly', () => {
  const d = boot(); custom(d, '2024-02-29', '2024-02-29');
  assert.equal(d.state().range.end, '2024-03-01T03:00:00.000Z');
  custom(d, '2026-12-31', '2026-12-31');
  assert.equal(d.state().range.end, '2027-01-01T03:00:00.000Z'); d.close();
});
test('applied custom range can be reopened and edited without toggling to a preset', () => {
  const d = boot(); custom(d, '2026-10-01', '2026-10-31');
  assert.equal(d.$('edit-custom').hidden, false);
  d.$('edit-custom').click();
  assert.equal(d.$('custom-form').hidden, false);
  assert.equal(d.$('start').value, '2026-10-01');
  assert.equal(d.$('end').value, '2026-10-31');
  assert.equal(d.w.document.activeElement.id, 'start'); d.close();
});
test('reversed dates keep applied selection and focus first invalid field', () => {
  const d = boot(); d.change('period', '30');
  const before = d.state(); custom(d, '2026-10-31', '2026-10-01');
  assert.deepEqual(d.state(), before);
  assert.equal(d.w.document.activeElement.id, 'end');
  assert.equal(d.$('end').getAttribute('aria-invalid'), 'true');
  assert.match(d.$('date-error').textContent, /igual ou posterior/);
  assert.equal(d.$('start').value, '2026-10-31'); d.close();
});
test('missing date cannot silently apply and focuses start', () => {
  const d = boot(); custom(d, '', '2026-10-01');
  assert.equal(d.w.document.activeElement.id, 'start');
  assert.equal(d.state().mode, '7'); d.close();
});
test('cancel custom restores applied period without losing edition', () => {
  const d = boot(); d.change('edition', 'demo-a'); d.change('period', '90');
  d.change('period', 'custom'); d.$('cancel-custom').click();
  assert.equal(d.$('period').value, '90'); assert.equal(d.state().edition, 'demo-a');
  assert.equal(d.$('custom-form').hidden, true); d.close();
});
test('changing edition while custom draft is open preserves draft and its control state', () => {
  const d = boot(); d.change('period', 'custom');
  d.$('start').value = '2026-10-01'; d.change('edition', 'demo-a');
  assert.equal(d.$('period').value, 'custom');
  assert.equal(d.$('custom-form').hidden, false);
  assert.equal(d.$('start').value, '2026-10-01');
  assert.equal(d.state().mode, '7'); d.close();
});
test('legacy period choice remains valid on reload', () => {
  const d = boot('?flag=off'); d.$('legacy-90').click();
  const saved = JSON.parse(d.w.sessionStorage.getItem('admin-period:demo-operator:v1'));
  const reloaded = boot('?flag=off', saved);
  assert.equal(reloaded.state().days, 90); d.close(); reloaded.close();
});
test('preset uses inclusive calendar days in BRT and preserves custom draft until applied', () => {
  const d = boot();
  const range = d.w.periodDemo.presetRange(7, new Date('2026-11-01T01:00:00Z'));
  assert.equal(range.start, '2026-10-25T03:00:00.000Z');
  assert.equal(range.end, '2026-11-01T03:00:00.000Z'); d.close();
});
test('valid scoped session restores after reload', () => {
  const d = boot(); d.change('edition', 'demo-b'); custom(d, '2026-10-01', '2026-10-02');
  const stored = JSON.parse(d.w.sessionStorage.getItem('admin-period:demo-operator:v1'));
  const reloaded = boot('', stored);
  assert.deepEqual(reloaded.state(), d.state()); reloaded.close(); d.close();
});
test('invalid or removed edition and malformed ranges restore safe default', () => {
  for (const saved of [
    { edition: 'removed', mode: '30', days: 30 },
    { edition: null, mode: '999', days: 999 },
    { edition: null, mode: 'custom', days: 7, from: '2026-02-30', to: '2026-03-01' },
    { edition: 'demo-a', mode: 'custom', days: 30, from: '2026-10-02', to: '2026-10-01' },
  ]) {
    const d = boot('', saved); assert.equal(d.state().edition, null); assert.equal(d.state().mode, '7');
    assert.match(d.$('storage-note').textContent, /anterior inválida/); d.close();
  }
});
test('blocked sessionStorage is non-fatal and warns about persistence', () => {
  const d = boot('', null, true); d.change('period', '30');
  assert.equal(d.state().days, 30); assert.match(d.$('storage-note').textContent, /não será mantida/); d.close();
});
test('flag false hides new controls and preserves legacy 7/30/90 without new args', () => {
  const d = boot('?flag=off', { edition: 'demo-a', mode: 'custom', days: 30, from: '2026-10-01', to: '2026-10-03' });
  assert.equal(d.$('new-filters').hidden, true); assert.equal(d.$('legacy').hidden, false);
  d.$('legacy-90').click(); assert.equal(d.state().days, 90);
  assert.equal(d.w.periodDemo.rpcArgs(), null); d.close();
});
test('catalog loading, error and empty never imply a successful all-editions load; retry recovers', () => {
  for (const status of ['loading', 'error', 'empty']) {
    const d = boot(`?catalog=${status}`);
    assert.equal(d.$('edition').disabled, true);
    assert.ok(d.$('catalog-status').textContent.trim().length > 0);
    assert.equal(d.$('series').children.length, 0);
    assert.equal(d.w.periodDemo.rpcArgs(), null);
    if (status !== 'loading') { d.$('retry').click(); assert.equal(d.$('edition').disabled, false); }
    d.close();
  }
});
test('seven future RPC args use null edition and explicit interval, scope does not claim other pages', () => {
  const d = boot(); const args = d.w.periodDemo.rpcArgs();
  assert.equal(args.p_edition_id, null);
  assert.ok(args.p_start_at < args.p_end_at);
  assert.match(d.$('scope-note').textContent, /Não se aplica/);
  assert.match(d.$('series-note').textContent, /não são conectadas/); d.close();
});
test('long labels remain available in full, theme toggle retains selection', () => {
  const d = boot('?catalog=long'); d.change('edition', 'demo-b');
  assert.ok(d.$('edition-name').textContent.length > 100);
  const before = d.state(); d.$('theme').click(); assert.deepEqual(d.state(), before);
  assert.equal(d.w.document.documentElement.classList.contains('dark'), true); d.close();
});
test('offline HTML has no remote resources and labels associate with form controls', () => {
  const d = boot();
  assert.equal(d.w.document.querySelectorAll('script[src],link[href],img[src],iframe').length, 0);
  for (const id of ['edition', 'period', 'start', 'end', 'segment']) assert.ok(d.w.document.querySelector(`label[for="${id}"]`));
  assert.doesNotMatch(html, /fetch\(|XMLHttpRequest|https?:\/\//); d.close();
});
