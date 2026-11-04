import { readFile } from 'node:fs/promises';
import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

// Execute the delivered HTML, not a second implementation of its interactions.
async function open(t, query = '') {
  const html = await readFile(new URL('./edition-target-prototype.html', import.meta.url), 'utf8');
  const dom = new JSDOM(html, {
    url: `http://127.0.0.1:54739/edition-target-prototype.html${query}`,
    runScripts: 'dangerously',
    beforeParse(window) {
      // jsdom 20 does not implement the native dialog methods. Focus handling
      // remains the real prototype's code; native top-layer behavior needs Edge.
      window.HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
      window.HTMLDialogElement.prototype.close = function () {
        this.removeAttribute('open');
        this.dispatchEvent(new window.Event('close'));
      };
    },
  });
  t.after(() => dom.window.close());
  const { document } = dom.window;
  const get = id => {
    const element = document.getElementById(id);
    assert.ok(element, `Expected #${id}`);
    return element;
  };
  return {
    window: dom.window, document, get,
    change(id, value) {
      const element = get(id);
      element.value = value;
      element.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
    },
    click(id) { get(id).click(); },
    key(key, shiftKey = false) {
      document.activeElement.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key, shiftKey, bubbles: true, cancelable: true }));
    },
  };
}

const settle = () => new Promise(resolve => setTimeout(resolve, 550));

test('requires an explicit edition or undecided choice and focuses the group', async t => {
  const ui = await open(t);
  ui.click('save-target');
  assert.match(ui.get('form-error').textContent, /Escolha uma edição ou/);
  assert.equal(ui.document.activeElement.id, 'edition-choice-1');
  assert.match(ui.get('edition-choice-1').getAttribute('aria-describedby'), /form-error/);
  assert.equal(ui.get('target-form').getAttribute('aria-busy'), 'false');
});

test('optional graduation can stay empty; undecided is explicit, not the initial default', async t => {
  const ui = await open(t);
  assert.equal(ui.document.querySelector('input[name="edition"]:checked'), null);
  ui.click('edition-undecided');
  ui.click('save-target');
  await settle();
  assert.match(ui.get('save-status').textContent, /salv/i);
  assert.match(ui.get('confirmation').textContent, /Ainda não sei/);
  assert.match(ui.get('confirmation').textContent, /Não informada/);
});

test('partial graduation pair fails without clearing the selected edition', async t => {
  const ui = await open(t);
  ui.change('graduation-year', '2027');
  ui.click('edition-choice-2');
  ui.click('save-target');
  assert.match(ui.get('form-error').textContent, /ano e o semestre/);
  assert.equal(ui.document.activeElement.id, 'graduation-term');
  assert.equal(ui.get('edition-choice-2').checked, true);
  assert.equal(ui.get('graduation-term').getAttribute('aria-invalid'), 'true');
});

test('metadata suggestion never selects or overrides the explicit choice', async t => {
  const ui = await open(t);
  ui.change('graduation-year', '2027');
  ui.change('graduation-term', '2');
  assert.match(ui.get('suggestion').textContent, /2027.2/);
  assert.equal(ui.document.querySelector('input[name="edition"]:checked'), null);
  ui.click('edition-choice-1');
  ui.change('graduation-term', '1');
  assert.equal(ui.get('edition-choice-1').checked, true);
  ui.change('graduation-year', '2028');
  assert.match(ui.get('suggestion').textContent, /Sem sugestão/);
});

for (const state of ['loading', 'empty', 'error']) {
  test(`catalog ${state} keeps undecided available and permits a null save`, async t => {
    const ui = await open(t, `?catalog=${state}`);
    assert.equal(ui.document.querySelectorAll('input[name="edition"]').length, 1);
    ui.click('edition-undecided');
    ui.click('save-target');
    await settle();
    assert.match(ui.get('save-status').textContent, /salv/i);
  });
}

test('catalog retry recovers while preserving graduation and explicit undecided', async t => {
  const ui = await open(t, '?catalog=error');
  ui.change('graduation-year', '2027');
  ui.change('graduation-term', '2');
  ui.click('edition-undecided');
  ui.click('retry-catalog');
  await settle();
  assert.equal(ui.get('graduation-year').value, '2027');
  assert.equal(ui.get('edition-undecided').checked, true);
  assert.ok(ui.get('edition-choice-2'));
  assert.equal(ui.document.activeElement.id, 'edition-choice-1');
});

test('failed save preserves fields, focuses error, then retries without double submission', async t => {
  const ui = await open(t, '?result=error');
  ui.change('graduation-year', '2027');
  ui.change('graduation-term', '2');
  ui.click('edition-choice-2');
  ui.click('save-target');
  assert.equal(ui.get('save-target').disabled, true);
  assert.equal(ui.get('target-form').getAttribute('aria-busy'), 'true');
  ui.click('save-target');
  await settle();
  assert.match(ui.get('form-error').textContent, /Não foi possível salvar/);
  assert.equal(ui.document.activeElement.id, 'form-error');
  assert.equal(ui.get('graduation-year').value, '2027');
  assert.equal(ui.get('edition-choice-2').checked, true);
  assert.equal(ui.get('save-target').disabled, false);
  ui.change('demo-result', 'success');
  ui.click('save-target');
  await settle();
  assert.match(ui.get('save-status').textContent, /salv/i);
});

