import { afterEach, describe, expect, it, vi } from 'vitest'
import { useScreenCodecStore } from './screenCodecStore'
import { loadScreenCodec, SCREEN_CODEC_KEY } from '../lib/screenCodec'

afterEach(() => vi.unstubAllGlobals())

describe('screenCodecStore', () => {
  it('escolher VP8 salva a preferência que a próxima live usa', () => {
    const data = new Map<string, string>()
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => data.set(k, v)
    })
    useScreenCodecStore.getState().setPreference('vp8')
    expect(useScreenCodecStore.getState().preference).toBe('vp8')
    expect(data.get(SCREEN_CODEC_KEY)).toBe('vp8')
    expect(loadScreenCodec()).toBe('vp8')
    useScreenCodecStore.getState().setPreference('auto')
    expect(loadScreenCodec()).toBe('auto')
  })
})
