import { describe, expect, it } from 'vitest'
import {
  APP_USER_MODEL_ID,
  isOurLegacyShortcut,
  shortcutFix,
  TOAST_ACTIVATOR_CLSID,
  toastSetupNeeded
} from './toastPolicy'

const exe = 'C:\\Users\\ana\\AppData\\Local\\Programs\\concord\\Salinha.exe'
const wanted = {
  target: exe,
  appUserModelId: APP_USER_MODEL_ID,
  toastActivatorClsid: TOAST_ACTIVATOR_CLSID
}

describe('toastSetupNeeded', () => {
  it('só no Windows instalado (nem dev, nem portable)', () => {
    expect(toastSetupNeeded({ platform: 'win32', packaged: true, portable: false })).toBe(true)
    expect(toastSetupNeeded({ platform: 'win32', packaged: false, portable: false })).toBe(false)
    expect(toastSetupNeeded({ platform: 'win32', packaged: true, portable: true })).toBe(false)
    expect(toastSetupNeeded({ platform: 'linux', packaged: true, portable: false })).toBe(false)
  })
})

describe('TOAST_ACTIVATOR_CLSID', () => {
  it('é um GUID com chaves (formato que o Electron prefere)', () => {
    expect(TOAST_ACTIVATOR_CLSID).toMatch(
      /^\{[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}\}$/
    )
  })
})

describe('shortcutFix: atalho Salinha.lnk do Menu Iniciar', () => {
  it('sem atalho: cria', () => {
    expect(shortcutFix(null, wanted)).toBe('create')
  })

  it('atalho do instalador (AUMID sem CLSID): atualiza', () => {
    expect(shortcutFix({ target: exe, appUserModelId: APP_USER_MODEL_ID }, wanted)).toBe('update')
  })

  it('CLSID diferente (ex.: aleatório de outra execução): atualiza', () => {
    const current = { ...wanted, toastActivatorClsid: '{00000000-0000-0000-0000-000000000000}' }
    expect(shortcutFix(current, wanted)).toBe('update')
  })

  it('apontando para outro .exe: atualiza', () => {
    const current = { ...wanted, target: exe.replace('Salinha.exe', 'Concord.exe') }
    expect(shortcutFix(current, wanted)).toBe('update')
  })

  it('atalho correto fica como está (maiúsculas e chaves não importam)', () => {
    expect(shortcutFix(wanted, wanted)).toBeNull()
    const sameButCased = {
      target: exe.toUpperCase(),
      appUserModelId: APP_USER_MODEL_ID,
      toastActivatorClsid: TOAST_ACTIVATOR_CLSID.slice(1, -1).toLowerCase()
    }
    expect(shortcutFix(sameButCased, wanted)).toBeNull()
  })
})

describe('isOurLegacyShortcut: Concord.lnk antigo (nome de antes)', () => {
  const concordExe = exe.replace('Salinha.exe', 'Concord.exe')

  it('com o nosso AUMID é nosso (vai ser apagado)', () => {
    expect(
      isOurLegacyShortcut(
        { target: 'D:\\outro\\Concord.exe', appUserModelId: APP_USER_MODEL_ID },
        exe
      )
    ).toBe(true)
  })

  it('apontando para a nossa pasta de instalação é nosso, mesmo sem AUMID', () => {
    expect(isOurLegacyShortcut({ target: concordExe }, exe)).toBe(true)
    expect(isOurLegacyShortcut({ target: exe.toUpperCase() }, exe)).toBe(true)
  })

  it('de outro programa (outro AUMID e outra pasta): não mexe', () => {
    expect(
      isOurLegacyShortcut({ target: 'C:\\Outro\\Concord.exe', appUserModelId: 'outro.app' }, exe)
    ).toBe(false)
    expect(isOurLegacyShortcut({ target: 'C:\\Outro\\Concord.exe' }, exe)).toBe(false)
  })
})
