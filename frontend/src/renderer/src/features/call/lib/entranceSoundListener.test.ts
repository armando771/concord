import { describe, expect, it, vi } from 'vitest'
import { handleEntranceEvent, playJoinSound, type EntranceDeps } from './entranceSoundListener'

const SOUND = '/api/entrance-sounds/0b6e7a52-3c1f-4c47-9d0e-2f6a8b1c4d5e'
const joined = (user: Record<string, unknown>): { type: string; payload: unknown } => ({
  type: 'call:joined',
  payload: { call_id: 'call-1', user }
})

function deps(over: Partial<EntranceDeps> = {}): EntranceDeps {
  return {
    call: () => ({ callId: 'call-1', type: 'channel', status: 'active', deafened: false }),
    meId: () => 'eu',
    isMuted: () => false,
    volume: () => 0.5,
    apiBase: '/api',
    playClip: vi.fn(async () => true),
    playDefault: vi.fn(),
    ...over
  }
}

describe('handleEntranceEvent', () => {
  it('toca o som de entrada da pessoa, sem o som padrão', async () => {
    const d = deps()
    await handleEntranceEvent(joined({ id: 'ana', entrance_sound_url: SOUND }), d)
    expect(d.playClip).toHaveBeenCalledWith(SOUND, 0.5)
    expect(d.playDefault).not.toHaveBeenCalled()
  })

  it('sem som de entrada: som padrão', async () => {
    const d = deps()
    await handleEntranceEvent(joined({ id: 'ana' }), d)
    expect(d.playClip).not.toHaveBeenCalled()
    expect(d.playDefault).toHaveBeenCalledOnce()
  })

  it('o som não carregou (404, formato, autoplay): cai no som padrão', async () => {
    const d = deps({ playClip: vi.fn(async () => false) })
    await handleEntranceEvent(joined({ id: 'ana', entrance_sound_url: SOUND }), d)
    expect(d.playDefault).toHaveBeenCalledOnce()
  })

  it('ensurdecido ou com a pessoa silenciada: só o som padrão', async () => {
    const deaf = deps({
      call: () => ({ callId: 'call-1', type: 'channel', status: 'active', deafened: true })
    })
    await handleEntranceEvent(joined({ id: 'ana', entrance_sound_url: SOUND }), deaf)
    expect(deaf.playClip).not.toHaveBeenCalled()
    expect(deaf.playDefault).toHaveBeenCalledOnce()

    const muted = deps({ isMuted: (id) => id === 'ana' })
    await handleEntranceEvent(joined({ id: 'ana', entrance_sound_url: SOUND }), muted)
    expect(muted.playClip).not.toHaveBeenCalled()
    expect(muted.playDefault).toHaveBeenCalledOnce()
  })

  it('prévia (playJoinSound direto): o som salvo ou, sem ele, o padrão', async () => {
    const d = deps()
    await playJoinSound({ id: '', entrance_sound_url: SOUND }, d, false)
    expect(d.playClip).toHaveBeenCalledWith(SOUND, 0.5)
    await playJoinSound({ id: '', entrance_sound_url: null }, d, false)
    expect(d.playDefault).toHaveBeenCalledOnce()
  })

  it('evento que não é comigo (eu entrando, outro evento): nenhum som', async () => {
    const d = deps()
    await handleEntranceEvent(joined({ id: 'eu', entrance_sound_url: SOUND }), d)
    await handleEntranceEvent({ type: 'call:left', payload: {} }, d)
    expect(d.playClip).not.toHaveBeenCalled()
    expect(d.playDefault).not.toHaveBeenCalled()
  })
})
