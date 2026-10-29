import { afterEach, describe, expect, it, vi } from 'vitest'
import { useScreenSimulcastStore } from './screenSimulcastStore'
import { loadScreenSimulcast } from '../lib/screenSimulcast'

afterEach(() => vi.unstubAllGlobals())

describe('screenSimulcastStore', () => {
  it('marcar salva a preferência que a próxima live usa', () => {
    const data = new Map<string, string>()
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => data.set(k, v)
    })
    useScreenSimulcastStore.getState().setEnabled(true)
    expect(useScreenSimulcastStore.getState().enabled).toBe(true)
    expect(loadScreenSimulcast()).toBe(true)
    useScreenSimulcastStore.getState().setEnabled(false)
    expect(loadScreenSimulcast()).toBe(false)
  })
})
