import { describe, expect, it } from 'vitest'
import {
  badVersionCheck,
  compareVersions,
  parseBadVersions,
  sandboxNoticeReason,
  defaultInstallRoot,
  downloadsToPrune,
  managedRootOf,
  parseLinuxManifest,
  relaunchArgs,
  shouldOfferLinuxUpdate,
  updateBackendKind,
  versionsToPrune
} from './linuxInstall'

const SHA = 'ab'.repeat(64)

describe('updateBackendKind', () => {
  const managed = '/home/a/.local/share/salinha/versions/0.7.1/salinha'

  it('Windows e AppImage montado continuam no electron-updater', () => {
    expect(updateBackendKind('win32', {}, 'C:/Salinha/Salinha.exe')).toBe('electron-updater')
    expect(
      updateBackendKind(
        'linux',
        { APPIMAGE: '/home/a/Salinha.AppImage', APPDIR: '/tmp/.mount_Salinh1' },
        '/tmp/.mount_Salinh1/salinha'
      )
    ).toBe('electron-updater')
  })

  it('Linux sem AppImage (extraído ou instalação por usuário) usa o updater próprio', () => {
    expect(updateBackendKind('linux', {}, managed)).toBe('linux-managed')
    expect(updateBackendKind('linux', { APPIMAGE: '' }, '/opt/x/salinha')).toBe('linux-managed')
  })

  it('APPIMAGE herdado de outro app (terminal de um AppImage) não engana', () => {
    // Instalação por usuário: sempre o updater próprio.
    expect(
      updateBackendKind(
        'linux',
        { APPIMAGE: '/home/a/Editor.AppImage', APPDIR: '/tmp/.mount_Editor' },
        managed
      )
    ).toBe('linux-managed')
    // Executável fora do APPDIR (ou sem APPDIR): não é este AppImage montado.
    expect(
      updateBackendKind(
        'linux',
        { APPIMAGE: '/home/a/Editor.AppImage', APPDIR: '/tmp/.mount_Editor' },
        '/home/a/.local/opt/salinha/salinha'
      )
    ).toBe('linux-managed')
    expect(updateBackendKind('linux', { APPIMAGE: '/home/a/Editor.AppImage' }, '/x/salinha')).toBe(
      'linux-managed'
    )
    // APPDIR "/tmp/.mount_Ed" não contém "/tmp/.mount_Editor/salinha" por prefixo de texto.
    expect(
      updateBackendKind(
        'linux',
        { APPIMAGE: '/a.AppImage', APPDIR: '/tmp/.mount_Ed' },
        '/tmp/.mount_Editor/salinha'
      )
    ).toBe('linux-managed')
  })
})

describe('versões que voltaram atrás (bad-versions)', () => {
  it('lê uma versão por linha, ignorando lixo', () => {
    expect(parseBadVersions('0.7.1\n\nlixo\n0.7.2\r\n')).toEqual(['0.7.1', '0.7.2'])
  })

  it('não oferece versão que já voltou atrás', () => {
    expect(badVersionCheck(['0.7.1'], '0.7.1')).toEqual({ skip: true, clear: false })
  })

  it('versão estritamente mais nova que todas as ruins é oferecida e limpa a lista', () => {
    expect(badVersionCheck(['0.7.1'], '0.7.2')).toEqual({ skip: false, clear: true })
    expect(badVersionCheck(['0.7.1', '0.7.3'], '0.7.2')).toEqual({ skip: false, clear: false })
    expect(badVersionCheck([], '0.7.2')).toEqual({ skip: false, clear: false })
  })
})

describe('sandboxNoticeReason', () => {
  it('avisa no Linux quando o lançador abriu sem o sandbox', () => {
    expect(sandboxNoticeReason('linux', { SALINHA_SANDBOX_OFF: 'apparmor' })).toBe('apparmor')
  })

  it('sem o aviso do lançador, ou fora do Linux, nada', () => {
    expect(sandboxNoticeReason('linux', {})).toBeNull()
    expect(sandboxNoticeReason('linux', { SALINHA_SANDBOX_OFF: '' })).toBeNull()
    expect(sandboxNoticeReason('win32', { SALINHA_SANDBOX_OFF: 'apparmor' })).toBeNull()
  })
})

describe('defaultInstallRoot', () => {
  it('fica em ~/.local/share/salinha, respeitando XDG_DATA_HOME absoluto', () => {
    expect(defaultInstallRoot({}, '/home/a')).toBe('/home/a/.local/share/salinha')
    expect(defaultInstallRoot({ XDG_DATA_HOME: '/dados' }, '/home/a')).toBe('/dados/salinha')
    // relativo é inválido pela especificação XDG: ignora
    expect(defaultInstallRoot({ XDG_DATA_HOME: 'rel' }, '/home/a')).toBe(
      '/home/a/.local/share/salinha'
    )
  })
})

