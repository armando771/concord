import { execFileSync } from 'child_process'
import { createHash } from 'crypto'
import {
  chmodSync,
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
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// symlink exige privilégio no Windows; estas suítes cobrem só o Linux
const describeUnix = process.platform === 'win32' ? describe.skip : describe
import { LinuxUpdater, type LinuxUpdaterOptions } from './linuxUpdater'

const FEED = 'http://srv/updates/'

let dir: string
let home: string
let root: string
let files: Record<string, Buffer | string>
let integrated: string[]
let relaunched: Array<{ execPath: string; args: string[] }>
let quit: ReturnType<typeof vi.fn>

/** .tar.gz como o build-linux.sh gera (salinha, salinha-launcher, salinha-version). */
function tarball(version: string, opts: { versionFile?: string; exec?: boolean } = {}): Buffer {
  const src = mkdtempSync(join(dir, 'src-'))
  writeFileSync(join(src, 'salinha'), `#!/bin/sh\necho ${version}\n`)
  chmodSync(join(src, 'salinha'), opts.exec === false ? 0o644 : 0o755)
  writeFileSync(join(src, 'salinha-launcher'), '#!/bin/sh\n')
  chmodSync(join(src, 'salinha-launcher'), 0o755)
  mkdirSync(join(src, 'resources'))
  writeFileSync(join(src, 'resources', 'app.asar'), `app ${version}`)
  writeFileSync(join(src, 'salinha-version'), `${opts.versionFile ?? version}\n`)
  const out = join(dir, `t-${version}-${Math.random()}.tar.gz`)
  execFileSync('tar', ['-C', src, '-czf', out, '.'])
  return readFileSync(out)
}

function publish(
  version: string,
  data: Buffer,
  manifest: Partial<Record<string, string>> = {}
): void {
  const path = `Salinha-${version}-x64.tar.gz`
  files[path] = data
  files['latest-linux-tar.yml'] = [
    `version: ${manifest.version ?? version}`,
    `path: ${manifest.path ?? path}`,
    `sha512: ${manifest.sha512 ?? createHash('sha512').update(data).digest('hex')}`,
    `size: ${manifest.size ?? data.length}`
  ].join('\n')
}

function makeUpdater(over: Partial<LinuxUpdaterOptions> = {}): LinuxUpdater {
  return new LinuxUpdater({
    feedUrl: FEED,
    currentVersion: '1.0.0',
    execPath: join(root, 'versions', '1.0.0', 'salinha'),
    home,
    env: {},
    argv: ['--no-sandbox', '--hidden'],
    fetch: async (url: string) => {
      const name = decodeURIComponent(new URL(url).pathname.replace('/updates/', ''))
      const body = files[name]
      return body === undefined
        ? new Response('não achei', { status: 404 })
        : new Response(typeof body === 'string' ? body : new Uint8Array(body))
    },
    relaunch: (o) => relaunched.push(o),
    quit,
    runIntegrate: (launcher) => integrated.push(launcher),
    ...over
  })
}

/** Instalação por usuário com a 1.0.0 rodando. */
function installCurrent(): void {
  const v = join(root, 'versions', '1.0.0')
  mkdirSync(v, { recursive: true })
  writeFileSync(join(v, 'salinha'), '')
  symlinkSync('versions/1.0.0', join(root, 'current'))
}

async function events(u: LinuxUpdater): Promise<Array<[string, unknown]>> {
  const seen: Array<[string, unknown]> = []
  for (const name of ['update-available', 'download-progress', 'update-downloaded', 'error'])
    u.on(name, (v: unknown) => seen.push([name, v]))
  return seen
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'salinha-updater-'))
  home = join(dir, 'home')
  root = join(home, '.local', 'share', 'salinha')
  files = {}
  integrated = []
  relaunched = []
  quit = vi.fn()
  installCurrent()
})

afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

