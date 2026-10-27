import { afterEach, describe, expect, it, vi } from 'vitest'
import { initialShowMembers, MEMBERS_MIN_VIEWPORT } from './groupLayout'

describe('initialShowMembers', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('em tela larga a lista de membros já aparece', () => {
    vi.stubGlobal('window', { innerWidth: 1280 })
    expect(initialShowMembers()).toBe(true)
    vi.stubGlobal('window', { innerWidth: MEMBERS_MIN_VIEWPORT })
    expect(initialShowMembers()).toBe(true)
  })

  it('em tela estreita ela começa escondida (antes tomava 240 px dos 360 do chat)', () => {
    vi.stubGlobal('window', { innerWidth: 360 })
    expect(initialShowMembers()).toBe(false)
    vi.stubGlobal('window', { innerWidth: MEMBERS_MIN_VIEWPORT - 1 })
    expect(initialShowMembers()).toBe(false)
  })

  it('sem janela (renderização no servidor), mostra', () => {
    vi.stubGlobal('window', undefined)
    expect(initialShowMembers()).toBe(true)
  })
})