describe('managedRootOf', () => {
  it('reconhece <raiz>/versions/<versão>/salinha', () => {
    expect(managedRootOf('/home/a/.local/share/salinha/versions/0.7.1/salinha')).toBe(
      '/home/a/.local/share/salinha'
    )
  })

  it('AppImage extraído e outros caminhos não são instalação por usuário', () => {
    expect(managedRootOf('/home/a/.local/opt/salinha/salinha')).toBeNull()
    expect(managedRootOf('/home/a/versions/salinha')).toBeNull()
    expect(managedRootOf('/r/versions/.staging-0.7.1/salinha')).toBeNull()
    expect(managedRootOf('/r/versions/0.7.1/electron')).toBeNull()
  })
})

describe('compareVersions', () => {
  it('compara x.y.z numericamente', () => {
    expect(compareVersions('0.6.12', '0.6.9')).toBeGreaterThan(0)
    expect(compareVersions('0.7.0', '0.7.0')).toBe(0)
    expect(compareVersions('0.7.0', '1.0.0')).toBeLessThan(0)
  })

  it('versão inválida nunca é mais nova', () => {
    expect(compareVersions('lixo', '0.1.0')).toBeLessThan(0)
  })
})

describe('shouldOfferLinuxUpdate', () => {
  it('oferece versão mais nova', () => {
    expect(shouldOfferLinuxUpdate({ current: '0.7.0', latest: '0.7.1', managed: true })).toBe(true)
  })

  it('não oferece a mesma versão nem uma mais velha para quem já está instalado', () => {
    expect(shouldOfferLinuxUpdate({ current: '0.7.1', latest: '0.7.1', managed: true })).toBe(false)
    expect(shouldOfferLinuxUpdate({ current: '0.7.1', latest: '0.7.0', managed: false })).toBe(
      false
    )
  })

  it('fora da instalação por usuário (AppImage extraído), a mesma versão migra', () => {
    expect(shouldOfferLinuxUpdate({ current: '0.7.1', latest: '0.7.1', managed: false })).toBe(true)
  })
})

describe('parseLinuxManifest', () => {
  const valid = `version: 0.7.1\npath: Salinha-0.7.1-x64.tar.gz\nsha512: ${SHA}\nsize: 123456\nreleaseDate: '2026-10-25T10:00:00Z'\n`

  it('lê o manifesto gerado pelo release-linux.sh', () => {
    expect(parseLinuxManifest(valid)).toEqual({
      version: '0.7.1',
      path: 'Salinha-0.7.1-x64.tar.gz',
      sha512: SHA,
      size: 123456
    })
  })

  it('aceita aspas e CRLF', () => {
    const text = `version: '0.7.1'\r\npath: "Salinha-0.7.1-x64.tar.gz"\r\nsha512: ${SHA.toUpperCase()}\r\nsize: 9\r\n`
    expect(parseLinuxManifest(text)?.sha512).toBe(SHA)
  })

  it('recusa caminho externo, hash ou tamanho inválidos, versão divergente', () => {
    const bad = [
      valid.replace('size: 123456', `size: ${2 * 1024 ** 3}`),
      valid.replace('path: Salinha-0.7.1-x64.tar.gz', 'path: ../Salinha-0.7.1-x64.tar.gz'),
      valid.replace('path: Salinha-0.7.1-x64.tar.gz', 'path: https://evil.test/a.tar.gz'),
      valid.replace('path: Salinha-0.7.1-x64.tar.gz', 'path: Salinha-0.7.0-x64.tar.gz'),
      valid.replace(SHA, 'abc'),
      valid.replace('size: 123456', 'size: -1'),
      valid.replace('version: 0.7.1', 'version: 0.7'),
      ''
    ]
    for (const text of bad) expect(parseLinuxManifest(text)).toBeNull()
  })
})

describe('relaunchArgs', () => {
  it('tira as flags que o lançador acrescenta (ele decide de novo)', () => {
    expect(
      relaunchArgs(['--no-sandbox', '--ozone-platform-hint=auto', '--hidden', 'salinha://x'])
    ).toEqual(['--hidden', 'salinha://x'])
  })
})

describe('versionsToPrune', () => {
  it('apaga versões mais velhas que a atual, menos a anterior, e restos de extração', () => {
    expect(
      versionsToPrune(['0.6.0', '0.7.0', '0.7.1', '.staging-0.7.2-99', 'lixo'], {
        current: '0.7.1',
        previous: '0.7.0',
        pid: 1
      })
    ).toEqual(['0.6.0', '.staging-0.7.2-99'])
  })

  it('mantém versão mais nova já preparada e a extração em andamento', () => {
    expect(
      versionsToPrune(['0.7.1', '0.7.2', '.staging-0.7.3-42'], {
        current: '0.7.1',
        previous: null,
        pid: 42
      })
    ).toEqual([])
  })
})

describe('downloadsToPrune', () => {
  it('apaga pacotes até a versão atual; mantém os mais novos (cache ou baixando)', () => {
    expect(
      downloadsToPrune(
        [
          'Salinha-0.7.0-x64.tar.gz',
          'Salinha-0.7.1-x64.tar.gz.part',
          'Salinha-0.7.2-x64.tar.gz',
          'Salinha-0.7.2-x64.tar.gz.part',
          'outro.txt'
        ],
        '0.7.1'
      )
    ).toEqual(['Salinha-0.7.0-x64.tar.gz', 'Salinha-0.7.1-x64.tar.gz.part'])
  })
})