describeUnix('checkForUpdates', () => {
  it('avisa versão nova do manifesto', async () => {
    publish('1.0.1', tarball('1.0.1'))
    const u = makeUpdater()
    const seen = await events(u)
    await u.checkForUpdates()
    expect(seen).toEqual([
      [
        'update-available',
        {
          version: '1.0.1',
          path: 'Salinha-1.0.1-x64.tar.gz',
          sha512: expect.stringMatching(/^[0-9a-f]{128}$/)
        }
      ]
    ])
  })

  it('não avisa a mesma versão na instalação por usuário', async () => {
    publish('1.0.0', tarball('1.0.0'))
    const u = makeUpdater()
    const seen = await events(u)
    await u.checkForUpdates()
    expect(seen).toEqual([])
  })

  it('AppImage extraído: a mesma versão vira migração', async () => {
    publish('1.0.0', tarball('1.0.0'))
    const u = makeUpdater({ execPath: join(home, '.local/opt/salinha/salinha') })
    const seen = await events(u)
    await u.checkForUpdates()
    expect(seen).toEqual([['update-available', expect.objectContaining({ version: '1.0.0' })]])
  })

  it('manifesto ausente ou inválido falha a checagem', async () => {
    await expect(makeUpdater().checkForUpdates()).rejects.toThrow()
    files['latest-linux-tar.yml'] = 'version: 9.9.9\npath: ../x\n'
    await expect(makeUpdater().checkForUpdates()).rejects.toThrow(/manifesto/)
  })
})

describeUnix('downloadUpdate', () => {
  it('baixa, confere o sha512 e entrega o arquivo', async () => {
    const data = tarball('1.0.1')
    publish('1.0.1', data)
    const u = makeUpdater()
    const seen = await events(u)
    await u.checkForUpdates()
    await u.downloadUpdate()
    const done = seen.find(([n]) => n === 'update-downloaded')?.[1] as {
      version: string
      downloadedFile: string
    }
    expect(done.version).toBe('1.0.1')
    expect(done.downloadedFile).toBe(join(root, 'downloads', 'Salinha-1.0.1-x64.tar.gz'))
    expect(readFileSync(done.downloadedFile).equals(data)).toBe(true)
    expect(
      seen.some(([n, v]) => n === 'download-progress' && (v as { percent: number }).percent === 100)
    ).toBe(true)
  })

  it('sha512 que não bate: recusa e apaga o arquivo', async () => {
    publish('1.0.1', tarball('1.0.1'), { sha512: 'cd'.repeat(64) })
    const u = makeUpdater()
    const seen = await events(u)
    await u.checkForUpdates()
    await expect(u.downloadUpdate()).rejects.toThrow(/sha512/)
    expect(seen.some(([n]) => n === 'error')).toBe(true)
    expect(seen.some(([n]) => n === 'update-downloaded')).toBe(false)
    expect(readdirSync(join(root, 'downloads'))).toEqual([])
  })

  it('tamanho que não bate: recusa', async () => {
    const data = tarball('1.0.1')
    publish('1.0.1', data, { size: String(data.length + 1) })
    const u = makeUpdater()
    await events(u)
    await u.checkForUpdates()
    await expect(u.downloadUpdate()).rejects.toThrow(/tamanho/)
  })
})

