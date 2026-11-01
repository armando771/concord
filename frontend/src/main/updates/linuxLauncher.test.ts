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

// symlink exige privilégio no Windows; estas suítes cobrem só o Linux
const describeUnix = process.platform === 'win32' ? describe.skip : describe

const LAUNCHER = resolve(__dirname, '../../../build/linux/salinha-launcher')

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
  writeExec(
    join(v, 'salinha'),
    `#!/bin/sh\necho "${version} $*" >> "${out}"\n` +
      `echo "\${APPIMAGE-unset}|\${APPDIR-unset}|\${SALINHA_SANDBOX_OFF-unset}" >> "${out}.env"\n`
  )
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

const envs = (): string[] => readFileSync(`${out}.env`, 'utf8').trim().split('\n')

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

describeUnix('sandbox', () => {
  it('com user namespaces abre com o sandbox (sem --no-sandbox)', () => {
    run(['--hidden'])
    expect(launches()).toEqual(['1.0.0 --ozone-platform-hint=auto --hidden'])
    expect(envs()).toEqual(['unset|unset|unset'])
  })

  it('não repassa APPIMAGE/APPDIR herdados de outro AppImage nem um aviso velho', () => {
    run([], { APPIMAGE: '/a/Editor.AppImage', APPDIR: '/tmp/.mount_Ed', SALINHA_SANDBOX_OFF: 'x' })
    expect(envs()).toEqual(['unset|unset|unset'])
  })

  it('AppArmor restringe, mas o perfil da Salinha está instalado: sandbox ligado', () => {
    const apparmor = join(dir, 'apparmor.d')
    mkdirSync(apparmor)
    writeFileSync(
      join(apparmor, 'salinha'),
      `profile salinha "${root}/versions/*/salinha" flags=(unconfined) {\n  userns,\n}\n`
    )
    setProc({ 'kernel/apparmor_restrict_unprivileged_userns': '1' })
    setUnshare(false) // o shell não tem o perfil: o teste com unshare falharia
    run([], { SALINHA_APPARMOR_D: apparmor })
    expect(launches()).toEqual(['1.0.0 --ozone-platform-hint=auto'])
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
    // O app recebe o motivo para avisar a pessoa uma vez.
    expect(envs()[0]).toMatch(/^unset\|unset\|(userns-off|apparmor|userns-blocked)$/)
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

describeUnix('volta automática', () => {
  beforeEach(() => {
    addVersion('0.9.0')
    symlinkSync('versions/0.9.0', join(root, 'previous'))
    writeFileSync(join(root, 'boot-pending'), '1.0.0\n')
  })

  it('versão nova que não abre em 2 partidas: a 3ª volta para a anterior e anota a ruim', () => {
    mkdirSync(join(root, 'downloads'))
    writeFileSync(join(root, 'downloads', 'Salinha-1.0.0-x64.tar.gz'), 'x')
    run()
    run()
    run()
    expect(launches().map((l) => l.split(' ')[0])).toEqual(['1.0.0', '1.0.0', '0.9.0'])
    expect(readlinkSync(join(root, 'current'))).toBe('versions/0.9.0')
    expect(existsSync(join(root, 'boot-pending'))).toBe(false)
    // A volta é definitiva: versão anotada e arquivos dela apagados.
    expect(readFileSync(join(root, 'bad-versions'), 'utf8')).toBe('1.0.0\n')
    expect(existsSync(join(root, 'versions', '1.0.0'))).toBe(false)
    expect(existsSync(join(root, 'downloads', 'Salinha-1.0.0-x64.tar.gz'))).toBe(false)
    expect(existsSync(join(root, 'previous'))).toBe(false)
    // Próximas partidas seguem na anterior.
    run()
    expect(launches().at(-1)?.split(' ')[0]).toBe('0.9.0')
  })

  it('partidas com a Salinha já aberta (instância única) não contam como falha', () => {
    const config = join(home, '.config', 'Concord')
    mkdirSync(config, { recursive: true })
    symlinkSync(`host-name-${process.pid}`, join(config, 'SingletonLock'))
    run()
    run()
    run()
    expect(readFileSync(join(root, 'boot-pending'), 'utf8')).toBe('1.0.0\n')
    expect(readlinkSync(join(root, 'current'))).toBe('versions/1.0.0')
  })

  it('versão que confirmou a abertura (apagou boot-pending) fica', () => {
    run()
    rmSync(join(root, 'boot-pending'))
    run()
    run()
    expect(launches().map((l) => l.split(' ')[0])).toEqual(['1.0.0', '1.0.0', '1.0.0'])
  })
})

describeUnix('--integrate', () => {
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

  it('escapa o caminho no Exec do atalho (espaço, $, aspas)', () => {
    const odd = join(dir, 'casa $x "y"', '.local', 'share', 'salinha')
    mkdirSync(join(odd, 'versions'), { recursive: true })
    execFileSync('cp', ['-a', join(root, 'versions', '1.0.0'), join(odd, 'versions')])
    symlinkSync('versions/1.0.0', join(odd, 'current'))
    execFileSync(join(odd, 'current', 'salinha-launcher'), ['--integrate'], {
      env: { PATH: '/usr/bin:/bin', HOME: home }
    })
    const desktop = readFileSync(join(home, '.local/share/applications/salinha.desktop'), 'utf8')
    const exec = desktop.split('\n').find((l) => l.startsWith('Exec='))
    expect(exec).toBe(
      `Exec="${odd.replace('$x', '\\\\$x').replace(/"/g, '\\\\"')}/current/salinha-launcher" %U`
    )
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
