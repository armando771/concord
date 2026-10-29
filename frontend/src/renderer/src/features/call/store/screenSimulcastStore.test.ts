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
    useScreenSimulcastStore.getState().setMode('on')
    expect(useScreenSimulcastStore.getState().mode).toBe('on')
    expect(loadScreenSimulcast()).toBe('on')
    useScreenSimulcastStore.getState().setMode('off')
    expect(loadScreenSimulcast()).toBe('off')
    useScreenSimulcastStore.getState().setMode('auto')
    expect(loadScreenSimulcast()).toBe('auto')
  })
})