describeUnix('stage', () => {
  async function downloaded(data: Buffer, version = '1.0.1'): Promise<[LinuxUpdater, string]> {
    publish(version, data)
    const u = makeUpdater()
    let file = ''
    u.on('update-downloaded', (e: { downloadedFile: string }) => (file = e.downloadedFile))
    await u.checkForUpdates()
    await u.downloadUpdate()
    return [u, file]
  }

  it('extrai para versions/<versão>', async () => {
    const [u, file] = await downloaded(tarball('1.0.1'))
    await u.stage({ version: '1.0.1', downloadedFile: file })
    expect(readFileSync(join(root, 'versions/1.0.1/resources/app.asar'), 'utf8')).toBe('app 1.0.1')
    expect(readdirSync(join(root, 'versions')).sort()).toEqual(['1.0.0', '1.0.1'])
  })

  it('recusa pacote cuja versão interna não é a do manifesto (downgrade)', async () => {
    const [u, file] = await downloaded(tarball('1.0.1', { versionFile: '0.9.0' }))
    await expect(u.stage({ version: '1.0.1', downloadedFile: file })).rejects.toThrow(/versão/)
    expect(readdirSync(join(root, 'versions'))).toEqual(['1.0.0'])
  })

  it('recusa pacote sem executável', async () => {
    const [u, file] = await downloaded(tarball('1.0.1', { exec: false }))
    await expect(u.stage({ version: '1.0.1', downloadedFile: file })).rejects.toThrow()
    expect(readdirSync(join(root, 'versions'))).toEqual(['1.0.0'])
  })

  it('extrai dos bytes já conferidos, não do arquivo relido do disco', async () => {
    const data = tarball('1.0.1')
    const [u, file] = await downloaded(data)
    writeFileSync(file, 'trocado depois da verificação')
    await u.stage({ version: '1.0.1', downloadedFile: file }, data)
    expect(readFileSync(join(root, 'versions/1.0.1/resources/app.asar'), 'utf8')).toBe('app 1.0.1')
  })

  it('arquivo corrompido não deixa nada para trás', async () => {
    const [u, file] = await downloaded(tarball('1.0.1'))
    writeFileSync(file, 'não é gzip')
    await expect(u.stage({ version: '1.0.1', downloadedFile: file })).rejects.toThrow()
    expect(readdirSync(join(root, 'versions'))).toEqual(['1.0.0'])
  })
})

describeUnix('quitAndInstall', () => {
  it('troca current, guarda previous, integra e reabre pelo lançador', async () => {
    publish('1.0.1', tarball('1.0.1'))
    const u = makeUpdater()
    let file = ''
    u.on('update-downloaded', (e: { downloadedFile: string }) => (file = e.downloadedFile))
    await u.checkForUpdates()
    await u.downloadUpdate()
    await u.stage({ version: '1.0.1', downloadedFile: file })
    u.quitAndInstall()
    expect(readlinkSync(join(root, 'current'))).toBe('versions/1.0.1')
    expect(readlinkSync(join(root, 'previous'))).toBe('versions/1.0.0')
    expect(readFileSync(join(root, 'boot-pending'), 'utf8')).toBe('1.0.1\n')
    expect(integrated).toEqual([join(root, 'current', 'salinha-launcher')])
    expect(relaunched).toEqual([
      { execPath: join(root, 'current', 'salinha-launcher'), args: ['--hidden'] }
    ])
    expect(quit).toHaveBeenCalledOnce()
  })

  it('sem versão preparada não mexe em nada', () => {
    const u = makeUpdater()
    expect(() => u.quitAndInstall()).toThrow()
    expect(readlinkSync(join(root, 'current'))).toBe('versions/1.0.0')
    expect(quit).not.toHaveBeenCalled()
  })

  it('migração do AppImage extraído cria a instalação do zero', async () => {
    rmSync(root, { recursive: true })
    publish('1.0.0', tarball('1.0.0'))
    const u = makeUpdater({ execPath: join(home, '.local/opt/salinha/salinha') })
    let file = ''
    u.on('update-downloaded', (e: { downloadedFile: string }) => (file = e.downloadedFile))
    await u.checkForUpdates()
    await u.downloadUpdate()
    await u.stage({ version: '1.0.0', downloadedFile: file })
    u.quitAndInstall()
    expect(readlinkSync(join(root, 'current'))).toBe('versions/1.0.0')
    expect(existsSync(join(root, 'previous'))).toBe(false)
    expect(relaunched[0].execPath).toBe(join(root, 'current', 'salinha-launcher'))
  })
})

