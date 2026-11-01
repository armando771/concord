import { describe, expect, it } from 'vitest'
import { createTTSListener, type TTSListenerDeps } from './ttsListener'
import type { TTSListenContext } from './ttsListen'

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- dublê de teste
function env(over: Partial<TTSListenContext> = {}) {
  let ctx: TTSListenContext & { callId: string | null } = {
    enabled: true,
    call: { status: 'active', type: 'channel', serverId: 's1', channelId: 'vozA', conversationId: null },
    deafened: false,
    serverDeafened: false,
    callId: 'c1',
    ...over
  }
  const spoken: string[] = []
  let clears = 0
  const deps: TTSListenerDeps = {
    context: () => ctx,
    names: () => ({ labels: { bia: 'Beatriz' } }),
    queue: { enqueue: (t) => spoken.push(t), clear: () => clears++ }
  }
  return {
    listener: createTTSListener(deps),
    spoken,
    clears: () => clears,
    set: (next: Partial<typeof ctx>) => (ctx = { ...ctx, ...next })
  }
}

const event = (id = 'm1'): { type: string; payload: unknown } => ({
  type: 'message:create',
  payload: {
    server_id: 's1',
    message: {
      id,
      author_id: 'ana',
      author: { id: 'ana', username: 'ana', display_name: 'Ana' },
      channel_id: 'ch1',
      content: 'oi @bia',
      tts: true,
      tts_voice_channel_id: 'vozA',
      created_at: ''
    }
  }
})

describe('createTTSListener', () => {
  it('põe na fila o texto falado', () => {
    const e = env()
    e.listener.onEvent(event())
    expect(e.spoken).toEqual(['Ana disse: oi Beatriz'])
  })
  it('a mesma mensagem chegando por duas salas fala uma vez só', () => {
    const e = env()
    e.listener.onEvent(event())
    e.listener.onEvent(event())
    e.listener.onEvent(event('m2'))
    expect(e.spoken).toHaveLength(2)
  })
  it('ensurdecer, sair da call, trocar de call ou desligar esvazia a fila', () => {
    const e = env()
    e.listener.onStateChange()
    expect(e.clears()).toBe(0)
    e.set({ deafened: true })
    e.listener.onStateChange()
    expect(e.clears()).toBe(1)
    e.set({ deafened: false, callId: 'c2' })
    e.listener.onStateChange()
    expect(e.clears()).toBe(2)
    e.set({ enabled: false })
    e.listener.onStateChange()
    expect(e.clears()).toBe(3)
    e.set({ enabled: true, call: { status: 'idle', type: null, serverId: null, channelId: null, conversationId: null } })
    e.listener.onStateChange()
    expect(e.clears()).toBe(4)
  })
})
