if (process.platform === 'win32') process.exit(0);
// site/install.sh contra um servidor local (HTTP): instala numa HOME
// temporária, reinstala por cima e recusa download corrompido, manifesto
// adulterado e assinatura errada. A chave de teste é embutida pelo mesmo
// scripts/embed-pubkey.sh que o deploy usa.
import { execFile } from 'node:child_process';
import { createHash, generateKeyPairSync, sign } from 'node:crypto';
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
const EMBED = new URL('./embed-pubkey.sh', import.meta.url).pathname;
const keys = generateKeyPairSync('ed25519');
const otherKeys = generateKeyPairSync('ed25519');
let keyDir;
let signedInstall;

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
  files[`${file}.sig`] = sign(null, data, (over.key ?? keys).privateKey).toString('base64');
  files['latest-linux-tar.yml'] = [
    `version: ${over.version ?? version}`,
    `path: ${over.path ?? file}`,
    `sha512: ${over.sha512 ?? createHash('sha512').update(data).digest('hex')}`,
    `size: ${data.length}`,
    "releaseDate: '2026-10-25T12:00:00.000Z'"
  ].join('\n') + '\n';
}

function install(home, env = {}, script = signedInstall) {
  return run('sh', [script], {
    env: {
      PATH: process.env.PATH,
      HOME: home,
      SALINHA_URL: base,
      // Sem AppArmor por padrão (o runner do CI pode ter): cada teste escolhe.
      SALINHA_PROC_SYS: join(dir, 'proc-sys'),
      ...env
    }
  });
}

before(async () => {
  keyDir = mkdtempSync(join(tmpdir(), 'salinha-install-key-'));
  writeFileSync(join(keyDir, 'pub.pem'), keys.publicKey.export({ type: 'spki', format: 'pem' }));
  signedInstall = join(keyDir, 'install.sh');
  await run('bash', [EMBED, INSTALL, join(keyDir, 'pub.pem'), signedInstall]);
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
  rmSync(keyDir, { recursive: true, force: true });
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
  ['assinatura de outra chave', async () => publish('0.7.0', await tarball('0.7.0'), { key: otherKeys })],
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

test('confere a assinatura com a chave embutida', async () => {
  const home = join(dir, 'home');
  mkdirSync(home);
  publish('0.7.0', await tarball('0.7.0'));
  const { stdout } = await install(home);
  assert.match(stdout, /Assinatura da Salinha conferida/);
  assert.match(readFileSync(signedInstall, 'utf8'), /BEGIN PUBLIC KEY/);
});

test('sem a chave embutida (ou sem OpenSSL 3) recusa HTTP puro', async () => {
  const home = join(dir, 'home');
  mkdirSync(home);
  publish('0.7.0', await tarball('0.7.0'));
  await assert.rejects(install(home, {}, INSTALL), /sem HTTPS/);
  assert.equal(existsSync(join(home, '.local/share/salinha/current')), false);
});

test('script cortado no meio do download (curl | sh) não roda nada', async () => {
  const home = join(dir, 'home');
  mkdirSync(home);
  publish('0.7.0', await tarball('0.7.0'));
  const full = readFileSync(signedInstall, 'utf8');
  for (const fraction of [0.3, 0.6, 0.9, 0.99]) {
    const cut = join(dir, `cut-${fraction}.sh`);
    writeFileSync(cut, full.slice(0, Math.floor(full.length * fraction)));
    await install(home, {}, cut).catch(() => {});
    assert.equal(existsSync(join(home, '.local/share/salinha')), false, `cortado em ${fraction}`);
  }
});

function fakeSudo() {
  const bin = join(dir, 'fake-bin');
  mkdirSync(bin, { recursive: true });
  writeFileSync(join(bin, 'sudo'), '#!/bin/sh\nexec "$@"\n');
  writeFileSync(join(bin, 'apparmor_parser'), `#!/bin/sh\necho "$@" > "${join(dir, 'parser.txt')}"\n`);
  chmodSync(join(bin, 'sudo'), 0o755);
  chmodSync(join(bin, 'apparmor_parser'), 0o755);
  // install(1) de verdade grava no diretório falso do AppArmor.
  mkdirSync(join(dir, 'proc-sys/kernel'), { recursive: true });
  writeFileSync(join(dir, 'proc-sys/kernel/apparmor_restrict_unprivileged_userns'), '1\n');
  mkdirSync(join(dir, 'apparmor.d'), { recursive: true });
  return bin;
}

test('Ubuntu 24.04+ (AppArmor): com "s" instala o perfil que mantém o sandbox', async () => {
  const home = join(dir, 'home');
  mkdirSync(home);
  publish('0.7.0', await tarball('0.7.0'));
  const bin = fakeSudo();
  const { stdout } = await install(home, {
    PATH: `${bin}:${process.env.PATH}`,
    SALINHA_APPARMOR: 's',
    SALINHA_APPARMOR_D: join(dir, 'apparmor.d')
  });
  const root = join(home, '.local/share/salinha');
  const profile = readFileSync(join(dir, 'apparmor.d/salinha'), 'utf8');
  assert.match(profile, /abi <abi\/4\.0>,/);
  assert.ok(profile.includes(`profile salinha "${root}/versions/*/salinha" flags=(unconfined) {`));
  assert.match(profile, /^  userns,$/m);
  assert.equal(readFileSync(join(dir, 'parser.txt'), 'utf8').trim(), `-r ${join(dir, 'apparmor.d/salinha')}`);
  assert.match(stdout, /Perfil do AppArmor instalado/);
});

test('Ubuntu 24.04+ (AppArmor): sem resposta (ou "n") não usa sudo e explica', async () => {
  const home = join(dir, 'home');
  mkdirSync(home);
  publish('0.7.0', await tarball('0.7.0'));
  const bin = fakeSudo();
  const { stdout } = await install(home, {
    PATH: `${bin}:${process.env.PATH}`,
    SALINHA_APPARMOR: 'n',
    SALINHA_APPARMOR_D: join(dir, 'apparmor.d')
  });
  assert.equal(existsSync(join(dir, 'apparmor.d/salinha')), false);
  assert.match(stdout, /sem a proteção do navegador \(sandbox\)/);
});
