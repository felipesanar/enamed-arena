import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { readFile, realpath, stat } from 'node:fs/promises';
import { createServer } from 'node:http';

const root = fileURLToPath(new URL('../docs/design/', import.meta.url));

function requestedFile(target) {
  try {
    const pathname = decodeURIComponent(target.split('?')[0]);
    if (pathname === '/') return path.join(root, 'editions-prototype.html');
    // A flat document directory needs neither nested paths nor encoded separators.
    if (!/^\/[a-zA-Z0-9][a-zA-Z0-9_-]*\.(html|md)$/.test(pathname)) return null;
    return path.join(root, pathname.slice(1));
  } catch {
    return null;
  }
}

async function serve(request, response) {
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('Content-Security-Policy', "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; font-src 'self'; connect-src 'none'; form-action 'none'; base-uri 'none'; frame-ancestors 'none'");
  const send = (status, text) => { response.writeHead(status); response.end(text); };
  if (request.headers.host !== '127.0.0.1:54738') return send(403, 'Forbidden');
  if (!['GET', 'HEAD'].includes(request.method)) {
    response.setHeader('Allow', 'GET, HEAD');
    return send(405, 'Method not allowed');
  }
  const file = requestedFile(request.url);
  if (!file) return send(404, 'Not found');
  try {
    const [base, actual] = await Promise.all([realpath(root), realpath(file)]);
    const relative = path.relative(base, actual);
    if (relative.startsWith('..') || path.isAbsolute(relative) || !(await stat(actual)).isFile()) return send(404, 'Not found');
    const content = await readFile(actual);
    response.setHeader('Content-Type', file.endsWith('.html') ? 'text/html; charset=utf-8' : 'text/plain; charset=utf-8');
    response.writeHead(200);
    response.end(request.method === 'HEAD' ? undefined : content);
  } catch {
    send(404, 'Not found');
  }
}