test('home remains usable when prompt dismissed, with no redirect', async t => {
  const ui = await open(t, '?scene=home');
  ui.click('dismiss-prompt');
  assert.equal(ui.get('edition-prompt').hidden, true);
  assert.ok(ui.get('home-content'));
  assert.equal(ui.window.location.pathname, '/edition-target-prototype.html');
});

test('dialog traps Tab, closes on Escape and restores the triggering focus', async t => {
  const ui = await open(t, '?scene=home');
  ui.get('open-target').focus();
  ui.click('open-target');
  assert.equal(ui.get('target-dialog').open, true);
  assert.equal(ui.document.activeElement.id, 'dialog-title');
  ui.get('cancel-target').focus();
  ui.key('Tab');
  assert.equal(ui.document.activeElement.id, 'graduation-year');
  ui.key('Tab', true);
  assert.equal(ui.document.activeElement.id, 'cancel-target');
  ui.key('Escape');
  assert.equal(ui.get('target-dialog').open, false);
  assert.equal(ui.document.activeElement.id, 'open-target');
});

test('dialog cancellation discards draft; successful save dismisses prompt and returns focus', async t => {
  const ui = await open(t, '?scene=home');
  ui.click('open-target');
  ui.click('edition-choice-2');
  ui.click('cancel-target');
  ui.click('open-target');
  assert.equal(ui.document.querySelector('input[name="edition"]:checked'), null);
  ui.click('edition-choice-1');
  ui.click('save-target');
  await settle();
  assert.equal(ui.get('target-dialog').open, false);
  assert.equal(ui.get('edition-prompt').hidden, true);
  assert.equal(ui.document.activeElement.id, 'home-title');
});

test('settings target save stays enabled during academic lock', async t => {
  const ui = await open(t, '?scene=settings');
  assert.match(ui.get('academic-lock').textContent, /bloquead/i);
  assert.equal(ui.get('edit-academic').disabled, true);
  ui.click('edition-choice-2');
  assert.equal(ui.get('save-target').disabled, false);
  ui.click('save-target');
  await settle();
  assert.match(ui.get('save-status').textContent, /salv/i);
  assert.equal(ui.get('edit-academic').disabled, true);
});

test('account switch discards pending completion and every draft from previous account', async t => {
  const ui = await open(t);
  ui.click('edition-choice-1');
  ui.click('save-target');
  ui.change('demo-account', 'b');
  await settle();
  assert.equal(ui.document.querySelector('input[name="edition"]:checked'), null);
  assert.equal(ui.get('graduation-year').value, '');
  assert.equal(ui.get('save-status').textContent, '');
  assert.equal(ui.get('confirmation').hidden, true);
});

test('saved preference is reused between scenes but not after switching accounts', async t => {
  const ui = await open(t, '?scene=settings');
  ui.change('graduation-year', '2027');
  ui.change('graduation-term', '2');
  ui.click('edition-choice-2');
  ui.click('save-target');
  await settle();
  ui.change('demo-scene', 'onboarding');
  assert.equal(ui.get('edition-choice-2').checked, true);
  assert.equal(ui.get('graduation-term').value, '2');
  ui.change('demo-account', 'b');
  assert.equal(ui.document.querySelector('input[name="edition"]:checked'), null);
  ui.change('demo-account', 'a');
  assert.equal(ui.document.querySelector('input[name="edition"]:checked'), null);
});

test('catalog becoming unavailable never silently replaces an explicit edition with null', async t => {
  const ui = await open(t);
  ui.click('edition-choice-2');
  ui.change('demo-catalog', 'error');
  ui.click('save-target');
  assert.match(ui.get('form-error').textContent, /sélection|seleção/);
  assert.equal(ui.document.activeElement.id, 'edition-undecided');
  assert.equal(ui.get('edition-undecided').checked, false);
  ui.change('demo-catalog', 'ready');
  assert.equal(ui.get('edition-choice-2').checked, true);
});

test('flag transition while saving discards stale completion', async t => {
  const ui = await open(t);
  ui.click('edition-choice-2');
  ui.click('save-target');
  ui.change('demo-flag', 'off');
  await settle();
  assert.equal(ui.document.querySelector('#confirmation'), null);
  ui.change('demo-flag', 'on');
  assert.equal(ui.document.querySelector('input[name="edition"]:checked'), null);
});

test('flag off removes new controls in every scene', async t => {
  for (const scene of ['onboarding', 'home', 'settings']) {
    const ui = await open(t, `?scene=${scene}&flag=off`);
    assert.equal(ui.document.querySelector('#target-form'), null);
    assert.equal(ui.document.querySelector('#open-target'), null);
    assert.match(ui.get('flag-notice').textContent, /Fluxo atual/);
  }
});

test('long catalog text remains literal and no external resources are requested', async t => {
  const ui = await open(t, '?long=on');
  assert.ok(ui.get('edition-choice-2').labels[0].textContent.length > 200);
  assert.equal(ui.document.querySelectorAll('script[src], link[href], img[src], iframe').length, 0);
  assert.doesNotMatch(ui.document.querySelector('style').textContent, /@import|url\(/);
  assert.match(ui.document.documentElement.textContent, /Aguardando divulgação do Inep/);
});
