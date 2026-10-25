import { afterEach, describe, expect, it, vi } from 'vitest'
import { APP_UPDATE_EVENT, requestUpdateCheck } from './appUpdate'

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
