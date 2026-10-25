import { afterEach, describe, expect, it, vi } from 'vitest'
import { APP_UPDATE_EVENT, requestUpdateCheck, updateFromErrorScreen } from './appUpdate'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('requestUpdateCheck', () => {
  it('no desktop, pede ao main para checar agora', () => {
    const checkNow = vi.fn()
    vi.stubGlobal('window', { api: { updates: { checkNow } } })
    requestUpdateCheck()
    expect(checkNow).toHaveBeenCalledTimes(1)
  })

  it('na web (sem window.api.updates), ignora', () => {
    vi.stubGlobal('window', {})
    expect(() => requestUpdateCheck()).not.toThrow()
    vi.stubGlobal('window', { api: {} })
    expect(() => requestUpdateCheck()).not.toThrow()
  })

  it('o evento do servidor é app:update', () => {
    expect(APP_UPDATE_EVENT).toBe('app:update')
  })
})

describe('updateFromErrorScreen', () => {
  it('com versão nova conhecida, instala', async () => {
    const install = vi.fn()
    const checkNow = vi.fn()
    const status = vi.fn().mockResolvedValue({ version: '0.7.0', ready: false })
    vi.stubGlobal('window', { api: { updates: { status, install, checkNow } } })
    expect(await updateFromErrorScreen()).toBe('installing')
    expect(install).toHaveBeenCalledOnce()
    expect(checkNow).not.toHaveBeenCalled()
  })

  it('sem versão nova, pede checagem', async () => {
    const install = vi.fn()
    const checkNow = vi.fn()
    const status = vi.fn().mockResolvedValue(null)
    vi.stubGlobal('window', { api: { updates: { status, install, checkNow } } })
    expect(await updateFromErrorScreen()).toBe('checking')
    expect(install).not.toHaveBeenCalled()
    expect(checkNow).toHaveBeenCalledOnce()
  })

  it('status falhando ainda checa', async () => {
    const checkNow = vi.fn()
    const status = vi.fn().mockRejectedValue(new Error('no handler'))
    vi.stubGlobal('window', { api: { updates: { status, install: vi.fn(), checkNow } } })
    expect(await updateFromErrorScreen()).toBe('checking')
    expect(checkNow).toHaveBeenCalledOnce()
  })

  it('na web, indisponível', async () => {
    vi.stubGlobal('window', {})
    expect(await updateFromErrorScreen()).toBe('unavailable')
  })
})