async function selfTest() {
  const { test } = await import('node:test');
  const assert = (await import('node:assert/strict')).default;
  test('root and query resolve only inside docs/design', () => {
    assert.equal(requestedFile('/'), path.join(root, 'editions-prototype.html'));
    assert.equal(requestedFile('/editions-ui-handoff.md?demo=1'), path.join(root, 'editions-ui-handoff.md'));
  });
  test('rejects traversal, encoded separators, secrets and malformed paths', () => {
    for (const target of ['/../PRODUCT.md', '/%2e%2e/PRODUCT.md', '/%2e%2e%5cPRODUCT.md', '/a/../../x', '//host/file', '/.env', '/%00', '/%ZZ', '/C:/Windows/win.ini', '/a%252fb', '/x.html:stream']) {
      assert.equal(requestedFile(target), null, target);
    }
  });
  test('HTTP handler refuses other hosts, mutations and traversal; serves only documents', async () => {
    async function request(url, method = 'GET', host = '127.0.0.1:54738') {
      const result = { headers: {} };
      await serve({ url, method, headers: { host } }, {
        setHeader(name, value) { result.headers[name] = value; },
        writeHead(status) { result.status = status; },
        end(body) { result.body = body; }
      });
      return result;
    }
    assert.equal((await request('/', 'POST')).status, 405);
    assert.equal((await request('/', 'GET', 'example.com')).status, 403);
    assert.equal((await request('/%2e%2e/PRODUCT.md')).status, 404);
    assert.equal((await request('/missing.html')).status, 404);
    const document = await request('/');
    assert.equal(document.status, 200);
    assert.match(document.headers['Content-Type'], /text\/html/);
    assert.match(document.headers['Content-Security-Policy'], /connect-src 'none'/);
    assert.equal((await request('/', 'HEAD')).body, undefined);
  });
  const { JSDOM } = await import('jsdom');
  const html = await readFile(path.join(root, 'editions-prototype.html'), 'utf8');
  function page() {
    return new JSDOM(html, { runScripts: 'dangerously', url: 'http://127.0.0.1:54738/', beforeParse(window) {
      window.HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
      window.HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); this.dispatchEvent(new window.Event('close')); };
    } });
  }
  function change(window, id, value) {
    const control = window.document.getElementById(id);
    control.value = value;
    control.dispatchEvent(new window.Event('change', { bubbles: true }));
  }
  test('save validates unique code and retains values on recoverable error', () => {
    const dom = page(); const { window: w } = dom; const d = w.document;
    d.querySelector('[data-edit="2027.1"]').click();
    d.getElementById('label').value = 'Minha edição preservada';
    change(w, 'demo-state', 'error');
    d.getElementById('edition-form').dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true }));
    assert.equal(d.getElementById('label').value, 'Minha edição preservada');
    assert.equal(d.getElementById('editor').hidden, false);
    d.getElementById('retry').click();
    d.getElementById('code').value = '2027.2';
    d.getElementById('edition-form').dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true }));
    assert.equal(d.getElementById('code').getAttribute('aria-invalid'), 'true');
    d.getElementById('code').value = '2027.1';
    d.getElementById('edition-form').dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true }));
    assert.match(d.getElementById('rows').textContent, /Minha edição preservada/);
    dom.window.close();
  });
  test('confirmation requires a date; future seeds have no official dates', () => {
    const dom = page(); const d = dom.window.document;
    for (const code of ['2027.1', '2027.2', '2026']) {
      d.querySelector(`[data-edit="${code}"]`).click();
      assert.deepEqual(['questions', 'alternatives', 'duration'].map(id => d.getElementById(id).value), ['100', '4', '300']);
      d.getElementById('cancel').click();
    }
    d.querySelector('[data-edit="2027.1"]').click();
    assert.equal(d.getElementById('exam-date').value, '');
    assert.equal(d.getElementById('confirmed').disabled, true);
    d.getElementById('exam-date').value = '2027-01-10';
    d.getElementById('exam-date').dispatchEvent(new dom.window.Event('input'));
    assert.equal(d.getElementById('confirmed').disabled, false);
    d.getElementById('confirmed').checked = true;
    d.getElementById('exam-date').value = '';
    d.getElementById('exam-date').dispatchEvent(new dom.window.Event('input'));
    assert.equal(d.getElementById('confirmed').checked, false);
    dom.window.close();
  });
  test('clone creates a distinct local draft and preserves original', () => {
    const dom = page(); const w = dom.window; const d = w.document;
    d.querySelector('[data-edit="2027.1"]').click();
    d.getElementById('open-clone').click();
    change(w, 'clone-destination', '2027.2');
    d.getElementById('clone-form').dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true }));
    assert.match(d.getElementById('draft-feedback').textContent, /Rascunho demo-1.*2027.2/);
    d.getElementById('open-clone').click();
    d.getElementById('clone-form').dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true }));
    assert.match(d.getElementById('draft-feedback').textContent, /demo-2/);
    assert.equal(d.querySelectorAll('[data-edit]').length, 3);
    assert.equal(d.getElementById('code').value, '2027.1');
    dom.window.close();
  });
  test('empty, loading, long text and student history are operable locally', () => {
    const dom = page(); const w = dom.window; const d = w.document;
    change(w, 'demo-state', 'empty');
    assert.equal(d.getElementById('empty-state').hidden, false);
    change(w, 'demo-state', 'loading');
    assert.equal(d.getElementById('listing').getAttribute('aria-busy'), 'true');
    change(w, 'demo-state', 'long');
    assert.match(d.getElementById('rows').textContent, /SemEspacos/);
    change(w, 'demo-view', 'student');
    assert.equal(d.getElementById('student').hidden, false);
    change(w, 'target', 'unknown');
    assert.match(d.getElementById('target-feedback').textContent, /Ainda não sei/);
    assert.equal(d.getElementById('history').open, false);
    change(w, 'demo-state', 'error');
    d.getElementById('student-retry').click();
    assert.equal(d.getElementById('demo-state').value, 'normal');
    assert.equal(d.getElementById('student-exam').hidden, false);
    dom.window.close();
  });
  test('local save treats markup as text and cancel restores focus', () => {
    const dom = page(); const w = dom.window; const d = w.document;
    d.getElementById('new-edition').click();
    assert.deepEqual(['questions', 'alternatives', 'duration'].map(id => d.getElementById(id).value), ['100', '4', '300']);
    d.getElementById('alternatives').value = '6';
    d.getElementById('code').value = 'demo-3';
    d.getElementById('label').value = '<img src=x onerror="alert(1)">';
    d.getElementById('questions').value = '0';
    const submit = () => d.getElementById('edition-form').dispatchEvent(new w.Event('submit', { bubbles:true, cancelable:true }));
    submit();
    assert.equal(d.activeElement.id, 'questions');
    assert.equal(d.getElementById('questions').getAttribute('aria-invalid'), 'true');
    d.getElementById('questions').value = '100'; submit();
    assert.equal(d.getElementById('rows').querySelector('img'), null);
    assert.match(d.getElementById('rows').textContent, /<img/);
    const edit = d.querySelector('[data-edit="demo-3"]'); edit.click();
    assert.equal(d.getElementById('alternatives').value, '6');
    d.getElementById('cancel').click();
    assert.equal(d.activeElement.dataset.edit, 'demo-3');
    dom.window.close();
  });
}

if (process.argv.includes('--test')) await selfTest();
else {
  const server = createServer(serve);
  server.on('error', error => { console.error(`Preview: ${error.message}`); process.exitCode = 1; });
  server.listen(54738, '127.0.0.1', () => console.info('Preview local: http://127.0.0.1:54738/editions-prototype.html'));
}
