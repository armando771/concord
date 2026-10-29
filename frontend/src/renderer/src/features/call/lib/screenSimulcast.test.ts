import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  SIMULCAST_KEY,
  loadScreenSimulcast,
  saveScreenSimulcast,
  screenSenderEncodings,
  usesSimulcast
} from './screenSimulcast'

afterEach(() => vi.unstubAllGlobals())

const fullHd = { width: 1920, height: 1080 }

describe('usesSimulcast', () => {
  it('só com a opção marcada e captura acima de 720p', () => {
    expect(usesSimulcast(true, { resolution: '1080p', frameRate: 60 }, fullHd)).toBe(true)
    expect(usesSimulcast(false, { resolution: '1080p', frameRate: 60 }, fullHd)).toBe(false)
    expect(usesSimulcast(true, { resolution: '720p', frameRate: 60 }, fullHd)).toBe(false)
    expect(usesSimulcast(true, { resolution: 'source', frameRate: 30 }, { width: 1280, height: 720 })).toBe(false)
  })
})

describe('screenSenderEncodings', () => {
  it('uma camada: só o envio do degrau', () => {
    expect(screenSenderEncodings({ resolution: '1080p', frameRate: 60 }, fullHd, 1)).toEqual([
      { maxBitrate: 7_000_000, maxFramerate: 60 }
    ])
  })

  it('duas camadas: 720p30 (3 Mbps) por baixo do envio principal', () => {
    expect(screenSenderEncodings({ resolution: '1080p', frameRate: 60 }, fullHd, 2)).toEqual([
      { maxBitrate: 3_000_000, maxFramerate: 30, scaleResolutionDownBy: 1.5 },
      { maxBitrate: 7_000_000, maxFramerate: 60 }
    ])
  })
})

describe('preferência da camada extra', () => {
  it('desmarcada por padrão; salva e lê de volta; sem armazenamento não quebra', () => {
    const data = new Map<string, string>()
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => data.set(k, v)
    })
    expect(loadScreenSimulcast()).toBe(false)
    saveScreenSimulcast(true)
    expect(data.get(SIMULCAST_KEY)).toBe('1')
    expect(loadScreenSimulcast()).toBe(true)
    saveScreenSimulcast(false)
    expect(loadScreenSimulcast()).toBe(false)
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('x')
      },
      setItem: () => {
        throw new Error('x')
      }
    })
    expect(loadScreenSimulcast()).toBe(false)
    expect(() => saveScreenSimulcast(true)).not.toThrow()
  })
})
