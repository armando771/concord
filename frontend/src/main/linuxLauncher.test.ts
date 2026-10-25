// Testa build/linux/salinha-launcher (shell) numa raiz falsa: sandbox, volta
// automática para a versão anterior e integração com o menu.
import { execFileSync } from 'child_process'
import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readlinkSync,
  readdirSync,
  rmSync,
  symlinkSync,
  writeFileSync
} from 'fs'
import { tmpdir } from 'os'
import { join, resolve } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

const LAUNCHER = resolve(__dirname, '../../build/linux/salinha-launcher')

let dir: string
let root: string
let home: string
let out: string
let fakeBin: string
let procSys: string

function writeExec(path: string, content: string): void {
  writeFileSync(path, content)
  chmodSync(path, 0o755)
}

function addVersion(version: string): void {
  const v = join(root, 'versions', version)
  mkdirSync(v, { recursive: true })
  writeExec(join(v, 'salinha'), `#!/bin/sh\necho "${version} $*" >> "${out}"\n`)
  copyFileSync(LAUNCHER, join(v, 'salinha-launcher'))
  chmodSync(join(v, 'salinha-launcher'), 0o755)
  writeFileSync(join(v, 'salinha.png'), 'png')
}

function setProc(values: Record<string, string>): void {
  rmSync(procSys, { recursive: true, force: true })
  for (const [key, value] of Object.entries(values)) {
    mkdirSync(join(procSys, key, '..'), { recursive: true })
    writeFileSync(join(procSys, key), `${value}\n`)
  }
}

function setUnshare(ok: boolean): void {
  writeExec(join(fakeBin, 'unshare'), `#!/bin/sh\nexit ${ok ? 0 : 1}\n`)
}

function run(args: string[] = [], env: Record<string, string> = {}): string {
  return execFileSync(join(root, 'current', 'salinha-launcher'), args, {
    env: {
      PATH: `${fakeBin}:/usr/bin:/bin`,
      HOME: home,
      SALINHA_PROC_SYS: procSys,
      ...env
    },
    encoding: 'utf8'
  })
}

const launches = (): string[] =>
  existsSync(out) ? readFileSync(out, 'utf8').trim().split('\n') : []

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'salinha-launcher-'))
  root = join(dir, 'home', '.local', 'share', 'salinha')
  home = join(dir, 'home')
  out = join(dir, 'launches.txt')
  fakeBin = join(dir, 'bin')
  procSys = join(dir, 'proc-sys')
  mkdirSync(fakeBin, { recursive: true })
  addVersion('1.0.0')
  symlinkSync('versions/1.0.0', join(root, 'current'))
  setProc({ 'kernel/unprivileged_userns_clone': '1', 'user/max_user_namespaces': '1000' })
  setUnshare(true)
})

afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

describe('sandbox', () => {
  it('com user namespaces abre com o sandbox (sem --no-sandbox)', () => {
    run(['--hidden'])
    expect(launches()).toEqual(['1.0.0 --ozone-platform-hint=auto --hidden'])
  })

  it.each([
    ['sysctl do Debian desligado', { 'kernel/unprivileged_userns_clone': '0' }, true],
    ['max_user_namespaces = 0', { 'user/max_user_namespaces': '0' }, true],
    ['AppArmor do Ubuntu restringe', { 'kernel/apparmor_restrict_unprivileged_userns': '1' }, true],
    ['unshare falha', {}, false]
  ])('sem user namespaces (%s) cai para --no-sandbox', (_name, proc, unshareOk) => {
    setProc(proc)
    setUnshare(unshareOk)
    run()
    expect(launches()).toEqual(['1.0.0 --no-sandbox --ozone-platform-hint=auto'])
    expect(readFileSync(join(root, 'launcher.log'), 'utf8')).toMatch(/sem o sandbox/)
  })

  it('SALINHA_SANDBOX força os dois lados', () => {
    setUnshare(false)
    run([], { SALINHA_SANDBOX: '1' })
    setUnshare(true)
    run([], { SALINHA_SANDBOX: '0' })
    expect(launches()).toEqual([
      '1.0.0 --ozone-platform-hint=auto',
      '1.0.0 --no-sandbox --ozone-platform-hint=auto'
    ])
  })
})

describe('volta automática', () => {
  beforeEach(() => {
    addVersion('0.9.0')
    symlinkSync('versions/0.9.0', join(root, 'previous'))
    writeFileSync(join(root, 'boot-pending'), '1.0.0\n')
  })

  it('versão nova que não abre 3 vezes volta para a anterior', () => {
    run()
    run()
    run()
    expect(launches().map((l) => l.split(' ')[0])).toEqual(['1.0.0', '1.0.0', '0.9.0'])
    expect(readlinkSync(join(root, 'current'))).toBe('versions/0.9.0')
    expect(existsSync(join(root, 'boot-pending'))).toBe(false)
  })

  it('versão que confirmou a abertura (apagou boot-pending) fica', () => {
    run()
    rmSync(join(root, 'boot-pending'))
    run()
    run()
    expect(launches().map((l) => l.split(' ')[0])).toEqual(['1.0.0', '1.0.0', '1.0.0'])
  })
})

describe('--integrate', () => {
  it('cria ~/.local/bin/salinha e o atalho apontando para current', () => {
    run(['--integrate'])
    const stub = readFileSync(join(home, '.local/bin/salinha'), 'utf8')
    expect(stub).toContain(`exec '${root}/current/salinha-launcher' "$@"`)
    const desktop = readFileSync(join(home, '.local/share/applications/salinha.desktop'), 'utf8')
    expect(desktop).toContain(`Exec="${root}/current/salinha-launcher" %U`)
    expect(desktop).toContain(`Icon=${root}/icon.png`)
    expect(readFileSync(join(root, 'icon.png'), 'utf8')).toBe('png')
    expect(launches()).toEqual([])

    // O ~/.local/bin/salinha gerado abre o app.
    execFileSync(join(home, '.local/bin/salinha'), ['x'], {
      env: { PATH: `${fakeBin}:/usr/bin:/bin`, HOME: home, SALINHA_PROC_SYS: procSys }
    })
    expect(launches()).toEqual(['1.0.0 --ozone-platform-hint=auto x'])
  })

  it('guarda o lançador e o atalho do AppImage extraído em legacy/', () => {
    mkdirSync(join(home, '.local/bin'), { recursive: true })
    mkdirSync(join(home, '.local/share/applications'), { recursive: true })
    const old = '#!/bin/sh\nexec "$HOME/.local/opt/salinha/salinha" "$@"\n'
    writeFileSync(join(home, '.local/bin/salinha'), old)
    writeFileSync(join(home, '.local/share/applications/salinha.desktop'), '[Desktop Entry]\n')
    run(['--integrate'])
    const legacy = readdirSync(join(root, 'legacy'))
    expect(legacy.some((f) => f.startsWith('salinha.desktop.'))).toBe(true)
    const bin = legacy.find((f) => /^salinha\.\d+$/.test(f))
    expect(bin && readFileSync(join(root, 'legacy', bin), 'utf8')).toBe(old)
    expect(readFileSync(join(home, '.local/bin/salinha'), 'utf8')).toContain('X-Salinha-Managed')

    // Rodar de novo não guarda os próprios arquivos.
    run(['--integrate'])
    expect(readdirSync(join(root, 'legacy'))).toHaveLength(2)
  })
})