describeUnix('confirmStartup', () => {
  it('confirma a abertura e apaga versões antigas e downloads', () => {
    for (const v of ['0.8.0', '0.9.0']) mkdirSync(join(root, 'versions', v))
    mkdirSync(join(root, 'versions', '.staging-1.0.1-42'))
    symlinkSync('versions/0.9.0', join(root, 'previous'))
    mkdirSync(join(root, 'downloads'))
    writeFileSync(join(root, 'downloads', 'Salinha-1.0.0-x64.tar.gz'), 'x')
    writeFileSync(join(root, 'boot-pending'), '1.0.0\nx\n')
    makeUpdater().confirmStartup()
    expect(existsSync(join(root, 'boot-pending'))).toBe(false)
    expect(readdirSync(join(root, 'versions')).sort()).toEqual(['0.9.0', '1.0.0'])
    expect(readdirSync(join(root, 'downloads'))).toEqual([])
  })

  it('boot-pending de outra versão (voltou atrás) não é confirmado', () => {
    writeFileSync(join(root, 'boot-pending'), '1.0.1\n')
    makeUpdater().confirmStartup()
    expect(existsSync(join(root, 'boot-pending'))).toBe(true)
  })

  it('fora da instalação por usuário não mexe em nada', () => {
    writeFileSync(join(root, 'boot-pending'), '1.0.0\n')
    makeUpdater({ execPath: join(home, '.local/opt/salinha/salinha') }).confirmStartup()
    expect(existsSync(join(root, 'boot-pending'))).toBe(true)
  })
})

describeUnix('versão que voltou atrás (C1)', () => {
  const LAUNCHER = join(__dirname, '../../build/linux/salinha-launcher')

  function fakeVersion(version: string): void {
    const v = join(root, 'versions', version)
    mkdirSync(v, { recursive: true })
    writeFileSync(join(v, 'salinha'), `#!/bin/sh\nexit ${version === '1.0.1' ? 1 : 0}\n`)
    chmodSync(join(v, 'salinha'), 0o755)
    writeFileSync(join(v, 'salinha-launcher'), readFileSync(LAUNCHER))
    chmodSync(join(v, 'salinha-launcher'), 0o755)
    writeFileSync(join(v, 'salinha-version'), `${version}\n`)
  }

  it('depois da volta automática a versão ruim não é oferecida nem instalada de novo', async () => {
    // 1.0.1 instalada por cima da 1.0.0 e não abre.
    rmSync(join(root, 'current'))
    fakeVersion('1.0.1')
    writeFileSync(join(root, 'versions/1.0.0/salinha'), '#!/bin/sh\nexit 0\n')
    chmodSync(join(root, 'versions/1.0.0/salinha'), 0o755)
    symlinkSync('versions/1.0.1', join(root, 'current'))
    symlinkSync('versions/1.0.0', join(root, 'previous'))
    writeFileSync(join(root, 'boot-pending'), '1.0.1\n')
    mkdirSync(join(root, 'downloads'))
    const data = tarball('1.0.1')
    writeFileSync(join(root, 'downloads', 'Salinha-1.0.1-x64.tar.gz'), data)
    for (let i = 0; i < 3; i++) {
      try {
        execFileSync(join(root, 'current', 'salinha-launcher'), [], {
          env: { PATH: '/usr/bin:/bin', HOME: home, SALINHA_SANDBOX: '1' }
        })
      } catch {
        // a 1.0.1 sai com erro
      }
    }
    expect(readlinkSync(join(root, 'current'))).toBe('versions/1.0.0')

    // A 1.0.0 abre e checa: o servidor ainda oferece a 1.0.1.
    publish('1.0.1', data)
    const u = makeUpdater()
    const seen = await events(u)
    expect(await u.checkForUpdates()).toBeNull()
    expect(seen).toEqual([])
    expect(u.canAutoInstall('1.0.1')).toBe(false)
    expect(existsSync(join(root, 'versions', '1.0.1'))).toBe(false)
    expect(existsSync(join(root, 'downloads', 'Salinha-1.0.1-x64.tar.gz'))).toBe(false)

    // Uma correção (1.0.2) é oferecida e a lista de versões ruins é esquecida.
    publish('1.0.2', tarball('1.0.2'))
    expect((await u.checkForUpdates())?.version).toBe('1.0.2')
    expect(existsSync(join(root, 'bad-versions'))).toBe(false)
    expect(u.canAutoInstall('1.0.2')).toBe(true)
  })

  it('a mesma versão (migração) só instala com clique', () => {
    expect(makeUpdater().canAutoInstall('1.0.0')).toBe(false)
  })
})
