import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const source = readFileSync(new URL('../site/downloads.js', import.meta.url), 'utf8');
const html = readFileSync(new URL('../site/index.html', import.meta.url), 'utf8');
const windows = 'version: 0.7.0\nfiles:\n  - url: Salinha-0.7.0-setup.exe\n    size: 125829120\npath: Salinha-0.7.0-setup.exe\n';
const linux = "version: 0.7.0\nfiles:\n  - url: Salinha-0.7.0-x64.AppImage\n    size: 157286400\npath: 'Salinha-0.7.0-x64.AppImage'\n";

async function load(manifests, location) {
  const elements = new Map();
  const querySelectorAll = (selector) => {
    if (!elements.has(selector)) elements.set(selector, [{
      attrs: { 'aria-disabled': 'true', tabindex: '-1' },
      textContent: '',
      setAttribute(name, value) { this.attrs[name] = value; },
      removeAttribute(name) { delete this.attrs[name]; }
    }]);
    return elements.get(selector);
  };
  const requests = [];
  await runInNewContext(source, {
    ...(location ? { location } : {}),
    document: { querySelectorAll },
    fetch: async (url, options) => {
      requests.push([url, options.cache]);
      const content = manifests[url];
      return { ok: typeof content === 'string', text: async () => content };
    }
  });
  return { get: (selector) => querySelectorAll(selector)[0], requests };
}

test('landing page disponibiliza os dois formatos com links independentes', async () => {
  assert.match(html, /src="downloads.js"/);
  for (const platform of ['windows', 'linux']) {
    assert.match(html, new RegExp(`data-download="${platform}" aria-disabled="true"`));
  }
  const { get, requests } = await load({ '/updates/latest.yml': windows, '/updates/latest-linux.yml': linux });
  assert.equal(get('[data-download="windows"]').href, '/updates/Salinha-0.7.0-setup.exe');
  assert.equal(get('[data-download="linux"]').href, '/updates/Salinha-0.7.0-x64.AppImage');
  assert.equal(get('[data-download="linux"]').attrs.download, 'Salinha-0.7.0-x64.AppImage');
  assert.equal(get('[data-download="linux"]').attrs['aria-disabled'], undefined);
  assert.equal(get('[data-version-meta="linux"]').textContent, 'AppImage x64 · v0.7.0 · 150 MB');
  assert.equal(requests.length, 2);
  assert.ok(requests.every(([, cache]) => cache === 'no-store'));
});

for (const failing of ['windows', 'linux']) {
  test(`falha em ${failing} não bloqueia a outra plataforma`, async () => {
    const manifests = { '/updates/latest.yml': windows, '/updates/latest-linux.yml': linux };
    delete manifests[failing === 'windows' ? '/updates/latest.yml' : '/updates/latest-linux.yml'];
    const { get } = await load(manifests);
    const working = failing === 'windows' ? 'linux' : 'windows';
    assert.equal(get(`[data-download="${failing}"]`).href, undefined);
    assert.equal(get(`[data-download="${working}"]`).attrs['aria-disabled'], undefined);
    assert.match(get(`[data-version-meta="${failing}"]`).textContent, /indisponível/);
  });
}

test('manifesto inválido ou caminho externo não habilita download', async () => {
  for (const path of ['https://evil.test/a.AppImage', '../a.AppImage', 'a.exe', '']) {
    const { get } = await load({ '/updates/latest-linux.yml': `version: 0.7.0\npath: ${path}\n` });
    assert.equal(get('[data-download="linux"]').href, undefined);
    assert.match(get('[data-version-meta="linux"]').textContent, /indisponível/);
  }
});

test('comando de instalação do Linux aponta para o servidor da página', async () => {
  assert.match(html, /<code data-install-cmd>curl -fsSL https:\/\/salinha.bhrx.com.br\/install.sh \| sh<\/code>/);
  const own = await load({}, { protocol: 'https:', origin: 'https://salinha.bhrx.com.br' });
  assert.equal(own.get('[data-install-cmd]').textContent, 'curl -fsSL https://salinha.bhrx.com.br/install.sh | sh');
  const other = await load({}, { protocol: 'https:', origin: 'https://outra.exemplo' });
  assert.equal(
    other.get('[data-install-cmd]').textContent,
    'curl -fsSL https://outra.exemplo/install.sh | SALINHA_URL=https://outra.exemplo sh'
  );
  for (const location of [{ protocol: 'file:', origin: 'null' }, { protocol: 'http:', origin: 'http://1.2.3.4:8080' }]) {
    const page = await load({}, location);
    // Nunca um comando por HTTP puro.
    assert.equal(page.get('[data-install-cmd]').textContent, 'curl -fsSL https://salinha.bhrx.com.br/install.sh | sh');
  }
});
