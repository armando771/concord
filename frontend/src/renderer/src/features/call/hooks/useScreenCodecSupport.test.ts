import { describe, expect, it, vi } from 'vitest'

// Harness mínimo (sem DOM simulado): roda o efeito na hora e guarda o estado.
const harness = vi.hoisted(() => ({
  cleanup: undefined as (() => void) | undefined,
  state: undefined as unknown
}))
vi.mock('react', () => ({
  useState: (initial: unknown) => [
    harness.state ?? initial,
    (next: unknown) => {
      harness.state = next
    }
  ],
  useEffect: (effect: () => (() => void) | undefined) => {
    harness.cleanup = effect()
  }
}))
const support = { av1: null, h265: 'hardware', h264: 'hardware', vp8: 'software' }
vi.mock('../lib/screenCodecSupport', () => ({ detectScreenCodecs: vi.fn(async () => support) }))

import { useScreenCodecSupport } from './useScreenCodecSupport'

describe('useScreenCodecSupport', () => {
  it('null enquanto detecta; depois, o que a placa codifica', async () => {
    expect(useScreenCodecSupport()).toBeNull()
    await Promise.resolve()
    expect(harness.state).toEqual(support)
  })

  it('desmontou antes da resposta: não atualiza', async () => {
    harness.state = undefined
    useScreenCodecSupport()
    harness.cleanup?.()
    await Promise.resolve()
    expect(harness.state).toBeUndefined()
  })
})
