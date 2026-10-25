import { describe, expect, it } from 'vitest'
import {
  APP_USER_MODEL_ID,
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
    expect(shortcutFix(null, wanted, 'primary')).toBe('create')
  })

  it('atalho do instalador (AUMID sem CLSID): atualiza', () => {
    expect(shortcutFix({ target: exe, appUserModelId: APP_USER_MODEL_ID }, wanted, 'primary')).toBe(
      'update'
    )
  })

  it('CLSID diferente (ex.: aleatório de outra execução): atualiza', () => {
    const current = { ...wanted, toastActivatorClsid: '{00000000-0000-0000-0000-000000000000}' }
    expect(shortcutFix(current, wanted, 'primary')).toBe('update')
  })

  it('apontando para outro .exe: atualiza', () => {
    const current = { ...wanted, target: exe.replace('Salinha.exe', 'Concord.exe') }
    expect(shortcutFix(current, wanted, 'primary')).toBe('update')
  })

  it('atalho correto fica como está (maiúsculas e chaves não importam)', () => {
    expect(shortcutFix(wanted, wanted, 'primary')).toBeNull()
    const sameButCased = {
      target: exe.toUpperCase(),
      appUserModelId: APP_USER_MODEL_ID,
      toastActivatorClsid: TOAST_ACTIVATOR_CLSID.slice(1, -1).toLowerCase()
    }
    expect(shortcutFix(sameButCased, wanted, 'primary')).toBeNull()
  })
})

describe('shortcutFix: Concord.lnk antigo (nome de antes)', () => {
  it('não existe: não cria', () => {
    expect(shortcutFix(null, wanted, 'legacy')).toBeNull()
  })

  it('é nosso (mesmo AUMID) mas sem CLSID: atualiza para o .exe atual', () => {
    const old = {
      target: exe.replace('Salinha.exe', 'Concord.exe'),
      appUserModelId: APP_USER_MODEL_ID
    }
    expect(shortcutFix(old, wanted, 'legacy')).toBe('update')
  })

  it('de outro programa (outro AUMID ou nenhum): não mexe', () => {
    expect(
      shortcutFix(
        { target: 'C:\\Outro\\Concord.exe', appUserModelId: 'outro.app' },
        wanted,
        'legacy'
      )
    ).toBeNull()
    expect(shortcutFix({ target: 'C:\\Outro\\Concord.exe' }, wanted, 'legacy')).toBeNull()
  })

  it('já correto: fica como está', () => {
    expect(shortcutFix(wanted, wanted, 'legacy')).toBeNull()
  })
})
