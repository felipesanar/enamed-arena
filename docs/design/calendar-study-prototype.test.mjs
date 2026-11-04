import { readFile } from 'node:fs/promises';
import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

async function open(t, query = '') {
  const html = await readFile(new URL('./calendar-study-prototype.html', import.meta.url), 'utf8');
  const dom = new JSDOM(html, { url: `file:///calendar-study-prototype.html${query}`, runScripts: 'dangerously' });
  t.after(() => dom.window.close());
  const get = id => { const node = dom.window.document.getElementById(id); assert.ok(node, id); return node; };
  return { dom, get, change(id, value) { get(id).value = value; get(id).dispatchEvent(new dom.window.Event('change')); } };
}

test('labels all dates as demo and names Brasilia reference', async t => {
  const { get } = await open(t);
  assert.match(get('demo').textContent, /DEMO/);
  assert.match(get('timezone').textContent, /Brasília/);
});
test('calendar is a chronological list, not an empty month grid', async t => {
  const { get } = await open(t);
  assert.equal(get('events').tagName, 'OL');
  assert.equal(get('events').children.length, 3);
});
for (const state of ['loading', 'error', 'empty', 'pending', 'schedule']) {
  test(`calendar state ${state} is explicit and preserves selection`, async t => {
    const { get } = await open(t, `?calendar=${state}`);
    assert.equal(get('calendar-state').value, state);
    assert.equal(get('edition').value, '2027.2');
    assert.equal(get('export').disabled, !['pending', 'schedule'].includes(state));
    assert.equal(get('events').hidden, !['pending', 'schedule'].includes(state));
  });
}
test('retry recovers errors and keeps keyboard focus', async t => {
  const { get } = await open(t, '?calendar=error');
  get('retry').click();
  assert.equal(get('calendar-state').value, 'schedule');
  assert.equal(get('retry').ownerDocument.activeElement.id, 'calendar-title');
});
test('pending official date does not produce a fabricated official event', async t => {
  const { get } = await open(t, '?calendar=pending');
  assert.match(get('calendar-message').textContent, /Aguardando divulgação/);
  assert.doesNotMatch(get('events').textContent, /Prova oficial/);
});
test('edition changes update context without modifying the plan target', async t => {
  const { get, change } = await open(t);
  change('edition', '2026');
  assert.match(get('context').textContent, /Histórico.*2026/);
  assert.equal(get('target').value, '2027.2');
});
test('Google action is a deliberate per-event link with safe external attributes', async t => {
  const { get } = await open(t);
  for (const link of get('events').querySelectorAll('a')) {
    assert.equal(new URL(link.href).origin, 'https://calendar.google.com');
    assert.match(link.rel, /noopener/);
    assert.match(link.getAttribute('aria-label'), /Google/);
  }
});
for (const state of ['no-date', 'unknown', 'no-notebook', 'current', 'switching']) {
  test(`plan state ${state} keeps a single review action and explains limits`, async t => {
    const { get } = await open(t, `?plan=${state}`);
    assert.equal(get('plan-state').value, state);
    assert.ok(get('plan-message').textContent.length > 20);
    assert.equal(get('review').textContent, 'Revisar hoje');
    assert.equal(get('review').disabled, state === 'no-notebook' || state === 'switching');
  });
}
test('target change explicitly invalidates old plan and never changes calendar browsing edition', async t => {
  const { get, change } = await open(t);
  change('target', '2027.1');
  assert.equal(get('plan-state').value, 'switching');
  assert.match(get('plan-message').textContent, /2027.1/);
  assert.equal(get('edition').value, '2027.2');
  get('resolve-plan').click();
  assert.equal(get('plan-state').value, 'no-date');
});
test('dark theme and long names are selectable offline', async t => {
  const { get, change, dom } = await open(t);
  change('theme', 'dark');
  assert.equal(dom.window.document.documentElement.dataset.theme, 'dark');
  get('long-name').click();
  assert.ok(get('context').textContent.length > 150);
});
test('offline document has reduced motion, visible focus and no remote assets or automatic popup', async t => {
  const { dom } = await open(t);
  const html = dom.serialize();
  assert.match(html, /prefers-reduced-motion/);
  assert.match(html, /focus-visible/);
  assert.equal(dom.window.document.querySelectorAll('script[src],link[rel="stylesheet"],img[src^="http"]').length, 0);
  assert.doesNotMatch(html, /window\.open|fetch\(|XMLHttpRequest/);
});
