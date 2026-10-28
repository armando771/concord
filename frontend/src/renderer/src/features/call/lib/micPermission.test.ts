import { describe, expect, it, vi } from 'vitest'
import { createMicPermission } from './micPermission'

function setup(initial: { muted?: boolean; deafened?: boolean } = {}): {
  state: { muted: boolean; deafened: boolean }
  patch: ReturnType<typeof vi.fn>
  commitMute: ReturnType<typeof vi.fn>
  ensureMic: ReturnType<typeof vi.fn>
  mic: ReturnType<typeof createMicPermission>
} {
  const state = { muted: initial.muted ?? false, deafened: initial.deafened ?? false }
  const patch = vi.fn((p: Record<string, boolean>) => {
    if (p.muted !== undefined) state.muted = p.muted
  })
  const commitMute = vi.fn()
  const ensureMic = vi.fn()
  const mic = createMicPermission({
    muted: () => state.muted,
    deafened: () => state.deafened,
    patch,
    commitMute,
    ensureMic
  })
  return { state, patch, commitMute, ensureMic, mic }
}

const CAN = { microphone: true, stream: true }
const CANNOT = { microphone: false, stream: true }

describe('micPermission', () => {
  it('perder a fala muta e avisa; liberar desmuta e publica o microfone aberto', () => {
    const { state, commitMute, ensureMic, mic } = setup()

    mic.sync(CANNOT)
    expect(state.muted).toBe(true)
    expect(commitMute).toHaveBeenLastCalledWith(true)

    mic.sync(CAN)
    expect(state.muted).toBe(false)
    expect(commitMute).toHaveBeenLastCalledWith(false)
    expect(ensureMic).toHaveBeenLastCalledWith(false)
  })

  it('quem já estava mudo por escolha continua mudo ao ser liberado', () => {
    const { state, commitMute, ensureMic, mic } = setup({ muted: true })

    mic.sync(CANNOT)
    mic.sync(CAN)

    expect(state.muted).toBe(true)
    expect(commitMute).not.toHaveBeenCalled()
    expect(ensureMic).toHaveBeenLastCalledWith(true)
  })

  it('ensurdecido durante o silêncio: liberar não abre o microfone, o desensurdecer abre', () => {
    const { state, patch, commitMute, mic } = setup()
    mic.sync(CANNOT)
    state.deafened = true

    mic.sync(CAN)

    expect(state.muted).toBe(true)
    expect(commitMute).toHaveBeenCalledTimes(1)
    expect(patch).toHaveBeenCalledWith({ mutedBeforeDeafen: false })
  })

  it('repetir "pode falar" não desmuta quem mutou depois de liberado', () => {
    const { state, mic } = setup()
    mic.sync(CANNOT)
    mic.sync(CAN)
    state.muted = true

    mic.sync(CAN)

    expect(state.muted).toBe(true)
  })

  it('reset esquece o mute que veio da permissão (chamada nova)', () => {
    const { state, mic } = setup()
    mic.sync(CANNOT)
    mic.reset()

    mic.sync(CAN)

    expect(state.muted).toBe(true)
  })
})
