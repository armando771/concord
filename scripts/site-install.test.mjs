// site/install.sh contra um servidor local: instala numa HOME temporária,
// reinstala por cima e recusa download corrompido ou manifesto adulterado.
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  chmodSync, copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readlinkSync, rmSync, writeFileSync
} from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, beforeEach, test } from 'node:test';
import { promisify } from 'node:util';
import assert from 'node:assert/strict';

const run = promisify(execFile);
const INSTALL = new URL('../site/install.sh', import.meta.url).pathname;
const LAUNCHER = new URL('../frontend/build/linux/salinha-launcher', import.meta.url).pathname;

let dir;
let files;
let server;
let base;

async function tarball(version, versionFile = version) {
  const src = mkdtempSync(join(dir, 'src-'));
  writeFileSync(join(src, 'salinha'), `#!/bin/sh\necho ${version}\n`);
  chmodSync(join(src, 'salinha'), 0o755);
  copyFileSync(LAUNCHER, join(src, 'salinha-launcher'));
  chmodSync(join(src, 'salinha-launcher'), 0o755);
  writeFileSync(join(src, 'salinha.png'), 'png');
  writeFileSync(join(src, 'salinha-version'), `${versionFile}\n`);
  const out = join(dir, `${version}-${Math.random()}.tar.gz`);
  await run('tar', ['-C', src, '-czf', out, '.']);
  return readFileSync(out);
}

function publish(version, data, over = {}) {
  const file = `Salinha-${version}-x64.tar.gz`;
  files[file] = data;
  files['latest-linux-tar.yml'] = [
    `version: ${over.version ?? version}`,
    `path: ${over.path ?? file}`,
    `sha512: ${over.sha512 ?? createHash('sha512').update(data).digest('hex')}`,
    `size: ${data.length}`,
    "releaseDate: '2026-10-25T12:00:00.000Z'"
  ].join('\n') + '\n';
}

function install(home, env = {}) {
  return run('sh', [INSTALL], {
    env: { PATH: process.env.PATH, HOME: home, SALINHA_URL: base, ...env }
  });
}

before(async () => {
  server = createServer((req, res) => {
    const name = decodeURIComponent(new URL(req.url, 'http://x').pathname.replace(/^\/updates\//, ''));
    const body = files[name];
    if (body === undefined) {
      res.writeHead(404).end();
      return;
    }
    res.writeHead(200).end(body);
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(() => {
  server.close();
  if (dir) rmSync(dir, { recursive: true, force: true });
});

beforeEach(() => {
  if (dir) rmSync(dir, { recursive: true, force: true });
  dir = mkdtempSync(join(tmpdir(), 'salinha-install-'));
  files = {};
});

test('instala na pasta do usuário com lançador e atalho', async () => {
  const home = join(dir, 'home');
  mkdirSync(home);
  publish('0.7.0', await tarball('0.7.0'));
  const { stdout } = await install(home);
  const root = join(home, '.local/share/salinha');
  assert.match(stdout, /Salinha 0\.7\.0 instalada/);
  assert.equal(readlinkSync(join(root, 'current')), 'versions/0.7.0');
  assert.match(readFileSync(join(home, '.local/bin/salinha'), 'utf8'), /current\/salinha-launcher/);
  assert.match(
    readFileSync(join(home, '.local/share/applications/salinha.desktop'), 'utf8'),
    new RegExp(`Exec="${root}/current/salinha-launcher" %U`)
  );

  // Versão nova por cima: a anterior vira previous (volta automática).
  publish('0.7.1', await tarball('0.7.1'));
  await install(home);
  assert.equal(readlinkSync(join(root, 'current')), 'versions/0.7.1');
  assert.equal(readlinkSync(join(root, 'previous')), 'versions/0.7.0');

  // Mesma versão de novo: reinstala sem quebrar current.
  await install(home);
  assert.equal(readlinkSync(join(root, 'current')), 'versions/0.7.1');
  assert.ok(existsSync(join(root, 'versions/0.7.1/salinha')));
});

test('avisa da Salinha antiga extraída em ~/.local/opt/salinha e guarda o lançador antigo', async () => {
  const home = join(dir, 'home');
  mkdirSync(join(home, '.local/opt/salinha'), { recursive: true });
  mkdirSync(join(home, '.local/bin'), { recursive: true });
  writeFileSync(join(home, '.local/opt/salinha/AppRun'), '');
  writeFileSync(join(home, '.local/opt/salinha/salinha'), '');
  chmodSync(join(home, '.local/opt/salinha/salinha'), 0o755);
  writeFileSync(join(home, '.local/bin/salinha'), '#!/bin/sh\nexec "$HOME/.local/opt/salinha/salinha" "$@"\n');
  publish('0.7.0', await tarball('0.7.0'));
  const { stdout } = await install(home);
  assert.match(stdout, /Salinha antiga \(AppImage extraído\)/);
  assert.match(readFileSync(join(home, '.local/bin/salinha'), 'utf8'), /X-Salinha-Managed/);
  // O AppImage extraído não é apagado pelo instalador.
  assert.ok(existsSync(join(home, '.local/opt/salinha/AppRun')));
});

for (const [name, setup] of [
  ['sha512 que não confere', async () => publish('0.7.0', await tarball('0.7.0'), { sha512: 'ab'.repeat(64) })],
  ['caminho externo no manifesto', async () => publish('0.7.0', await tarball('0.7.0'), { path: '../x.tar.gz' })],
  ['pacote de outra versão', async () => publish('0.7.0', await tarball('0.7.0', '0.6.0'))]
]) {
  test(`recusa ${name} sem instalar nada`, async () => {
    const home = join(dir, 'home');
    mkdirSync(home);
    await setup();
    await assert.rejects(install(home));
    assert.equal(existsSync(join(home, '.local/share/salinha/current')), false);
    assert.equal(existsSync(join(home, '.local/bin/salinha')), false);
  });
}

test('recusa rodar como root', async () => {
  if (process.getuid?.() === 0) return;
  // Simula root com um id falso no PATH.
  const bin = join(dir, 'bin');
  mkdirSync(bin);
  writeFileSync(join(bin, 'id'), '#!/bin/sh\necho 0\n');
  chmodSync(join(bin, 'id'), 0o755);
  await assert.rejects(
    run('sh', [INSTALL], { env: { PATH: `${bin}:${process.env.PATH}`, HOME: dir, SALINHA_URL: base } }),
    /sem sudo/
  );
});
